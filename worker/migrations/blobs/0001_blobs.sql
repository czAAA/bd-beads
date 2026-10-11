-- The blobs database (binding BLOBS_DB, ADR 0049): the ciphertext of View links and Free accounts' synced Projects,
-- one row per blob, at most UPLOAD_CAP_D1_BYTES each (spec 385). Pro's synced Projects are in R2, not here.
-- `owner` is the account id from the core database (no foreign key: they are separate databases). Ticket 323 counts
-- quotas by it, hence its index. `expires_at` is epoch milliseconds, NULL for a blob that doesn't expire (a synced
-- Project); ticket 323's daily cleanup deletes the expired ones. `data` is last, so a scan of the other columns
-- doesn't read it.
CREATE TABLE blobs (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  size INTEGER NOT NULL,
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  data BLOB NOT NULL
);

CREATE INDEX blobs_owner ON blobs (owner);
