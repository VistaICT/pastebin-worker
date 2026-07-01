import { createRemoteJWKSet, jwtVerify } from 'jose';
import { eq } from 'drizzle-orm';
import type { AuthUser } from '@lockbox/types/auth';
import { SESSION_COOKIE } from '@lockbox/types/auth';
import type { DB } from '../db/index.js';
import { schema } from '../db/index.js';

const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 hours

// Export re-exports for convenience
export type { AuthUser } from '@lockbox/types/auth';
export { SESSION_COOKIE } from '@lockbox/types/auth';

// Cache JWKS per tenant to avoid repeated network fetches
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(tenantId: string) {
  if (!jwksCache.has(tenantId)) {
    jwksCache.set(
      tenantId,
      createRemoteJWKSet(
        new URL(
          `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
        ),
      ),
    );
  }
  return jwksCache.get(tenantId)!;
}

/** Validate the Entra ID token and return the user claims */
export async function validateIdToken(
  idToken: string,
  tenantId: string,
  clientId: string,
  expectedNonce?: string,
): Promise<AuthUser> {
  const jwks = getJwks(tenantId);
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
    audience: clientId,
    algorithms: ['RS256'], // Explicit algorithm constraint
  });

  // Validate tenant ID (defense-in-depth)
  const tid = payload.tid as string | undefined;
  if (!tid || tid !== tenantId) {
    throw new Error(`Token tenant ID mismatch: expected ${tenantId}, got ${tid}`);
  }

  // Validate nonce (prevents replay attacks)
  if (expectedNonce) {
    const nonce = payload.nonce as string | undefined;
    if (!nonce || nonce !== expectedNonce) {
      throw new Error('Token nonce mismatch');
    }
  }

  const sub = (payload.sub ?? payload.oid) as string | undefined;
  if (!sub) throw new Error('ID token missing sub/oid');

  return {
    id: sub,
    email: (payload.email ?? payload.preferred_username) as string,
    name: (payload.name as string | undefined) ?? null,
  };
}

/** Create a new session in D1 and return the session ID */
export async function createSession(
  db: DB,
  user: AuthUser,
): Promise<string> {
  const id = crypto.randomUUID();
  const now = Date.now();
  await db.insert(schema.sessions).values({
    id,
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    expiresAt: now + SESSION_TTL_SECONDS * 1000,
    createdAt: now,
  });
  return id;
}

/** Resolve a session ID to an AuthUser (returns null if not found / expired) */
export async function getSession(
  db: DB,
  sessionId: string,
): Promise<AuthUser | null> {
  const row = await db.query.sessions.findFirst({
    where: eq(schema.sessions.id, sessionId),
  });

  if (!row) return null;
  if (Date.now() > row.expiresAt) {
    await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
    return null;
  }

  return { id: row.userId, email: row.userEmail, name: row.userName ?? null };
}

/** Delete a session */
export async function deleteSession(db: DB, sessionId: string): Promise<void> {
  await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
}

/** Build a Set-Cookie header value for the session */
export function buildSessionCookie(sessionId: string, secure: boolean): string {
  const flags = [
    `${SESSION_COOKIE}=${sessionId}`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Path=/`,
    `Max-Age=${SESSION_TTL_SECONDS}`,
    ...(secure ? ['Secure'] : []),
  ];
  return flags.join('; ');
}

/** Build a clearing Set-Cookie header */
export function clearSessionCookie(secure: boolean): string {
  const flags = [
    `${SESSION_COOKIE}=`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Path=/`,
    `Max-Age=0`,
    ...(secure ? ['Secure'] : []),
  ];
  return flags.join('; ');
}
