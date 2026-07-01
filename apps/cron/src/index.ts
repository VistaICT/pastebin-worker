/// <reference types="@cloudflare/workers-types" />

type SecretRow = {
  id: string;
  metadata: string;
};

type FileRow = {
  id: string;
  euJurisdiction: number | boolean;
};

type UploadSessionRow = {
  id: string;
  objectKey: string;
  uploadId: string;
  bucketLocation: string;
};

interface Env {
  DB: D1Database;
  BUCKET_GLOBAL: R2Bucket;
  BUCKET_EU: R2Bucket;
}

const BATCH_SIZE = 100;

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runCleanup(env));
  },
} satisfies ExportedHandler<Env>;

async function runCleanup(env: Env): Promise<void> {
  const now = Date.now();

  // ── Clean expired secrets ──────────────────────────────────────────────────
  await deleteExpiredSecrets(env.DB, env, now);

  // ── Clean expired files ────────────────────────────────────────────────────
  await deleteExpiredFiles(env.DB, env, now);

  // ── Purge stale sessions ───────────────────────────────────────────────────
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now).run();

  // ── Abort stale multipart sessions ─────────────────────────────────────────
  await deleteExpiredUploadSessions(env.DB, env, now);

  console.log('[lockbox-cron] Cleanup complete');
}

async function deleteExpiredSecrets(
  db: D1Database,
  env: Env,
  now: number,
): Promise<void> {
  while (true) {
    const rows = await db.prepare(
      `SELECT id, metadata
       FROM secrets
       WHERE expire != 0
         AND ? > (create_time + expire * 1000)
       LIMIT ${BATCH_SIZE}`,
    ).bind(now).all<SecretRow>();

    if (rows.results.length === 0) {
      break;
    }

    for (const row of rows.results) {
      await cleanupSecretAttachments(db, env, row.id, row.metadata);

      await Promise.all([
        db.prepare('DELETE FROM secret_recipients WHERE secret_id = ?').bind(row.id).run(),
        db.prepare('DELETE FROM invites WHERE secret_id = ?').bind(row.id).run(),
      ]);

      await db.prepare('DELETE FROM secrets WHERE id = ?').bind(row.id).run();
    }

    if (rows.results.length < BATCH_SIZE) {
      break;
    }
  }
}

async function cleanupSecretAttachments(
  db: D1Database,
  env: Env,
  secretId: string,
  metadataRaw: string,
): Promise<void> {
  const attachmentIds = extractAttachmentIds(metadataRaw);
  if (attachmentIds.length === 0) return;

  for (const attachmentId of attachmentIds) {
    const referencedElsewhere = await db.prepare(
      `SELECT id
       FROM secrets
       WHERE id != ?
         AND metadata LIKE ?
       LIMIT 1`,
    ).bind(secretId, `%"id":"${attachmentId}"%`).first<{ id: string }>();

    if (referencedElsewhere) continue;

    const fileRow = await db.prepare(
      `SELECT id, bucket_location AS bucketLocation, eu_jurisdiction AS euJurisdiction
       FROM files
       WHERE id = ?
       LIMIT 1`,
    ).bind(attachmentId).first<{ id: string; bucketLocation: string; euJurisdiction: number | boolean }>();

    if (!fileRow) continue;

    const bucket = fileRow.bucketLocation === 'eu' || Boolean(fileRow.euJurisdiction)
      ? env.BUCKET_EU
      : env.BUCKET_GLOBAL;

    await Promise.all([
      bucket.delete(fileRow.id).catch(() => {}),
      db.prepare('DELETE FROM files WHERE id = ?').bind(fileRow.id).run(),
    ]);
  }
}

function extractAttachmentIds(metadataRaw: string): string[] {
  try {
    const metadata = JSON.parse(metadataRaw) as { attachments?: Array<{ id?: unknown }> };
    if (!Array.isArray(metadata.attachments)) return [];

    return Array.from(new Set(
      metadata.attachments
        .map((entry) => entry?.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ));
  } catch {
    return [];
  }
}

async function deleteExpiredFiles(
  db: D1Database,
  env: Env,
  now: number,
): Promise<void> {
  while (true) {
    const rows = await db.prepare(
      `SELECT id, eu_jurisdiction AS euJurisdiction
       FROM files
       WHERE expire != 0
         AND ? > (create_time + expire * 1000)
       LIMIT ${BATCH_SIZE}`,
    ).bind(now).all<FileRow>();

    if (rows.results.length === 0) {
      break;
    }

    for (const row of rows.results) {
      const bucket = Boolean(row.euJurisdiction) ? env.BUCKET_EU : env.BUCKET_GLOBAL;
      await Promise.all([
        bucket.delete(row.id).catch(() => {}),
        db.prepare('DELETE FROM files WHERE id = ?').bind(row.id).run(),
      ]);
    }

    if (rows.results.length < BATCH_SIZE) {
      break;
    }
  }
}

async function deleteExpiredUploadSessions(
  db: D1Database,
  env: Env,
  now: number,
): Promise<void> {
  while (true) {
    const rows = await db.prepare(
      `SELECT id, object_key AS objectKey, upload_id AS uploadId, bucket_location AS bucketLocation
       FROM upload_sessions
       WHERE completed_at IS NULL AND expires_at < ?
       LIMIT ${BATCH_SIZE}`,
    ).bind(now).all<UploadSessionRow>();

    if (rows.results.length === 0) {
      break;
    }

    for (const row of rows.results) {
      const bucket = row.bucketLocation === 'eu' ? env.BUCKET_EU : env.BUCKET_GLOBAL;
      try {
        const upload = bucket.resumeMultipartUpload(row.objectKey, row.uploadId);
        await upload.abort();
      } catch {
        // Best effort cleanup; stale remote state should not block local cleanup.
      }

      await db.prepare('DELETE FROM upload_sessions WHERE id = ?').bind(row.id).run();
    }

    if (rows.results.length < BATCH_SIZE) {
      break;
    }
  }
}
