# `core` migrations

The `core` database (binding `CORE`, ADR 0049) holds accounts, their sessions, plan status and settings. Ticket 71
created it empty; its first table is the day's count of Reports (ticket 1051), ticket 0078 added accounts and
sessions, and ticket 1086 the Settings kept in step. Migrations only add: a column or table is dropped in a later deploy, once no deployed code uses it
(`docs/deploy.md`).
