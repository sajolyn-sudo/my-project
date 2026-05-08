ALTER TABLE users
  ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN archived_at DATETIME NULL,
  ADD COLUMN archive_reason VARCHAR(120) NULL;

CREATE INDEX idx_users_is_archived ON users (is_archived);
