CREATE TABLE IF NOT EXISTS secret_recipients (
  id               TEXT    PRIMARY KEY,
  secret_id        TEXT    NOT NULL,
  recipient_email  TEXT    NOT NULL,
  normalized_email TEXT    NOT NULL,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS upload_sessions (
  id              TEXT    PRIMARY KEY,
  file_id         TEXT    NOT NULL,
  object_key      TEXT    NOT NULL,
  upload_id       TEXT    NOT NULL,
  bucket_location TEXT    NOT NULL DEFAULT 'global',
  eu_jurisdiction INTEGER NOT NULL DEFAULT 0,
  created_by      TEXT    NOT NULL,
  metadata        TEXT    NOT NULL,
  expires_at      INTEGER NOT NULL,
  created_at      INTEGER NOT NULL,
  completed_at    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_secret_recipients_secret_id
  ON secret_recipients (secret_id);

CREATE INDEX IF NOT EXISTS idx_secret_recipients_normalized_email
  ON secret_recipients (normalized_email);

CREATE INDEX IF NOT EXISTS idx_upload_sessions_file_id
  ON upload_sessions (file_id);

CREATE INDEX IF NOT EXISTS idx_upload_sessions_expires_at
  ON upload_sessions (expires_at);

CREATE INDEX IF NOT EXISTS idx_upload_sessions_created_by
  ON upload_sessions (created_by);