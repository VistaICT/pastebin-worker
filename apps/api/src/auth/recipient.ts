import { decodeBase64UrlToString, encodeBase64Url } from '@lockbox/types/base64';
import { normalizeEmail, validateSingleEmail } from '@lockbox/types/validation';

const RECIPIENT_SESSION_TTL_SECONDS = 8 * 60 * 60;
const OTP_TTL_SECONDS = 10 * 60;
const OTP_MAX_ATTEMPTS = 5;
const OTP_SEND_LIMIT = 1;
const OTP_SEND_WINDOW_SECONDS = 60;

export interface RecipientOtpIssueResult {
  code: string;
  expiresInSeconds: number;
}

export interface RecipientOtpVerifyResult {
  ok: boolean;
  error?: 'expired' | 'invalid' | 'too_many_attempts';
}

export function normalizeRecipientEmail(email: string): string {
  return normalizeEmail(email);
}

export function isValidRecipientEmail(email: string): boolean {
  return validateSingleEmail(email) === null;
}

export async function issueRecipientOtp(
  kv: KVNamespace,
  secretId: string,
  email: string,
): Promise<RecipientOtpIssueResult | { error: 'rate_limited'; retryAfterSeconds: number }> {
  const normalizedEmail = normalizeRecipientEmail(email);
  const rateLimitKey = getOtpRateLimitKey(secretId, normalizedEmail);
  const rateEntry = await kv.getWithMetadata<{ expiresAt?: number }>(rateLimitKey);
  const currentRate = Number(rateEntry.value ?? '0');

  if (currentRate >= OTP_SEND_LIMIT) {
    const now = Date.now();
    const expiresAt = Number(rateEntry.metadata?.expiresAt ?? 0);
    const retryAfterSeconds = expiresAt > now
      ? Math.max(1, Math.ceil((expiresAt - now) / 1000))
      : OTP_SEND_WINDOW_SECONDS;
    return { error: 'rate_limited', retryAfterSeconds };
  }

  const code = generateOtpCode();
  const expiresAt = Date.now() + OTP_TTL_SECONDS * 1000;
  const record = {
    hash: await sha256Hex(`${secretId}:${normalizedEmail}:${code}`),
    attempts: 0,
    expiresAt,
  };

  const rateLimitExpiresAt = Date.now() + OTP_SEND_WINDOW_SECONDS * 1000;

  await Promise.all([
    kv.put(getOtpRecordKey(secretId, normalizedEmail), JSON.stringify(record), {
      expirationTtl: OTP_TTL_SECONDS,
    }),
    kv.put(rateLimitKey, String(currentRate + 1), {
      expirationTtl: OTP_SEND_WINDOW_SECONDS,
      metadata: { expiresAt: rateLimitExpiresAt },
    }),
  ]);

  return { code, expiresInSeconds: OTP_TTL_SECONDS };
}

export async function verifyRecipientOtp(
  kv: KVNamespace,
  secretId: string,
  email: string,
  code: string,
): Promise<RecipientOtpVerifyResult> {
  const normalizedEmail = normalizeRecipientEmail(email);
  const key = getOtpRecordKey(secretId, normalizedEmail);
  const raw = await kv.get(key);
  if (!raw) {
    return { ok: false, error: 'expired' };
  }

  const record = JSON.parse(raw) as {
    hash: string;
    attempts: number;
    expiresAt: number;
  };

  if (record.expiresAt < Date.now()) {
    await kv.delete(key);
    return { ok: false, error: 'expired' };
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, error: 'too_many_attempts' };
  }

  const providedHash = await sha256Hex(`${secretId}:${normalizedEmail}:${code.trim()}`);
  const valid = await timingSafeEqual(record.hash, providedHash);

  if (!valid) {
    record.attempts += 1;
    await kv.put(key, JSON.stringify(record), {
      expirationTtl: Math.max(1, Math.ceil((record.expiresAt - Date.now()) / 1000)),
    });
    return {
      ok: false,
      error: record.attempts >= OTP_MAX_ATTEMPTS ? 'too_many_attempts' : 'invalid',
    };
  }

  await kv.delete(key);
  return { ok: true };
}

export async function buildRecipientSessionCookie(
  secretId: string,
  email: string,
  sessionSecret: string,
  secure: boolean,
): Promise<string> {
  assertSessionSecretConfigured(sessionSecret);

  const payload = {
    secretId,
    email: normalizeRecipientEmail(email),
    exp: Date.now() + RECIPIENT_SESSION_TTL_SECONDS * 1000,
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = await signValue(encodedPayload, sessionSecret);
  const token = `${encodedPayload}.${signature}`;

  return [
    `${getRecipientCookieName(secretId)}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${RECIPIENT_SESSION_TTL_SECONDS}`,
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

export async function readRecipientSessionEmail(
  cookieHeader: string,
  secretId: string,
  sessionSecret: string,
): Promise<string | null> {
  assertSessionSecretConfigured(sessionSecret);

  const token = parseCookie(cookieHeader, getRecipientCookieName(secretId));
  if (!token) return null;

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const expectedSignature = await signValue(encodedPayload, sessionSecret);
  if (!(await timingSafeEqual(expectedSignature, signature))) {
    return null;
  }

  const payload = JSON.parse(decodeBase64UrlToString(encodedPayload)) as {
    secretId: string;
    email: string;
    exp: number;
  };

  if (payload.secretId !== secretId || payload.exp < Date.now()) {
    return null;
  }

  return normalizeRecipientEmail(payload.email);
}

export function getRecipientCookieName(secretId: string): string {
  return `lb_recipient_${secretId}`;
}

export function getRecipientSessionTtlSeconds(): number {
  return RECIPIENT_SESSION_TTL_SECONDS;
}

async function signValue(value: string, secret: string): Promise<string> {
  assertSessionSecretConfigured(secret);

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return encodeBase64Url(new Uint8Array(signature));
}

function generateOtpCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const value = ((bytes[0] ?? 0) << 24) | ((bytes[1] ?? 0) << 16) | ((bytes[2] ?? 0) << 8) | (bytes[3] ?? 0);
  return String(Math.abs(value) % 1_000_000).padStart(6, '0');
}

function getOtpRecordKey(secretId: string, normalizedEmail: string): string {
  return `recipient_otp:${secretId}:${normalizedEmail}`;
}

function getOtpRateLimitKey(secretId: string, normalizedEmail: string): string {
  return `recipient_otp_rate:${secretId}:${normalizedEmail}`;
}

function parseCookie(header: string, name: string): string | null {
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k?.trim() === name) {
      const rawValue = v.join('=').trim();
      if (!rawValue) return null;
      try {
        return decodeURIComponent(rawValue);
      } catch {
        return rawValue;
      }
    }
  }
  return null;
}

async function sha256Hex(value: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const viewA = new Uint8Array(hashA);
  const viewB = new Uint8Array(hashB);
  let result = 0;
  for (let i = 0; i < viewA.length; i++) {
    result |= viewA[i]! ^ viewB[i]!;
  }
  return result === 0;
}

function assertSessionSecretConfigured(secret: string) {
  if (!secret || secret.trim().length < 16) {
    throw new Error('SESSION_SECRET is not configured');
  }
}