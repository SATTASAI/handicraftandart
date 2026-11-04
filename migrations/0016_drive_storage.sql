-- Additive: ID-card images and certificate PDFs may live in Google Drive.
-- A document stored in Drive keeps its row (owner, type, size) with an empty
-- data blob and the Drive file id; rows without drive_file_id stay in D1.
ALTER TABLE registration_documents ADD COLUMN drive_file_id TEXT;
CREATE TABLE certificate_files (unit_key TEXT PRIMARY KEY,competition_id TEXT NOT NULL REFERENCES event_competitions(id),fingerprint TEXT NOT NULL,drive_file_id TEXT NOT NULL,size INTEGER NOT NULL,created_by TEXT REFERENCES account_users(id),created_at INTEGER NOT NULL);
CREATE INDEX certificate_files_competition ON certificate_files(competition_id);
