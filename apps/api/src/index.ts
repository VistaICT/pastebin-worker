import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, HonoEnv } from '@lockbox/types/auth';
import { sessionMiddleware } from './auth/middleware.js';
import { authRoutes } from './routes/auth.js';
import { secretRoutes } from './routes/secrets.js';
import { fileRoutes, fileDownloadRoute, rawRoute } from './routes/files.js';

const app = new Hono<HonoEnv>();

app.onError((err, c) => {
  console.error(err);

  const path = new URL(c.req.url).pathname;
  const accept = c.req.header('Accept') ?? '';
  const wantsJson = path.startsWith('/api/') || accept.includes('application/json');

  if (wantsJson) {
    return c.json({ error: 'Internal server error', code: 500 }, 500);
  }

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Something went wrong - Lockbox</title>
  <style>
    body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background:#f4f6fb; color:#0f172a; }
    .wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
    .card { max-width:640px; width:100%; background:#fff; border:1px solid #dbe1ea; border-radius:14px; padding:24px; box-shadow:0 10px 24px rgba(15,23,42,.06); }
    h1 { margin:0 0 10px; font-size:22px; }
    p { margin:0 0 10px; line-height:1.5; color:#334155; }
    a { display:inline-block; margin-top:10px; text-decoration:none; border:1px solid #cbd5e1; border-radius:10px; padding:10px 14px; color:#0f172a; background:#f8fafc; }
  </style>
</head>
<body>
  <div class="wrap">
    <main class="card">
      <h1>Something went wrong</h1>
      <p>Lockbox hit an unexpected error while processing your request.</p>
      <p>Please retry in a moment.</p>
      <a href="/">Back to Lockbox</a>
    </main>
  </div>
</body>
</html>`;

  return c.html(html, 500);
});

// ── Global middleware ────────────────────────────────────────────────────────
app.use('*', cors({
  origin: (origin) => origin, // same-origin; tighten if needed
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Populate c.get('user') from session cookie on every request
app.use('*', sessionMiddleware);

// ── Auth endpoints ────────────────────────────────────────────────────────────
app.route('/auth', authRoutes);

// ── API endpoints ─────────────────────────────────────────────────────────────
app.route('/api/secrets', secretRoutes);
app.route('/api/files', fileRoutes);

// ── File / raw download ──────────────────────────────────────────────────────
app.route('/f', fileDownloadRoute);
app.route('/raw', rawRoute);

const ASSET_PATH_PREFIXES = ['/assets/', '/favicon', '/robots.txt', '/manifest'];
const ASSET_EXT_RE = /\.(?:js|mjs|cjs|css|map|json|png|jpe?g|gif|webp|svg|ico|avif|woff2?|ttf|otf|eot|txt|xml|webmanifest)$/i;

function isAssetRequest(pathname: string) {
  return ASSET_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix)) || ASSET_EXT_RE.test(pathname);
}

function withCacheControl(response: Response, cacheControl: string) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', cacheControl);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// ── Serve static SPA (catches all other requests) ────────────────────────────
app.get('*', async (c) => {
  const reqUrl = new URL(c.req.url);
  const assetRequest = isAssetRequest(reqUrl.pathname);
  const assetResponse = await c.env.ASSETS.fetch(c.req.raw);

  const contentType = (assetResponse.headers.get('content-type') || '').toLowerCase();
  const isHtml = contentType.includes('text/html');

  if (assetRequest) {
    // Never serve the SPA shell for build/static asset URLs.
    if (assetResponse.status === 404 || isHtml) {
      return c.text('Not found', 404, {
        'Cache-Control': 'public, max-age=60',
      });
    }

    return withCacheControl(assetResponse, 'public, max-age=31536000, immutable');
  }

  // Navigation/document requests get the SPA shell with a conservative cache.
  if (assetResponse.status === 404) {
    const rootRequest = new Request(new URL('/', reqUrl).toString(), c.req.raw);
    const rootResponse = await c.env.ASSETS.fetch(rootRequest);
    return withCacheControl(rootResponse, 'no-store, must-revalidate');
  }

  if (isHtml) {
    return withCacheControl(assetResponse, 'no-store, must-revalidate');
  }

  return withCacheControl(assetResponse, 'public, max-age=31536000, immutable');
});

export default app satisfies ExportedHandler<Env>;
