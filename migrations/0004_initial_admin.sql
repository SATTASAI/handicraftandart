-- One-time, explicitly authorized administrator assignment for an existing account.
-- This does not grant administrator rights during registration or create an account.
CREATE TABLE IF NOT EXISTS system_setup (
  key TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL
);

UPDATE users
SET role = 'admin'
WHERE email = 'sattawat.imc@gmail.com';

INSERT INTO system_setup (key, user_id)
SELECT 'initial_admin', id FROM users WHERE email = 'sattawat.imc@gmail.com'
ON CONFLICT(key) DO UPDATE SET user_id = excluded.user_id;
