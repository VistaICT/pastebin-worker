import { Hono } from 'hono';
import type { HonoEnv } from '@lockbox/types/auth';
import {
  generateState,
  generateNonce,
  generateCodeVerifier,
  buildAuthorizationUrl,
  exchangeCodeForTokens,
} from '../auth/pkce.js';
import {
  validateIdToken,
  createSession,
  deleteSession,
  buildSessionCookie,
  clearSessionCookie,
  SESSION_COOKIE,
} from '../auth/session.js';
import { createDB } from '../db/index.js';

const PKCE_TTL_SECONDS = 600; // 10 minutes
const RATE_LIMIT_PER_MINUTE = 10;

// Simple rate limiter using KV (counts auth attempts per IP per minute)
async function checkRateLimit(kv: KVNamespace, ip: string): Promise<boolean> {
  const key = `rate_limit:auth:${ip}:${Math.floor(Date.now() / 60000)}`;
  const current = await kv.get(key, 'json');
  const count = (current as number | null) ?? 0;

  if (count >= RATE_LIMIT_PER_MINUTE) {
    return false; // Rate limited
  }

  await kv.put(key, String(count + 1), { expirationTtl: 120 }); // 2 min buffer
  return true;
}

// Validate that returnTo is same-origin or relative (prevent open redirects)
function isValidReturnTo(returnTo: string, baseUrl: string): boolean {
  if (!returnTo) return true; // Empty is okay (will default to '/')
  if (returnTo.startsWith('/')) return true; // Relative path is safe
  try {
    const parsed = new URL(returnTo);
    const base = new URL(baseUrl);
    return parsed.origin === base.origin; // Only allow same-origin
  } catch {
    return false; // Invalid URL
  }
}

// Extract client IP from Cloudflare headers (X-Forwarded-For or CF-Connecting-IP)
function getClientIp(c: any): string {
  return (
    c.req.header('CF-Connecting-IP') ??
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

function parseCookie(header: string, name: string): string | null {
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k?.trim() === name) return v.join('=').trim() || null;
  }
  return null;
}

function isSecure(env: HonoEnv['Bindings']): boolean {
  return env.ENVIRONMENT === 'production';
}

export const authRoutes = new Hono<HonoEnv>();

/**
 * GET /auth/login
 * Redirect employee to Entra login with PKCE challenge + nonce.
 */
authRoutes.get('/login', async (c) => {
  // Rate limiting
  const ip = getClientIp(c);
  const allowed = await checkRateLimit(c.env.PKCE_KV, ip);
  if (!allowed) {
    return authErrorResponse(c, 429, 'Too many attempts', 'Please wait a minute and try signing in again.');
  }

  const { tenantId, clientId, redirectUri } = getOidcConfig(c.env);
  const baseUrl = new URL(c.env.BASE_URL).origin;

  const state = generateState();
  const nonce = generateNonce();
  const codeVerifier = generateCodeVerifier();

  // Validate returnTo to prevent open redirects
  const returnTo = c.req.query('return_to') ?? '/';
  if (!isValidReturnTo(returnTo, baseUrl)) {
    return authErrorResponse(c, 400, 'Invalid return URL', 'The return URL is not allowed.');
  }

  const { url } = await buildAuthorizationUrl({
    tenantId,
    clientId,
    redirectUri,
    state,
    codeVerifier,
    nonce,
  });

  // Store PKCE + nonce + redirectUri keyed by state in KV (10 min TTL)
  await c.env.PKCE_KV.put(
    `pkce:${state}`,
    JSON.stringify({ codeVerifier, nonce, redirectUri }),
    { expirationTtl: PKCE_TTL_SECONDS },
  );

  // Persist the post-login redirect target
  await c.env.PKCE_KV.put(`state_return:${state}`, returnTo, {
    expirationTtl: PKCE_TTL_SECONDS,
  });

  return c.redirect(url, 302);
});

/**
 * GET /auth/callback
 * Entra redirects here after authentication.
 */
authRoutes.get('/callback', async (c) => {
  // Rate limiting
  const ip = getClientIp(c);
  const allowed = await checkRateLimit(c.env.PKCE_KV, ip);
  if (!allowed) {
    return authErrorResponse(c, 429, 'Too many attempts', 'Please wait a minute and try signing in again.');
  }

  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    const desc = c.req.query('error_description') ?? error;
    return authErrorResponse(c, 400, 'Authentication failed', desc);
  }

  if (!code || !state) {
    return authErrorResponse(c, 400, 'Invalid callback', 'Missing required callback parameters.');
  }

  // Retrieve and delete the PKCE data + nonce + redirectUri (one-time use)
  const pkceRaw = await c.env.PKCE_KV.get(`pkce:${state}`);
  if (!pkceRaw) {
    return authErrorResponse(c, 400, 'Session expired', 'Your login session expired. Please sign in again.');
  }
  await c.env.PKCE_KV.delete(`pkce:${state}`);

  const { codeVerifier, nonce, redirectUri: storedRedirectUri } = JSON.parse(pkceRaw) as {
    codeVerifier: string;
    nonce: string;
    redirectUri: string;
  };

  const { tenantId, clientId, clientSecret, redirectUri } = getOidcConfig(c.env);

  // Validate that redirectUri matches what was stored (OIDC redirect attack prevention)
  if (storedRedirectUri !== redirectUri) {
    return authErrorResponse(c, 400, 'Invalid callback', 'Redirect URI mismatch.');
  }

  let idToken: string;
  try {
    ({ idToken } = await exchangeCodeForTokens({
      tenantId,
      clientId,
      clientSecret,
      redirectUri,
      code,
      codeVerifier,
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return authErrorResponse(c, 502, 'Sign-in failed', `Token exchange failed. ${msg}`);
  }

  let user;
  try {
    user = await validateIdToken(idToken, tenantId, clientId, nonce);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return authErrorResponse(c, 401, 'Sign-in failed', `Token validation failed. ${msg}`);
  }

  const db = createDB(c.env);
  let sessionId: string;
  try {
    sessionId = await createSession(db, user);
  } catch {
    return authErrorResponse(
      c,
      500,
      'Sign-in failed',
      'Your account was verified, but we could not create a session. Please try again in a moment.',
    );
  }

  const returnTo = (await c.env.PKCE_KV.get(`state_return:${state}`)) ?? '/';
  await c.env.PKCE_KV.delete(`state_return:${state}`);

  const secure = isSecure(c.env);
  return new Response(null, {
    status: 302,
    headers: {
      Location: returnTo,
      'Set-Cookie': buildSessionCookie(sessionId, secure),
    },
  });
});

/**
 * POST /auth/logout
 * Clear the server-side session.
 */
authRoutes.post('/logout', async (c) => {
  const cookieHeader = c.req.header('Cookie') ?? '';
  const sessionId = parseCookie(cookieHeader, SESSION_COOKIE);

  if (sessionId) {
    const db = createDB(c.env);
    await deleteSession(db, sessionId);
  }

  const secure = isSecure(c.env);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': clearSessionCookie(secure),
    },
  });
});

/**
 * GET /auth/me
 * Returns the currently authenticated user or 401.
 */
authRoutes.get('/me', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated', code: 401 }, 401);
  return c.json({ id: user.id, email: user.email, name: user.name });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getOidcConfig(env: HonoEnv['Bindings']) {
  return {
    tenantId: env.ENTRA_TENANT_ID,
    clientId: env.ENTRA_CLIENT_ID,
    clientSecret: env.ENTRA_CLIENT_SECRET,
    redirectUri: `${env.BASE_URL}/auth/callback`,
  };
}

function authErrorResponse(c: any, status: number, title: string, description: string) {
  const accept = c.req.header('Accept') ?? '';
  if (accept.includes('application/json')) {
    return c.json({ error: description, title }, status);
  }

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} - Lockbox</title>
  <style>
    body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background:#f4f6fb; color:#0f172a; }
    .wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
    .card { max-width:640px; width:100%; background:#fff; border:1px solid #dbe1ea; border-radius:14px; padding:24px; box-shadow:0 10px 24px rgba(15,23,42,.06); }
    h1 { margin:0 0 10px; font-size:22px; }
    p { margin:0 0 10px; line-height:1.5; color:#334155; }
    .actions { margin-top:16px; display:flex; gap:10px; flex-wrap:wrap; }
    a { text-decoration:none; border:1px solid #cbd5e1; border-radius:10px; padding:10px 14px; color:#0f172a; background:#f8fafc; }
    a.primary { background:#2563eb; border-color:#2563eb; color:#fff; }
  </style>
</head>
<body>
  <div class="wrap">
    <main class="card">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
      <p>If this keeps happening, contact support and include the time of this error.</p>
      <div class="actions">
        <a class="primary" href="/auth/login">Try sign in again</a>
        <a href="/">Back to Lockbox</a>
      </div>
    </main>
  </div>
</body>
</html>`;

  return c.html(html, status);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
