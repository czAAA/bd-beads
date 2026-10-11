# `core` migrations

The `core` database (binding `CORE`, ADR 0049) holds accounts, plan status, settings and later sessions. Ticket 71
creates it empty; its first migration is ticket 78's. Migrations only add: a column or table is dropped in a later
deploy, once no deployed code uses it (`docs/deploy.md`).
