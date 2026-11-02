CREATE TABLE certificate_deliveries (
  registration_id TEXT PRIMARY KEY REFERENCES registrations(id),
  status TEXT NOT NULL CHECK(status IN ('pending','sending','sent','failed')),
  first_attempt_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  sent_at INTEGER,
  provider_id TEXT,
  last_error TEXT NOT NULL DEFAULT ''
);
