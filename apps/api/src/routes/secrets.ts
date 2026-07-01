import { Hono } from 'hono';
import type { Context } from 'hono';
import { eq, inArray, and, like, ne } from 'drizzle-orm';
import type { HonoEnv } from '@lockbox/types/auth';
import type {
  CreateSecretBody,
  SecretAccessConfig,
  SecretAttachment,
  SecretEncryptionEnvelope,
  SecretRecipient,
  UpdateSecretBody,
  UpdateSecretAccessBody,
} from '@lockbox/types/api';
import { requireAuth } from '../auth/middleware.js';
import { createDB, schema } from '../db/index.js';
import {
  buildRecipientSessionCookie,
  getRecipientSessionTtlSeconds,
  isValidRecipientEmail,
  issueRecipientOtp,
  normalizeRecipientEmail,
  readRecipientSessionEmail,
  verifyRecipientOtp,
} from '../auth/recipient.js';
import { nanoid } from '../utils/nanoid.js';

export const secretRoutes = new Hono<HonoEnv>();

// ---------------------------------------------------------------------------
// POST /api/secrets — create a secret (employees only)
// ---------------------------------------------------------------------------
secretRoutes.post('/', requireAuth, async (c) => {
  const user = c.get('user')!;
  let body: CreateSecretBody;

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const {
    content,
    expire = 0,
    euJurisdiction = false,
    attachments = [],
    recipients = [],
    encryption = null,
  } = body;

  const normalizedContent = (content ?? '').trim();
  const hasContent = normalizedContent.length > 0;
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

  if (!hasContent && !hasAttachments) {
    return c.json({ error: 'Provide text content, attachments, or both' }, 400);
  }
  if (normalizedContent.length > 1_000_000) {
    return c.json({ error: 'content exceeds 1 MB limit' }, 413);
  }

  const id = nanoid();
  const now = Date.now();
  const editToken = `${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`;
  const editTokenHash = await sha256Hex(editToken);

  const db = createDB(c.env);

  let validatedAttachments: SecretAttachment[] = [];
  if (hasAttachments) {
    const uniqueIds = Array.from(new Set(attachments.map((a) => a.id).filter(Boolean)));
    if (uniqueIds.length !== attachments.length) {
      return c.json({ error: 'Duplicate attachment id detected' }, 400);
    }

    const rows = await db.query.files.findMany({
      where: (t) => and(eq(t.createdBy, user.id), inArray(t.id, uniqueIds)),
    });

    if (rows.length !== uniqueIds.length) {
      return c.json({ error: 'One or more attachments are invalid or not owned by user' }, 400);
    }

    const rowMap = new Map(rows.map((r) => [r.id, r]));
    validatedAttachments = attachments.map((item) => {
      const row = rowMap.get(item.id)!;
      return {
        id: item.id,
        url: `${c.env.BASE_URL}/f/${item.id}`,
        name: row.content,
        size: Number(item.size) || 0,
        mimeType: row.mimeType || item.mimeType || 'application/octet-stream',
      };
    });
  }

  const validatedRecipients = validateRecipientInputs(recipients, true);
  if (validatedRecipients.error) {
    return c.json({ error: validatedRecipients.error }, 400);
  }

  const metadata: Record<string, unknown> = { createTime: now };
  if (encryption) {
    metadata.encryption = encryption;
  }
  metadata.editTokenHash = editTokenHash;
  if (validatedAttachments.length > 0) {
    metadata.attachments = validatedAttachments;
  }

  await db.insert(schema.secrets).values({
    id,
    content: normalizedContent,
    expire,
    createTime: now,
    metadata: JSON.stringify(metadata),
    createdBy: user.id,
    euJurisdiction: euJurisdiction ? 1 : 0,
  });

  await db.insert(schema.secretRecipients).values(
    validatedRecipients.value.map((recipient) => ({
      id: crypto.randomUUID(),
      secretId: id,
      recipientEmail: recipient.email,
      normalizedEmail: recipient.normalizedEmail,
      createdAt: now,
      updatedAt: now,
    })),
  );

  return c.json({
    id,
    url: `${c.env.BASE_URL}/${id}`,
    editToken,
    euJurisdiction,
    attachments: validatedAttachments,
  });
});

// ---------------------------------------------------------------------------
// GET /api/secrets/:id — retrieve a secret (public)
// ---------------------------------------------------------------------------
secretRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'id is required' }, 400);

  const db = createDB(c.env);
  const row = await db.query.secrets.findFirst({
    where: eq(schema.secrets.id, id),
  });

  if (!row) return c.json({ error: 'Not found' }, 404);

  // Expiry check
  if (row.expire && Date.now() > row.createTime + row.expire * 1000) {
    await deleteSecretCascade(db, c.env, id, row.metadata);
    return c.json({ error: 'Secret expired', code: 410 }, 410);
  }

  const meta = JSON.parse(row.metadata) as Record<string, unknown>;
  const recipients = await db.query.secretRecipients.findMany({
    where: eq(schema.secretRecipients.secretId, id),
  });
  const attachments = Array.isArray(meta.attachments)
    ? (meta.attachments as SecretAttachment[])
    : [];
  const encryption = isSecretEncryptionEnvelope(meta.encryption) ? meta.encryption : null;

  if (recipients.length > 0) {
    const isCreator = c.get('user')?.id === row.createdBy;
    if (isCreator) {
      return c.json({
        id: row.id,
        content: row.content,
        expire: row.expire,
        euJurisdiction: Boolean(row.euJurisdiction),
        createTime: row.createTime,
        url: `${c.env.BASE_URL}/${id}`,
        attachments,
        encryption,
      });
    }

    const normalizedUserEmail = c.get('user')?.email
      ? normalizeRecipientEmail(c.get('user')!.email)
      : null;
    let recipientCookieEmail: string | null = null;
    try {
      recipientCookieEmail = await readRecipientSessionEmail(
        c.req.header('Cookie') ?? '',
        id,
        c.env.SESSION_SECRET,
      );
    } catch (error) {
      console.error('Recipient session validation failed', error);
      return c.json({
        error: 'Recipient authentication is temporarily unavailable',
        code: 503,
      }, 503);
    }
    const recipientEmails = new Set(recipients.map((recipient) => recipient.normalizedEmail));
    const canAccess = (normalizedUserEmail && recipientEmails.has(normalizedUserEmail))
      || (recipientCookieEmail && recipientEmails.has(recipientCookieEmail));

    if (!canAccess) {
      return c.json({
        error: 'Recipient verification required',
        code: 403,
        access: {
          recipientAuthRequired: true,
          encrypted: Boolean(encryption),
        },
      }, 403);
    }
  }

  return c.json({
    id: row.id,
    content: row.content,
    expire: row.expire,
    euJurisdiction: Boolean(row.euJurisdiction),
    createTime: row.createTime,
    url: `${c.env.BASE_URL}/${id}`,
    attachments,
    encryption,
  });
});

// ---------------------------------------------------------------------------
// GET /api/secrets/:id/access — manage recipients/access settings
// ---------------------------------------------------------------------------
secretRoutes.get('/:id/access', async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'id is required' }, 400);

  const accessContext = await getSecretWithEditAccess(c, id);
  if ('response' in accessContext) {
    return accessContext.response;
  }

  const { row, meta, recipients } = accessContext;
  const response: SecretAccessConfig = {
    recipients: recipients.map(mapRecipientRow),
    encryption: isSecretEncryptionEnvelope(meta.encryption) ? meta.encryption : null,
  };

  return c.json({
    secretId: row.id,
    ...response,
  });
});

// ---------------------------------------------------------------------------
// PUT /api/secrets/:id/access — update recipients/access settings
// ---------------------------------------------------------------------------
secretRoutes.put('/:id/access', async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'id is required' }, 400);

  const accessContext = await getSecretWithEditAccess(c, id);
  if ('response' in accessContext) {
    return accessContext.response;
  }

  let body: UpdateSecretAccessBody;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const validatedRecipients = validateRecipientInputs(body.recipients ?? [], true);
  if (validatedRecipients.error) {
    return c.json({ error: validatedRecipients.error }, 400);
  }

  const nextMeta: Record<string, unknown> = { ...accessContext.meta };
  if (body.encryption === null) {
    delete nextMeta.encryption;
  } else if (body.encryption) {
    nextMeta.encryption = body.encryption;
  }

  const now = Date.now();
  await accessContext.db.update(schema.secrets)
    .set({ metadata: JSON.stringify(nextMeta) })
    .where(eq(schema.secrets.id, id));

  await accessContext.db.delete(schema.secretRecipients).where(eq(schema.secretRecipients.secretId, id));
  await accessContext.db.insert(schema.secretRecipients).values(
    validatedRecipients.value.map((recipient) => ({
      id: crypto.randomUUID(),
      secretId: id,
      recipientEmail: recipient.email,
      normalizedEmail: recipient.normalizedEmail,
      createdAt: now,
      updatedAt: now,
    })),
  );

  return c.json({
    secretId: id,
    recipients: validatedRecipients.value.map((recipient) => ({
      id: crypto.randomUUID(),
      email: recipient.email,
      normalizedEmail: recipient.normalizedEmail,
      createdAt: now,
      updatedAt: now,
    })),
    encryption: isSecretEncryptionEnvelope(nextMeta.encryption) ? nextMeta.encryption : null,
  });
});

// ---------------------------------------------------------------------------
// POST /api/secrets/:id/otp/send — send recipient OTP
// ---------------------------------------------------------------------------
secretRoutes.post('/:id/otp/send', async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'id is required' }, 400);

  const db = createDB(c.env);
  const row = await db.query.secrets.findFirst({
    where: eq(schema.secrets.id, id),
    columns: { id: true, expire: true, createTime: true },
  });
  if (!row) return c.json({ error: 'Not found' }, 404);
  if (row.expire && Date.now() > row.createTime + row.expire * 1000) {
    await deleteSecretCascade(db, c.env, id);
    return c.json({ error: 'Secret expired', code: 410 }, 410);
  }

  let body: { email?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const email = body.email ?? '';
  if (!isValidRecipientEmail(email)) {
    return c.json({ error: 'Valid recipient email is required' }, 400);
  }

  const normalizedEmail = normalizeRecipientEmail(email);
  const recipient = await db.query.secretRecipients.findFirst({
    where: and(
      eq(schema.secretRecipients.secretId, id),
      eq(schema.secretRecipients.normalizedEmail, normalizedEmail),
    ),
  });

  if (!recipient) {
    return c.json({ error: 'Recipient verification failed', code: 403 }, 403);
  }

  const otp = await issueRecipientOtp(c.env.PKCE_KV, id, normalizedEmail);
  if ('error' in otp) {
    return c.json({
      error: 'Too many verification attempts',
      code: 429,
      retryAfterSeconds: otp.retryAfterSeconds,
    }, 429);
  }

  const response = await c.env.EMAIL_WORKER.fetch('https://email-worker.internal/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: 'recipient-otp',
      to: recipient.recipientEmail,
      otpCode: otp.code,
      expiresInMinutes: Math.ceil(otp.expiresInSeconds / 60),
    }),
  });

  if (!response.ok) {
    return c.json({ error: 'Failed to send verification email', code: 502 }, 502);
  }

  return c.json({ ok: true, expiresInSeconds: otp.expiresInSeconds });
});

// ---------------------------------------------------------------------------
// POST /api/secrets/:id/otp/verify — verify recipient OTP and mint session
// ---------------------------------------------------------------------------
secretRoutes.post('/:id/otp/verify', async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'id is required' }, 400);

  let body: { email?: string; otp?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const email = body.email ?? '';
  const otp = body.otp ?? '';
  if (!isValidRecipientEmail(email) || otp.trim().length < 6) {
    return c.json({ error: 'Valid email and code are required' }, 400);
  }

  const normalizedEmail = normalizeRecipientEmail(email);
  const db = createDB(c.env);
  const recipient = await db.query.secretRecipients.findFirst({
    where: and(
      eq(schema.secretRecipients.secretId, id),
      eq(schema.secretRecipients.normalizedEmail, normalizedEmail),
    ),
  });
  if (!recipient) {
    return c.json({ error: 'Recipient verification failed', code: 403 }, 403);
  }

  const result = await verifyRecipientOtp(c.env.PKCE_KV, id, normalizedEmail, otp);
  if (!result.ok) {
    const status = result.error === 'too_many_attempts' ? 429 : 403;
    const message = result.error === 'expired'
      ? 'Verification code expired'
      : result.error === 'too_many_attempts'
        ? 'Too many verification attempts'
        : 'Invalid verification code';
    return c.json({ error: message, code: status }, status);
  }

  const secure = c.env.ENVIRONMENT === 'production';
  let cookie: string;
  try {
    cookie = await buildRecipientSessionCookie(id, normalizedEmail, c.env.SESSION_SECRET, secure);
  } catch (error) {
    console.error('Recipient session cookie minting failed', error);
    return c.json({
      error: 'Recipient authentication is temporarily unavailable',
      code: 503,
    }, 503);
  }

  return new Response(JSON.stringify({ ok: true, expiresInSeconds: getRecipientSessionTtlSeconds() }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookie,
    },
  });
});

// ---------------------------------------------------------------------------
// PUT /api/secrets/:id — update a secret (edit session required)
// ---------------------------------------------------------------------------
secretRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  let body: UpdateSecretBody;

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  const hasContent = content.length > 0;
  const hasAttachments = attachments.length > 0;
  if (!hasContent && !hasAttachments) {
    return c.json({ error: 'Provide text content, attachments, or both' }, 400);
  }
  if (content.length > 1_000_000) {
    return c.json({ error: 'content exceeds 1 MB limit' }, 413);
  }

  const expire = typeof body.expire === 'number' && body.expire > 0
    ? Math.floor(body.expire)
    : 0;
  const encryption = body.encryption === null || isSecretEncryptionEnvelope(body.encryption)
    ? body.encryption
    : undefined;

  const db = createDB(c.env);
  const row = await db.query.secrets.findFirst({
    where: eq(schema.secrets.id, id),
    columns: { id: true, content: true, metadata: true, createdBy: true },
  });

  if (!row) return c.json({ error: 'Not found' }, 404);

  const existingMeta = JSON.parse(row.metadata) as Record<string, unknown>;
  const editTokenHash = typeof existingMeta.editTokenHash === 'string' ? existingMeta.editTokenHash : null;
  const editCookieName = getEditCookieName(id);
  const editToken = parseCookie(c.req.header('Cookie') ?? '', editCookieName);

  if (!editTokenHash || !editToken) {
    return c.json({ error: 'Edit session required', code: 403 }, 403);
  }

  const providedHash = await sha256Hex(editToken);
  if (!(await timingSafeEqual(editTokenHash, providedHash))) {
    return c.json({ error: 'Invalid edit session', code: 403 }, 403);
  }

  const existingAttachments = Array.isArray(existingMeta.attachments)
    ? (existingMeta.attachments as SecretAttachment[])
    : [];
  const existingAttachmentById = new Map(existingAttachments.map((item) => [item.id, item]));
  const now = Date.now();

  let validatedAttachments: SecretAttachment[] = [];
  if (attachments.length > 0) {
    const uniqueIds = Array.from(new Set(attachments.map((item) => item.id).filter(Boolean)));
    if (uniqueIds.length !== attachments.length) {
      return c.json({ error: 'Duplicate attachment id detected' }, 400);
    }

    const currentUserId = c.get('user')?.id;
    const newAttachmentIds = uniqueIds.filter((attachmentId) => !existingAttachmentById.has(attachmentId));
    const hasNewAttachments = newAttachmentIds.length > 0;

    if (hasNewAttachments && !currentUserId) {
      return c.json({ error: 'Sign in again to attach new files' }, 401);
    }

    let newAttachmentRowMap = new Map<string, typeof schema.files.$inferSelect>();
    if (newAttachmentIds.length > 0) {
      const fileRows = await db.query.files.findMany(
        currentUserId
          ? {
            where: (t) => and(
              inArray(t.id, newAttachmentIds),
              eq(t.createdBy, currentUserId),
            ),
          }
          : {
            where: (t) => inArray(t.id, newAttachmentIds),
          },
      );

      if (fileRows.length !== newAttachmentIds.length) {
        return c.json({ error: 'One or more attachments are invalid or not owned by user' }, 400);
      }

      newAttachmentRowMap = new Map(fileRows.map((fileRow) => [fileRow.id, fileRow]));
    }

    validatedAttachments = attachments.map((item) => {
      const existing = existingAttachmentById.get(item.id);
      if (existing) {
        return {
          ...existing,
          url: `${c.env.BASE_URL}/f/${existing.id}`,
        };
      }

      const fileRow = newAttachmentRowMap.get(item.id)!;
      return {
        id: item.id,
        url: `${c.env.BASE_URL}/f/${item.id}`,
        name: fileRow.content,
        size: Number(item.size) || 0,
        mimeType: fileRow.mimeType || item.mimeType || 'application/octet-stream',
      };
    });
  }

  const nextMeta: Record<string, unknown> = {
    ...existingMeta,
    updateTime: now,
  };
  if (validatedAttachments.length > 0) {
    nextMeta.attachments = validatedAttachments;
  } else {
    delete nextMeta.attachments;
  }
  if (encryption === null) {
    delete nextMeta.encryption;
  } else if (encryption) {
    nextMeta.encryption = encryption;
  }

  await db.update(schema.secrets).set({
    content,
    expire,
    metadata: JSON.stringify(nextMeta),
  }).where(eq(schema.secrets.id, id));
  return c.json({ id, url: `${c.env.BASE_URL}/${id}` });
});

// ---------------------------------------------------------------------------
// DELETE /api/secrets/:id — delete a secret (edit session required)
// ---------------------------------------------------------------------------
secretRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'id is required' }, 400);

  const db = createDB(c.env);
  const row = await db.query.secrets.findFirst({
    where: eq(schema.secrets.id, id),
    columns: { id: true, metadata: true },
  });

  if (!row) return c.json({ error: 'Not found' }, 404);

  const meta = JSON.parse(row.metadata) as Record<string, unknown>;
  const editTokenHash = typeof meta.editTokenHash === 'string' ? meta.editTokenHash : null;
  const editCookieName = getEditCookieName(id);
  const editToken = parseCookie(c.req.header('Cookie') ?? '', editCookieName);

  if (!editTokenHash || !editToken) {
    return c.json({ error: 'Edit session required', code: 403 }, 403);
  }

  const providedHash = await sha256Hex(editToken);
  if (!(await timingSafeEqual(editTokenHash, providedHash))) {
    return c.json({ error: 'Invalid edit session', code: 403 }, 403);
  }

  await deleteSecretCascade(db, c.env, id, row.metadata);
  return c.json({ id, deleted: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** SHA-256-based constant-time string comparison */
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

async function sha256Hex(value: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function validateRecipientInputs(recipients: Array<{ email: string }>, requireAtLeastOne = false) {
  const normalized = new Map<string, { email: string; normalizedEmail: string }>();

  for (const recipient of recipients) {
    if (!recipient?.email || !isValidRecipientEmail(recipient.email)) {
      return { error: 'All recipients must have a valid email address', value: [] as Array<{ email: string; normalizedEmail: string }> };
    }
    const normalizedEmail = normalizeRecipientEmail(recipient.email);
    if (!normalized.has(normalizedEmail)) {
      normalized.set(normalizedEmail, {
        email: recipient.email.trim(),
        normalizedEmail,
      });
    }
  }

  if (requireAtLeastOne && normalized.size === 0) {
    return { error: 'At least one recipient email is required', value: [] as Array<{ email: string; normalizedEmail: string }> };
  }

  return { error: null, value: Array.from(normalized.values()) };
}

function isSecretEncryptionEnvelope(value: unknown): value is SecretEncryptionEnvelope {
  if (!value || typeof value !== 'object') return false;
  const envelope = value as Partial<SecretEncryptionEnvelope>;
  return envelope.version === 1 && envelope.algorithm === 'AES-GCM' && envelope.keySource === 'fragment';
}

function mapRecipientRow(row: typeof schema.secretRecipients.$inferSelect): SecretRecipient {
  return {
    id: row.id,
    email: row.recipientEmail,
    normalizedEmail: row.normalizedEmail,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function getSecretWithEditAccess(c: Context<HonoEnv>, id: string) {
  const db = createDB(c.env);
  const row = await db.query.secrets.findFirst({
    where: eq(schema.secrets.id, id),
    columns: { id: true, metadata: true },
  });

  if (!row) {
    return { response: c.json({ error: 'Not found' }, 404) };
  }

  const meta = JSON.parse(row.metadata) as Record<string, unknown>;
  const editTokenHash = typeof meta.editTokenHash === 'string' ? meta.editTokenHash : null;
  const editCookieName = getEditCookieName(id);
  const editToken = parseCookie(c.req.header('Cookie') ?? '', editCookieName);

  if (!editTokenHash || !editToken) {
    return { response: c.json({ error: 'Edit session required', code: 403 }, 403) };
  }

  const providedHash = await sha256Hex(editToken);
  if (!(await timingSafeEqual(editTokenHash, providedHash))) {
    return { response: c.json({ error: 'Invalid edit session', code: 403 }, 403) };
  }

  const recipients = await db.query.secretRecipients.findMany({
    where: eq(schema.secretRecipients.secretId, id),
  });

  return { db, row, meta, recipients };
}


function getEditCookieName(secretId: string): string {
  return `lb_edit_${secretId}`;
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

export async function deleteSecretCascade(
  db: ReturnType<typeof createDB>,
  env: HonoEnv['Bindings'],
  secretId: string,
  metadataRaw?: string,
): Promise<void> {
  const resolvedMetadata = typeof metadataRaw === 'string'
    ? metadataRaw
    : (await db.query.secrets.findFirst({
      where: eq(schema.secrets.id, secretId),
      columns: { metadata: true },
    }))?.metadata;

  if (resolvedMetadata) {
    await cleanupSecretAttachments(db, env, secretId, resolvedMetadata);
  }

  await Promise.all([
    db.delete(schema.secretRecipients).where(eq(schema.secretRecipients.secretId, secretId)),
    db.delete(schema.invites).where(eq(schema.invites.secretId, secretId)),
  ]);

  await db.delete(schema.secrets).where(eq(schema.secrets.id, secretId));
}

async function cleanupSecretAttachments(
  db: ReturnType<typeof createDB>,
  env: HonoEnv['Bindings'],
  secretId: string,
  metadataRaw: string,
): Promise<void> {
  const attachmentIds = extractAttachmentIds(metadataRaw);
  if (attachmentIds.length === 0) return;

  for (const attachmentId of attachmentIds) {
    const referencedByOtherSecret = await db.query.secrets.findFirst({
      where: and(
        ne(schema.secrets.id, secretId),
        like(schema.secrets.metadata, `%\"id\":\"${attachmentId}\"%`),
      ),
      columns: { id: true },
    });

    if (referencedByOtherSecret) continue;

    const fileRow = await db.query.files.findFirst({
      where: eq(schema.files.id, attachmentId),
      columns: {
        id: true,
        bucketLocation: true,
        euJurisdiction: true,
      },
    });

    if (!fileRow) continue;

    const bucket = fileRow.bucketLocation === 'eu' || Boolean(fileRow.euJurisdiction)
      ? env.BUCKET_EU
      : env.BUCKET_GLOBAL;

    await Promise.all([
      bucket.delete(fileRow.id).catch(() => {}),
      db.delete(schema.files).where(eq(schema.files.id, fileRow.id)),
    ]);
  }
}

function extractAttachmentIds(metadataRaw: string): string[] {
  try {
    const metadata = JSON.parse(metadataRaw) as Record<string, unknown>;
    if (!Array.isArray(metadata.attachments)) return [];

    return Array.from(new Set(
      metadata.attachments
        .map((entry) => (entry && typeof entry === 'object' ? (entry as { id?: unknown }).id : null))
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ));
  } catch {
    return [];
  }
}
