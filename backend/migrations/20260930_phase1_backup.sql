-- Applied through the Youbase SQL tool on 2026-09-30.
ALTER TABLE inspections ADD COLUMN extra_data TEXT DEFAULT '{}';
CREATE TABLE inspection_photo_backups (
  id TEXT PRIMARY KEY NOT NULL,
  inspection_id TEXT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  cloud_path TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  ready INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX inspection_photo_backups_inspection_idx ON inspection_photo_backups(inspection_id);
CREATE INDEX inspection_photo_backups_user_idx ON inspection_photo_backups(user_id);
