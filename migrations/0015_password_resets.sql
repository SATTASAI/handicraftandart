CREATE TABLE account_password_resets ( token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES account_users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL );
CREATE INDEX account_password_resets_user ON account_password_resets(user_id);
CREATE INDEX account_password_resets_expiry ON account_password_resets(expires_at);
