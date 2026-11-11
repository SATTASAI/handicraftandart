CREATE TABLE admin_trash (id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('competition','registration','score','user')),label TEXT NOT NULL,payload TEXT NOT NULL CHECK(json_valid(payload)),deleted_by TEXT NOT NULL,deleted_at INTEGER NOT NULL);
CREATE INDEX admin_trash_deleted ON admin_trash(deleted_at);
