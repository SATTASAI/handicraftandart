CREATE TABLE account_users ( id TEXT PRIMARY KEY, name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 100), school TEXT NOT NULL CHECK(length(school) BETWEEN 2 AND 150), email TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(email=lower(trim(email))), password_hash TEXT NOT NULL, is_coach INTEGER NOT NULL CHECK(is_coach IN (0,1)), is_judge INTEGER NOT NULL CHECK(is_judge IN (0,1)), is_superadmin INTEGER NOT NULL DEFAULT 0 CHECK(is_superadmin IN (0,1)), created_at INTEGER NOT NULL, CHECK(is_coach=1 OR is_judge=1) );
CREATE UNIQUE INDEX account_single_superadmin ON account_users(is_superadmin) WHERE is_superadmin=1;
CREATE TABLE account_bootstrap ( id INTEGER PRIMARY KEY CHECK(id=1), user_id TEXT NOT NULL UNIQUE REFERENCES account_users(id) ON DELETE RESTRICT, created_at INTEGER NOT NULL );
CREATE TABLE account_sessions ( token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES account_users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL );
CREATE INDEX account_sessions_expiry ON account_sessions(expires_at);
CREATE TABLE account_limits ( key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, resets_at INTEGER NOT NULL );
CREATE TRIGGER account_superadmin_immutable BEFORE UPDATE OF is_superadmin ON account_users WHEN OLD.is_superadmin<>NEW.is_superadmin BEGIN SELECT RAISE(ABORT,'superadmin assignment is immutable'); END;
