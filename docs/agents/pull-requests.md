# Pull requests

## Headline format

`type:[ticketNumber] Description`

- **type** is one of:
  - `feat`: new functionality
  - `fix`: fix of an issue
  - `ref`: refactoring
- **ticketNumber** is the `.scratch/` ticket number, four digits, in square brackets.
- **Description** is short, with no trailing period.

Example: `ref:[0189] Extract undo/redo history into useUndoHistory`

## What a pull request holds

Only code and the public docs (`docs/design/system/`, `docs/agents/`, `docs/glossary/`, `CONTEXT.md`, `DESIGN.md`, ...). Tickets, ADRs and specs are in the private docs repo `bd-beads-docs` and are committed straight to its `main` and pushed at once, with no branch and no PR; the code PR links the ticket by number only. Archiving the ticket is a commit in the docs repo, made when the PR that completes the ticket is ready for review (not at the merge), and undone if review finds something wrong or missing.

## Release notes

A PR that ships a user-facing change adds a release note as a new file, `src/data/releaseNotes/YYYY-MM-DD-NNNN.json` (the day it ships and the PR's ticket), never by editing another note's file, so PRs open at once don't conflict: `{ "date": "YYYY-MM-DD", "line": { "en": "…", … } }`, one short line in every shipped language, in the product's voice (`docs/design/system/writing.md`), no full stop. `RELEASE_NOTES` lists them newest first by file name; the Homepage's What's new tile shows the newest three; `releaseNotes.test.ts` checks every language and that each file's name matches its date.

## Production releases

The release record, `src/data/releases.json`, lists the Production releases, oldest first (spec 1043, ADR 0096). It is a JSON list, empty until the first release; each release is `{ "version": "X.0.0", "date": "YYYY-MM-DD", "notes": [{ "name": "YYYY-MM-DD-NNNN", "version": "X.Y.Z", "kind": "new" | "changed" | "fixed" }, …] }`: its Version, the day it was made, and every Release note it released, by the note's file name, with the number and kind that note got. A release is only ever added at the end, never edited or removed. The commit on `main` that adds one is a **release commit**: merging it deploys production, and production takes no other commit (`docs/deploy.md`, Releasing to production). `scripts/release.ts` is the only code that decides which commit is a release.
