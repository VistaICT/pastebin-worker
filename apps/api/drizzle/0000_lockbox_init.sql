-- Lockbox initial schema
-- Lockbox database schema (secrets, files, sessions, invites)

CREATE TABLE IF NOT EXISTS secrets (
  id              TEXT    PRIMARY KEY,
  content         TEXT    NOT NULL,
  expire          INTEGER NOT NULL DEFAULT 0,
  create_time     INTEGER NOT NULL,
  metadata        TEXT    NOT NULL,
  created_by      TEXT,
  eu_jurisdiction INTEGER NOT NULL DEFAULT 0,
  invite_id       TEXT
);

CREATE TABLE IF NOT EXISTS files (
  id              TEXT    PRIMARY KEY,
  content         TEXT    NOT NULL,
  expire          INTEGER NOT NULL DEFAULT 0,
  mime_type       TEXT    NOT NULL DEFAULT 'application/octet-stream',
  create_time     INTEGER NOT NULL,
  metadata        TEXT    NOT NULL,
  created_by      TEXT,
  eu_jurisdiction INTEGER NOT NULL DEFAULT 0,
  bucket_location TEXT    NOT NULL DEFAULT 'global',
  invite_id       TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT    PRIMARY KEY,
  user_id     TEXT    NOT NULL,
  user_email  TEXT    NOT NULL,
  user_name   TEXT,
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS invites (
  id            TEXT    PRIMARY KEY,
  inviter_id    TEXT    NOT NULL,
  inviter_email TEXT    NOT NULL,
  invitee_email TEXT,
  token         TEXT    NOT NULL UNIQUE,
  secret_id     TEXT,
  max_uses      INTEGER NOT NULL DEFAULT 1,
  uses          INTEGER NOT NULL DEFAULT 0,
  expires_at    INTEGER,
  created_at    INTEGER NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at   ON sessions   (expires_at);
CREATE INDEX IF NOT EXISTS idx_secrets_created_by    ON secrets    (created_by);
CREATE INDEX IF NOT EXISTS idx_files_created_by      ON files      (created_by);
CREATE INDEX IF NOT EXISTS idx_invites_token         ON invites    (token);
CREATE INDEX IF NOT EXISTS idx_invites_inviter_id    ON invites    (inviter_id);
