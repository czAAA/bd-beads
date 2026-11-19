-- Ticket 0078: accounts and their sessions. An account is one verified email address (ADR 0014), lowercase. Nothing
-- else of a person is kept: no name or picture, no Google token, no address or device.
-- `google_sub` is Google's own id for the person, which stays when their address changes; NULL for an account made by
-- an email link (ticket 0388). `plan` is `free` until payments (ticket 0084). Times are epoch milliseconds.
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  google_sub TEXT UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at INTEGER NOT NULL
);

-- One row per signed-in device. `id_hash` is the SHA-256 of the cookie's random id, never the id itself, so a copy of
-- this table signs nobody in. A session ends at `expires_at`, 90 days after the sign-in; the watchdog's daily run
-- deletes the ended ones, hence the index.
CREATE TABLE sessions (
  id_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts (id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX sessions_expires_at ON sessions (expires_at);
