import { SignJWT } from 'jose';

type TempCredentialAction =
  | 'CreateMultipartUpload'
  | 'UploadPart'
  | 'CompleteMultipartUpload'
  | 'AbortMultipartUpload'
  | 'PutObject'
  | 'HeadObject';

export interface TempCredentialOptions {
  bucket: string;
  objectKey: string;
  ttlSeconds: number;
  accountId: string;
  jurisdiction?: 'default' | 'eu' | 'fedramp';
  parentAccessKeyId: string;
  parentSecretAccessKey: string;
  actions: TempCredentialAction[];
}

export async function createR2TempCredentials(opts: TempCredentialOptions) {
  const endpoint = opts.jurisdiction && opts.jurisdiction !== 'default'
    ? `https://${opts.accountId}.${opts.jurisdiction}.r2.cloudflarestorage.com`
    : `https://${opts.accountId}.r2.cloudflarestorage.com`;
  const claims: Record<string, unknown> = {
    bucket: opts.bucket,
    scope: 'object-read-write',
    actions: opts.actions,
    paths: {
      objectPaths: [opts.objectKey],
      prefixPaths: [],
    },
  };

  const jwt = await new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(opts.accountId)
    .setIssuer(opts.parentAccessKeyId)
    .setAudience(new URL(endpoint).host)
    .setIssuedAt()
    .setExpirationTime(`${opts.ttlSeconds}s`)
    .sign(new TextEncoder().encode(opts.parentSecretAccessKey));

  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(jwt),
  );

  const secretAccessKey = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return {
    endpoint,
    accessKeyId: opts.parentAccessKeyId,
    secretAccessKey,
    sessionToken: btoa(`jwt/${jwt}`),
  };
}