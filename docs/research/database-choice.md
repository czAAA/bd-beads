# Database choice for the backend phase (ticket 66)

Fetched 2026-09-24 from each provider's own pricing page (Supabase: from third-party 2026 summaries, its page did not load). Provider terms change; re-check before ticket 71 commits to one.

## What the data is

- A Pattern is one JSON-shaped blob: a name, technique, bead id, size and a grid of at most 250 × 250 color cells (ADR 0019 removed the size cap; the compact encoding is ADR 0009). A Pattern is a few KB to, at the largest, a few hundred KB.
- It is read and written whole, by owner. There are no queries across Patterns beyond "this account's list". Shared (hosted) links (ticket 85) are read-by-id.
- Accounts and billing (tickets 78, 84) are small relational records: users, subscriptions, sync pairs.
- Scale to plan for: thousands of accounts, tens of Patterns each. That is well under 1 GB.

Fit: either model works. Relational fits accounts and billing better, and a Pattern is a `json`/`text` column next to its owner id; a document store fits the Patterns but not billing joins. Nothing about the data needs more than a single small database.

## Free tiers compared

| | Free allowance | What stays free | What triggers paid |
|---|---|---|---|
| **Supabase** (Postgres) | 500 MB database, 1 GB files, 50,000 MAU, 5 GB egress, 2 projects | Storage and users at this scale | Projects **pause after a week of inactivity** and must be restored by hand, which rules out the free tier for a live product; Pro is $25/month |
| **Turso** (libSQL/SQLite) | 5 GB, 500M rows read and 10M rows written a month, 100 databases | Well beyond this app's scale, indefinitely | Passing the quotas; Developer is $4.99/month (9 GB, 2.5B reads, 25M writes) |
| **Cloudflare D1** (SQLite) | 5 GB total, 5M rows read and 100k rows written a day | Same; the limits are daily and reset at UTC midnight | Workers Paid (25B reads, 50M writes a month included, then $0.001 per million reads and $1 per million writes); storage beyond 5 GB $0.75/GB |
| **Neon** (Postgres) | 0.5 GB, 100 compute-hours a month, 100 projects; compute suspends after 5 minutes idle | 0.5 GB is enough for a long time | Compute past 100 CU-hours, storage past 0.5 GB; Launch is pay-as-you-go from $0.106/CU-hour. Scale-to-zero means a cold start on the first request |
| **Firebase Firestore** (documents) | 1 GiB, 50k reads, 20k writes and 20k deletes a day | Small usage | Going over a daily quota needs the Blaze plan, which needs a billing account and is Google Cloud per-unit pricing (no flat tier) |

Rows-read counts matter for SQL: an unindexed list query reads every row, so index the owner column.

## Self-hosting on a Raspberry Pi

(From general knowledge of the projects, not fetched: verify before relying on it.)

- **SQLite / libSQL** is a file plus a small server (`sqld`, the open source core of Turso). It runs comfortably on a Pi and needs almost no memory. The same SQL then works on D1, Turso, or the Pi.
- **Postgres** (plain, or what Neon runs) is fine on a Pi 4 or 5. Supabase's *self-hosted* stack is several containers and is heavy for a Pi.
- **Firestore** cannot be self-hosted (only an emulator), so it ties the app to Google.
- **D1** runs only on Cloudflare (Miniflare locally); it ties the app to Workers.

## Recommendation

Use **SQLite-family SQL: Turso for the hosted phase**, with a Pattern as a JSON text column keyed by owner, and accounts/billing as ordinary tables.

- The free tier is 5 GB and 500M reads, far above this app's scale, with no inactivity pause and no cold start (Supabase pauses, Neon suspends).
- The paid step is $4.99/month and predictable, not a jump to $25 or an open-ended cloud bill.
- It is the one option that is the same engine on the Pi (`sqld`, or plain SQLite), so the self-hosting plan is not a rewrite.
- Runner-up: **Cloudflare D1**, if ticket 71 hosts the API on Workers; its free tier is equal and the SQL is the same, so moving between them is cheap.

Not recommended: Firestore (lock-in, per-operation billing that needs a billing account, no self-hosting) and Supabase's free tier (pausing). Neon is a fine Postgres if relational features (row-level security, extensions) turn out to be needed.

## Handing to ticket 71

Provision Turso (libSQL), one database, tables `accounts`, `patterns(id, owner_id, json, updated_at)`, `shares`. Keep the schema portable SQLite so D1 or a Pi are a config change. Open question for 71: whether sync (ticket 78) needs per-Pattern versioning, which would add a `version` column now.
