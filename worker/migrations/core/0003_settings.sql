-- Ticket 1086: the Settings kept in step (ADR 0014), one row per account and setting. `name` is `language`, `theme` or
-- `liftedPieces`; `value` is the setting's own word (`ru`, `device`, `on`), unencrypted, since it is not a drawing.
-- `changed_at` is when the person changed it on their device, in epoch milliseconds, never later than the write: the
-- later change wins, setting by setting. An account's rows go with the account (ticket 0082).
CREATE TABLE settings (
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  changed_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, name)
);
