import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

/**
 * Secrets table: stores encrypted pastebin secrets with optional expiration
 */
export const secrets = sqliteTable(
  'secrets',
  {
    id: text('id').primaryKey(),
    content: text('content').notNull(),
    expire: integer('expire').notNull().default(0),
    createTime: integer('create_time').notNull(),
    metadata: text('metadata').notNull(),
    createdBy: text('created_by'),
    euJurisdiction: integer('eu_jurisdiction').notNull().default(0),
    inviteId: text('invite_id'),
  },
  (table) => ({
    createdByIdx: index('idx_secrets_created_by').on(table.createdBy),
  })
);

/**
 * Files table: stores file uploads with optional expiration
 */
export const files = sqliteTable(
  'files',
  {
    id: text('id').primaryKey(),
    content: text('content').notNull(),
    expire: integer('expire').notNull().default(0),
    mimeType: text('mime_type').notNull().default('application/octet-stream'),
    createTime: integer('create_time').notNull(),
    metadata: text('metadata').notNull(),
    createdBy: text('created_by'),
    euJurisdiction: integer('eu_jurisdiction').notNull().default(0),
    bucketLocation: text('bucket_location').notNull().default('global'),
    inviteId: text('invite_id'),
  },
  (table) => ({
    createdByIdx: index('idx_files_created_by').on(table.createdBy),
  })
);

/**
 * Sessions table: stores user session tokens
 */
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    userEmail: text('user_email').notNull(),
    userName: text('user_name'),
    expiresAt: integer('expires_at').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => ({
    expiresAtIdx: index('idx_sessions_expires_at').on(table.expiresAt),
  })
);

/**
 * Secret recipients: allowed viewers for recipient-gated secrets
 */
export const secretRecipients = sqliteTable(
  'secret_recipients',
  {
    id: text('id').primaryKey(),
    secretId: text('secret_id').notNull().references(() => secrets.id, { onDelete: 'cascade' }),
    recipientEmail: text('recipient_email').notNull(),
    normalizedEmail: text('normalized_email').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => ({
    secretIdIdx: index('idx_secret_recipients_secret_id').on(table.secretId),
    normalizedEmailIdx: index('idx_secret_recipients_normalized_email').on(table.normalizedEmail),
  })
);

/**
 * Multipart/direct upload sessions for large encrypted attachments
 */
export const uploadSessions = sqliteTable(
  'upload_sessions',
  {
    id: text('id').primaryKey(),
    fileId: text('file_id').notNull(),
    objectKey: text('object_key').notNull(),
    uploadId: text('upload_id').notNull(),
    bucketLocation: text('bucket_location').notNull().default('global'),
    euJurisdiction: integer('eu_jurisdiction').notNull().default(0),
    createdBy: text('created_by').notNull(),
    metadata: text('metadata').notNull(),
    expiresAt: integer('expires_at').notNull(),
    createdAt: integer('created_at').notNull(),
    completedAt: integer('completed_at'),
  },
  (table) => ({
    fileIdIdx: index('idx_upload_sessions_file_id').on(table.fileId),
    expiresAtIdx: index('idx_upload_sessions_expires_at').on(table.expiresAt),
    createdByIdx: index('idx_upload_sessions_created_by').on(table.createdBy),
  })
);

/**
 * Invites table: stores share invitations with token tracking
 */
export const invites = sqliteTable(
  'invites',
  {
    id: text('id').primaryKey(),
    inviterId: text('inviter_id').notNull(),
    inviterEmail: text('inviter_email').notNull(),
    inviteeEmail: text('invitee_email'),
    token: text('token').notNull().unique(),
    secretId: text('secret_id').references(() => secrets.id, { onDelete: 'cascade' }),
    maxUses: integer('max_uses').notNull().default(1),
    uses: integer('uses').notNull().default(0),
    expiresAt: integer('expires_at'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => ({
    tokenIdx: index('idx_invites_token').on(table.token),
    inviterIdIdx: index('idx_invites_inviter_id').on(table.inviterId),
  })
);
