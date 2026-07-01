/**
 * Authentication types for both API and frontend
 */

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

export type HonoEnv = {
  Bindings: Env;
  Variables: {
    user: AuthUser | null;
  };
};

// Cloudflare Workers environment bindings
export interface Env {
  // Bindings
  DB: D1Database;
  BUCKET_GLOBAL: R2Bucket;
  BUCKET_EU: R2Bucket;
  PKCE_KV: KVNamespace;
  EMAIL_WORKER: Fetcher;
  ASSETS: Fetcher;
  // Variables
  BASE_URL: string;
  ENVIRONMENT: string;
  R2_BUCKET_GLOBAL?: string;
  R2_BUCKET_EU?: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  // Secrets
  ENTRA_TENANT_ID: string;
  ENTRA_CLIENT_ID: string;
  ENTRA_CLIENT_SECRET: string;
  R2_SECRET_ACCESS_KEY?: string;
  SESSION_SECRET: string;
}

export const SESSION_COOKIE = 'lockbox_session';
