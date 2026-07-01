import type { MiddlewareHandler } from 'hono';
import type { HonoEnv } from '@lockbox/types/auth';
import { getSession, SESSION_COOKIE } from './session.js';
import { createDB } from '../db/index.js';

/**
 * Populates c.get('user') from the session cookie.
 * Does NOT reject unauthenticated requests — call requireAuth() for that.
 */
export const sessionMiddleware: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const cookieHeader = c.req.header('Cookie') ?? '';
  const sessionId = parseCookie(cookieHeader, SESSION_COOKIE);

  if (sessionId) {
    const db = createDB(c.env);
    const user = await getSession(db, sessionId);
    c.set('user', user);
  } else {
    c.set('user', null);
  }

  return next();
};

/**
 * Middleware that rejects with 401 if no authenticated session is present.
 * Use on routes that employees only can access.
 */
export const requireAuth: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Authentication required', code: 401 }, 401);
  }
  return next();
};

function parseCookie(header: string, name: string): string | null {
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k?.trim() === name) return v.join('=').trim() || null;
  }
  return null;
}
