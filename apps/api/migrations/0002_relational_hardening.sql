PRAGMA foreign_keys=OFF;

-- Rebuild secret_recipients with FK cascade to secrets.
ALTER TABLE secret_recipients RENAME TO secret_recipients_old;

CREATE TABLE secret_recipients (
  id               TEXT    PRIMARY KEY,
  secret_id        TEXT    NOT NULL,
  recipient_email  TEXT    NOT NULL,
  normalized_email TEXT    NOT NULL,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL,
  FOREIGN KEY (secret_id) REFERENCES secrets(id) ON DELETE CASCADE
);

INSERT INTO secret_recipients (id, secret_id, recipient_email, normalized_email, created_at, updated_at)
SELECT old.id, old.secret_id, old.recipient_email, old.normalized_email, old.created_at, old.updated_at
FROM secret_recipients_old old
JOIN secrets s ON s.id = old.secret_id;

DROP TABLE secret_recipients_old;

CREATE INDEX IF NOT EXISTS idx_secret_recipients_secret_id
  ON secret_recipients (secret_id);

CREATE INDEX IF NOT EXISTS idx_secret_recipients_normalized_email
  ON secret_recipients (normalized_email);

-- Rebuild invites with optional FK cascade to secrets.
ALTER TABLE invites RENAME TO invites_old;

CREATE TABLE invites (
  id            TEXT    PRIMARY KEY,
  inviter_id    TEXT    NOT NULL,
  inviter_email TEXT    NOT NULL,
  invitee_email TEXT,
  token         TEXT    NOT NULL UNIQUE,
  secret_id     TEXT,
  max_uses      INTEGER NOT NULL DEFAULT 1,
  uses          INTEGER NOT NULL DEFAULT 0,
  expires_at    INTEGER,
  created_at    INTEGER NOT NULL,
  FOREIGN KEY (secret_id) REFERENCES secrets(id) ON DELETE CASCADE
);

INSERT INTO invites (id, inviter_id, inviter_email, invitee_email, token, secret_id, max_uses, uses, expires_at, created_at)
SELECT
  old.id,
  old.inviter_id,
  old.inviter_email,
  old.invitee_email,
  old.token,
  CASE
    WHEN old.secret_id IS NULL THEN NULL
    WHEN EXISTS (SELECT 1 FROM secrets s WHERE s.id = old.secret_id) THEN old.secret_id
    ELSE NULL
  END,
  old.max_uses,
  old.uses,
  old.expires_at,
  old.created_at
FROM invites_old old;

DROP TABLE invites_old;

CREATE INDEX IF NOT EXISTS idx_invites_token
  ON invites (token);

CREATE INDEX IF NOT EXISTS idx_invites_inviter_id
  ON invites (inviter_id);

PRAGMA foreign_keys=ON;
