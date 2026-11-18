-- Ticket 1051: how many Reports this Worker took on each UTC day, so a day's Reports have a ceiling
-- (FEEDBACK_DAILY_LIMIT) and the watchdog can say when it was reached. One row per day, never more than the limit
-- plus one: the Report that was refused.
CREATE TABLE feedback_days (
  day TEXT PRIMARY KEY,
  reports INTEGER NOT NULL
);
