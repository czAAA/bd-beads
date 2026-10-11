-- Ticket 71 (spec 385): what the Worker and the watchdog need before any feature has its own tables.

-- Features switched off by the watchdog (or by hand with source 'manual'). The maintainer's usual switch is the
-- DISABLED_FEATURES variable, which is not stored here. The watchdog clears its own rows at the first run of each UTC day.
CREATE TABLE switches (
  feature TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  set_at INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'watchdog'
);

-- One count per UTC day and measure, kept only while USAGE_SOURCE is 'd1' (the watchdog's fallback reader).
CREATE TABLE usage_counters (
  day TEXT NOT NULL,
  measure TEXT NOT NULL,
  value INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, measure)
) WITHOUT ROWID;

-- Fixed-window counters of the rate limiter's D1 fallback, one row per rule and key.
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
) WITHOUT ROWID;

-- The D1 implementation of the blob store: View links and Free accounts' synced Projects (<= 2 MB each).
CREATE TABLE blobs (
  id TEXT PRIMARY KEY,
  data BLOB NOT NULL,
  size INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- The watchdog's memory between runs: the day it last reset, and which warnings it has already sent today.
CREATE TABLE watchdog_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
) WITHOUT ROWID;
