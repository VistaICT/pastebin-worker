import { Hono } from 'hono';
import { AwsClient } from 'aws4fetch';
import { eq } from 'drizzle-orm';
import type { HonoEnv } from '@lockbox/types/auth';
import type {
  CancelMultipartUploadBody,
  CompleteMultipartUploadBody,
  GetMultipartUploadPartUrlBody,
  GetMultipartUploadPartUrlResponse,
  StartMultipartUploadBody,
  StartMultipartUploadResponse,
} from '@lockbox/types/api';
import { requireAuth } from '../auth/middleware.js';
import { createDB, schema } from '../db/index.js';
import { nanoid } from '../utils/nanoid.js';
import {
  FILE_EXPIRE_DAYS,
  FILE_EXPIRE_SECONDS,
  MAX_FILE_SIZE,
  MULTIPART_CHUNK_SIZE,
  UPLOAD_SESSION_TTL_SECONDS,
} from '../utils/constants.js';
import { createR2TempCredentials } from '../utils/r2-temp-credentials.js';
import { deleteSecretCascade } from './secrets.js';

export const fileRoutes = new Hono<HonoEnv>();

// ---------------------------------------------------------------------------
// POST /api/files/upload-start — create a direct-to-R2 upload session
// ---------------------------------------------------------------------------
fileRoutes.post('/upload-start', requireAuth, async (c) => {
  const user = c.get('user')!;
  let body: StartMultipartUploadBody;

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const size = Number(body.size ?? 0);
  if (!body.fileName?.trim()) {
    return c.json({ error: 'fileName is required' }, 400);
  }
  if (!Number.isFinite(size) || size <= 0) {
    return c.json({ error: 'size must be a positive number' }, 400);
  }
  if (size > MAX_FILE_SIZE) {
    return c.json({ error: `File exceeds ${Math.floor(MAX_FILE_SIZE / 1024 / 1024)} MB limit` }, 413);
  }

  const euJurisdiction = body.euJurisdiction === true;
  const bucket = euJurisdiction ? c.env.BUCKET_EU : c.env.BUCKET_GLOBAL;
  const bucketName = euJurisdiction ? c.env.R2_BUCKET_EU : c.env.R2_BUCKET_GLOBAL;
  const bucketLocation = euJurisdiction ? 'eu' : 'global';

  if (!bucketName) {
    return c.json({ error: 'R2 bucket name is not configured', code: 500 }, 500);
  }

  const fileId = nanoid();
  const objectKey = fileId;
  const now = Date.now();
  const expiresAt = now + UPLOAD_SESSION_TTL_SECONDS * 1000;
  const multipartUpload = await bucket.createMultipartUpload(objectKey);
  const uploadId = multipartUpload.uploadId;

  const db = createDB(c.env);
  await db.insert(schema.uploadSessions).values({
    id: crypto.randomUUID(),
    fileId,
    objectKey,
    uploadId,
    bucketLocation,
    euJurisdiction: euJurisdiction ? 1 : 0,
    createdBy: user.id,
    metadata: JSON.stringify({
      fileName: body.fileName.trim(),
      size,
      mimeType: body.mimeType || 'application/octet-stream',
      recommendedChunkSize: MULTIPART_CHUNK_SIZE,
    }),
    expiresAt,
    createdAt: now,
    completedAt: null,
  });

  let credentials: StartMultipartUploadResponse['credentials'] | undefined;
  if (c.env.R2_ACCOUNT_ID && c.env.R2_ACCESS_KEY_ID && c.env.R2_SECRET_ACCESS_KEY) {
    credentials = {
      bucket: bucketName,
      ...(await createR2TempCredentials({
        bucket: bucketName,
        objectKey,
        ttlSeconds: UPLOAD_SESSION_TTL_SECONDS,
        jurisdiction: euJurisdiction ? 'eu' : 'default',
        accountId: c.env.R2_ACCOUNT_ID,
        parentAccessKeyId: c.env.R2_ACCESS_KEY_ID,
        parentSecretAccessKey: c.env.R2_SECRET_ACCESS_KEY,
        actions: ['UploadPart', 'CompleteMultipartUpload', 'AbortMultipartUpload', 'HeadObject'],
      })),
    };
  }

  return c.json({
    fileId,
    objectKey,
    uploadId,
    expiresAt,
    recommendedChunkSize: MULTIPART_CHUNK_SIZE,
    credentials,
  } satisfies StartMultipartUploadResponse);
});

// ---------------------------------------------------------------------------
// POST /api/files/upload-part-url — create a presigned UploadPart URL
// ---------------------------------------------------------------------------
fileRoutes.post('/upload-part-url', requireAuth, async (c) => {
  const user = c.get('user')!;
  let body: GetMultipartUploadPartUrlBody;

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const partNumber = Number(body.partNumber);
  if (!Number.isInteger(partNumber) || partNumber <= 0 || partNumber > 10_000) {
    return c.json({ error: 'partNumber must be an integer between 1 and 10000' }, 400);
  }

  if (!c.env.R2_ACCOUNT_ID || !c.env.R2_ACCESS_KEY_ID || !c.env.R2_SECRET_ACCESS_KEY) {
    return c.json({ error: 'Direct upload signing is not configured', code: 500 }, 500);
  }

  const db = createDB(c.env);
  const session = await db.query.uploadSessions.findFirst({
    where: eq(schema.uploadSessions.fileId, body.fileId),
  });

  if (!session || session.createdBy !== user.id) {
    return c.json({ error: 'Upload session not found', code: 404 }, 404);
  }
  if (session.uploadId !== body.uploadId || session.objectKey !== body.objectKey) {
    return c.json({ error: 'Upload session mismatch', code: 400 }, 400);
  }
  if (session.expiresAt <= Date.now()) {
    return c.json({ error: 'Upload session expired', code: 410 }, 410);
  }

  const bucketName = session.bucketLocation === 'eu' ? c.env.R2_BUCKET_EU : c.env.R2_BUCKET_GLOBAL;
  if (!bucketName) {
    return c.json({ error: 'R2 bucket name is not configured', code: 500 }, 500);
  }

  const endpointHost = session.bucketLocation === 'eu'
    ? `${c.env.R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`
    : `${c.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const objectHost = `${bucketName}.${endpointHost}`;
  const objectPath = encodeURIComponent(session.objectKey).replace(/%2F/g, '/');
  const url = new URL(`https://${objectHost}/${objectPath}`);
  url.searchParams.set('partNumber', String(partNumber));
  url.searchParams.set('uploadId', session.uploadId);

  const signer = new AwsClient({
    accessKeyId: c.env.R2_ACCESS_KEY_ID,
    secretAccessKey: c.env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  });

  const signedRequest = await signer.sign(url.toString(), {
    method: 'PUT',
    headers: body.contentType
      ? { 'Content-Type': body.contentType }
      : undefined,
    aws: {
      signQuery: true,
      allHeaders: true,
    },
  });

  const expiresAt = Math.min(Date.now() + 5 * 60 * 1000, session.expiresAt);

  return c.json({
    url: signedRequest.url,
    expiresAt,
  } satisfies GetMultipartUploadPartUrlResponse);
});

// ---------------------------------------------------------------------------
// POST /api/files/upload-complete — finalize metadata after direct upload
// ---------------------------------------------------------------------------
fileRoutes.post('/upload-complete', requireAuth, async (c) => {
  const user = c.get('user')!;
  let body: CompleteMultipartUploadBody;

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const db = createDB(c.env);
  const session = await db.query.uploadSessions.findFirst({
    where: eq(schema.uploadSessions.fileId, body.fileId),
  });

  if (!session || session.createdBy !== user.id) {
    return c.json({ error: 'Upload session not found', code: 404 }, 404);
  }
  if (session.uploadId !== body.uploadId || session.objectKey !== body.objectKey) {
    return c.json({ error: 'Upload session mismatch', code: 400 }, 400);
  }

  const bucket = session.bucketLocation === 'eu' ? c.env.BUCKET_EU : c.env.BUCKET_GLOBAL;
  try {
    const upload = bucket.resumeMultipartUpload(session.objectKey, session.uploadId);
    await upload.complete(
      body.parts.map((part) => ({
        partNumber: part.partNumber,
        etag: part.etag.replaceAll('"', ''),
      })),
    );
  } catch {
    return c.json({ error: 'Failed to complete multipart upload', code: 502 }, 502);
  }

  const object = await bucket.head(session.objectKey);
  if (!object) {
    return c.json({ error: 'Uploaded object not found', code: 404 }, 404);
  }

  const now = Date.now();
  const metadata = JSON.parse(session.metadata) as {
    fileName: string;
    size: number;
    mimeType: string;
  };

  await db.insert(schema.files).values({
    id: session.fileId,
    content: metadata.fileName,
    expire: FILE_EXPIRE_SECONDS,
    mimeType: metadata.mimeType || 'application/octet-stream',
    createTime: now,
    metadata: JSON.stringify({
      originalName: metadata.fileName,
      size: metadata.size,
      type: metadata.mimeType,
      createTime: now,
      expireTime: now + FILE_EXPIRE_SECONDS * 1000,
      multipart: true,
      partCount: body.parts.length,
    }),
    createdBy: user.id,
    euJurisdiction: session.euJurisdiction ? 1 : 0,
    bucketLocation: session.bucketLocation,
  });

  await db.update(schema.uploadSessions)
    .set({ completedAt: now })
    .where(eq(schema.uploadSessions.id, session.id));

  return c.json({
    id: session.fileId,
    url: `${c.env.BASE_URL}/f/${session.fileId}`,
    expireTime: now + FILE_EXPIRE_SECONDS * 1000,
    expireDays: FILE_EXPIRE_DAYS,
    euJurisdiction: Boolean(session.euJurisdiction),
  });
});

// ---------------------------------------------------------------------------
// POST /api/files/upload-cancel — cancel an upload session
// ---------------------------------------------------------------------------
fileRoutes.post('/upload-cancel', requireAuth, async (c) => {
  const user = c.get('user')!;
  let body: CancelMultipartUploadBody;

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const db = createDB(c.env);
  const session = await db.query.uploadSessions.findFirst({
    where: eq(schema.uploadSessions.fileId, body.fileId),
  });

  if (!session || session.createdBy !== user.id) {
    return c.json({ error: 'Upload session not found', code: 404 }, 404);
  }

  const bucket = session.bucketLocation === 'eu' ? c.env.BUCKET_EU : c.env.BUCKET_GLOBAL;
  try {
    const upload = bucket.resumeMultipartUpload(session.objectKey, session.uploadId);
    await upload.abort();
  } catch {
    // Best effort. The session row still needs to be removed.
  }

  await db.delete(schema.uploadSessions).where(eq(schema.uploadSessions.id, session.id));
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// GET /api/files/:id/meta — file metadata (public)
// ---------------------------------------------------------------------------
fileRoutes.get('/:id/meta', async (c) => {
  const id = c.req.param('id');
  const db = createDB(c.env);
  const row = await db.query.files.findFirst({
    where: eq(schema.files.id, id),
  });
  if (!row) return c.json({ error: 'Not found' }, 404);

  if (row.expire && Date.now() > row.createTime + row.expire * 1000) {
    return c.json({ error: 'File expired', code: 410 }, 410);
  }

  const meta = JSON.parse(row.metadata) as Record<string, unknown>;
  return c.json({ id, ...meta, euJurisdiction: Boolean(row.euJurisdiction) });
});

// ---------------------------------------------------------------------------
// GET /f/:id — download a file (public, served from correct bucket)
// Mounted at the root level, not under /api
// ---------------------------------------------------------------------------
export const fileDownloadRoute = new Hono<HonoEnv>();

fileDownloadRoute.get('/:id', async (c) => {
  const id = c.req.param('id');
  const db = createDB(c.env);

  const row = await db.query.files.findFirst({
    where: eq(schema.files.id, id),
  });
  if (!row) return c.text('Not found', 404);

  if (row.expire && Date.now() > row.createTime + row.expire * 1000) {
    const bucket = Boolean(row.euJurisdiction) ? c.env.BUCKET_EU : c.env.BUCKET_GLOBAL;
    await Promise.all([
      bucket.delete(id),
      db.delete(schema.files).where(eq(schema.files.id, id)),
    ]);
    return c.text('File expired', 410);
  }

  const euJurisdiction = Boolean(row.euJurisdiction);

  if (c.env.R2_ACCOUNT_ID && c.env.R2_ACCESS_KEY_ID && c.env.R2_SECRET_ACCESS_KEY) {
    const bucketName = euJurisdiction ? c.env.R2_BUCKET_EU : c.env.R2_BUCKET_GLOBAL;
    if (!bucketName) {
      return c.text('Download is not configured', 500);
    }

    const endpointHost = euJurisdiction
      ? `${c.env.R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`
      : `${c.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const objectHost = `${bucketName}.${endpointHost}`;
    const objectPath = encodeURIComponent(id).replace(/%2F/g, '/');
    const objectUrl = `https://${objectHost}/${objectPath}`;

    const signer = new AwsClient({
      accessKeyId: c.env.R2_ACCESS_KEY_ID,
      secretAccessKey: c.env.R2_SECRET_ACCESS_KEY,
      service: 's3',
      region: 'auto',
    });

    const signedRequest = await signer.sign(objectUrl, {
      method: 'GET',
      aws: {
        signQuery: true,
        allHeaders: true,
      },
    });

    return c.redirect(signedRequest.url, 302);
  }

  // Fallback for environments that do not expose R2 API signing credentials.
  const bucket = euJurisdiction ? c.env.BUCKET_EU : c.env.BUCKET_GLOBAL;
  const obj = await bucket.get(id);
  if (!obj) {
    await db.delete(schema.files).where(eq(schema.files.id, id));
    return c.text('Not found', 404);
  }

  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(obj.customMetadata?.['name'] ?? 'file')}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
});

// ---------------------------------------------------------------------------
// GET /raw/:id — raw secret text (public)
// ---------------------------------------------------------------------------
export const rawRoute = new Hono<HonoEnv>();

rawRoute.get('/:id', async (c) => {
  const id = c.req.param('id');
  const db = createDB(c.env);
  const row = await db.query.secrets.findFirst({
    where: eq(schema.secrets.id, id),
    columns: { id: true, content: true, expire: true, createTime: true, metadata: true },
  });

  if (!row) return c.text('Not found', 404);
  if (row.expire && Date.now() > row.createTime + row.expire * 1000) {
    await deleteSecretCascade(db, c.env, id, row.metadata);
    return c.text('Expired', 410);
  }

  return c.text(row.content, 200, { 'Content-Type': 'text/plain; charset=utf-8' });
});
