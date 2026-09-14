# Local-only persistence, no backend or accounts

bd-beads is a personal tool for a single user, not a multi-user product. Patterns are stored in the browser's localStorage, with manual export/import for backup and portability, instead of a server-side database with user accounts. This avoids the cost of running and maintaining a backend for what is, at least for now, single-device personal use; cross-device sync can be added later if the need arises, without changing the pattern data model.
