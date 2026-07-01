/**
 * PKCE (Proof Key for Code Exchange) helpers — RFC 7636
 * Uses the Web Crypto API available in Cloudflare Workers.
 */
import { encodeBase64Url } from '@lockbox/types/base64';

/** Cryptographically random state value for CSRF protection */
export function generateState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

/** Cryptographically random nonce to prevent replay attacks */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

/** Cryptographically random code_verifier (43-128 chars URL-safe) */
export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

/** SHA-256 code_challenge derived from the verifier */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoded = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return encodeBase64Url(new Uint8Array(digest));
}

/** Build the Entra authorization URL with PKCE and nonce */
export async function buildAuthorizationUrl(params: {
  tenantId: string;
  clientId: string;
  redirectUri: string;
  state: string;
  codeVerifier: string;
  nonce: string;
}): Promise<{ url: string; codeChallenge: string }> {
  const codeChallenge = await generateCodeChallenge(params.codeVerifier);

  const url = new URL(
    `https://login.microsoftonline.com/${params.tenantId}/oauth2/v2.0/authorize`,
  );
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('response_mode', 'query');
  url.searchParams.set('scope', 'openid profile email offline_access');
  url.searchParams.set('state', params.state);
  url.searchParams.set('nonce', params.nonce);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  // Prompt employees to select an account (avoids silent SSO surprises)
  url.searchParams.set('prompt', 'select_account');

  return { url: url.toString(), codeChallenge };
}

/** Exchange authorization code + verifier for tokens */
export async function exchangeCodeForTokens(params: {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
}): Promise<{ idToken: string; accessToken: string }> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    code: params.code,
    code_verifier: params.codeVerifier,
  });

  const resp = await fetch(
    `https://login.microsoftonline.com/${params.tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    },
  );

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  const data = (await resp.json()) as { id_token: string; access_token: string };
  return { idToken: data.id_token, accessToken: data.access_token };
}
