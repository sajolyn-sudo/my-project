ALTER TABLE users
  ADD COLUMN username VARCHAR(64) NULL AFTER email;

UPDATE users
SET username = LOWER(
  COALESCE(
    NULLIF(TRIM(ismis), ''),
    SUBSTRING_INDEX(email, '@', 1)
  )
)
WHERE username IS NULL OR TRIM(username) = '';

CREATE INDEX idx_users_username ON users (username);
