-- Ticket 1209 (ADR 0102): how many devices opened the app on each UTC day, with no identifier. `open_days` holds the
-- day's total, for its ceiling (OPENS_DAILY_LIMIT) and the watchdog, never more than the ceiling plus one: the ping that
-- was refused. `opens` holds the counts per combination of the four fields a ping sends; `since` is '' on a first open.
CREATE TABLE open_days (
  day TEXT PRIMARY KEY,
  opens INTEGER NOT NULL
);

CREATE TABLE opens (
  day TEXT NOT NULL,
  first INTEGER NOT NULL,
  since TEXT NOT NULL,
  installed INTEGER NOT NULL,
  version TEXT NOT NULL,
  opens INTEGER NOT NULL,
  PRIMARY KEY (day, first, since, installed, version)
);
