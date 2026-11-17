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

A PR that ships a user-facing change adds **one Release note per ticket**, as a new file, `src/data/releaseNotes/YYYY-MM-DD-NNNN.json` (the day it ships and the PR's ticket), never by editing another note's file, so PRs open at once don't conflict: `{ "date": "YYYY-MM-DD", "kind": "new" | "changed" | "fixed", "line": { "en": "…", … } }`, one short line in every shipped language, in the product's voice (`docs/design/system/writing.md`), no full stop. A PR with no user-facing change (most `ref`, docs, tests, skills, dependencies) adds none.

The note's **kind** is what steps the Version (ADR 0096, spec 1043): New steps the second number, Changed and Fixed the third.

- **New**: the maker can do something they couldn't before.
- **Changed**: it was there and now looks or works differently, and the old way was intended. Something removed is Changed.
- **Fixed**: it was wrong and now works as meant. A freeze made fast is Fixed.
- A feature that returns is New.
- **When two kinds fit, the bigger wins**: New, then Changed, then Fixed.
- **A `fix` PR's note is Fixed.**
- **Ask the owner before a note is New**, and say what the maker can now do; a no makes it Changed. Changed and Fixed need no question.
- **Titles and tickets never name a Version**, except a release's own: the number comes from the order PRs merge into `main`, so the PR can't know it.
- **A merged note is final in its file name and kind.** It is never deleted or renamed; its wording may be corrected. Taking a feature back is a new Changed note.

The notes from before 1.0.0 sit apart in `src/data/releaseNotes/before-1.0.0/`, with no kind and no number; never add one there. `RELEASE_NOTES` lists old and new newest first by file name, and the Homepage's What's new tile shows the newest three. `releaseNotes.test.ts` checks every language, that each file's name matches its date, that every note since 1.0.0 has a kind, and that every note in the release record is still there with the recorded kind. CI's Build job runs `node scripts/notes-guard.ts origin/main`, which refuses a branch on which a note that is on `main` is missing, renamed or of another kind.

## Production releases

The release record, `src/data/releases.json`, lists the Production releases, oldest first (spec 1043, ADR 0096). It is a JSON list that starts with release 1.0.0 (ticket 1045, with no notes); each release is `{ "version": "X.0.0", "date": "YYYY-MM-DD", "notes": [{ "name": "YYYY-MM-DD-NNNN", "version": "X.Y.Z", "kind": "new" | "changed" | "fixed" }, …] }`: its Version, the day it was made, and every Release note it released, by the note's file name, with the number and kind that note got. A release is only ever added at the end, never edited or removed. The commit on `main` that adds one is a **release commit**: merging it deploys production, and production takes no other commit (`docs/deploy.md`, Releasing to production). `scripts/release.ts` is the only code that decides which commit is a release.

The Build's Version is worked out at build time (`vite.version.ts`): the record gives the released notes their numbers, and the notes since are placed in the order their commits sit on `main` (`scripts/noteOrder.ts`) and numbered by `scripts/versions.ts`. A note that merged while a release PR was open, and so is not in its list, keeps the number it had before the release. A build (`vite build`) needs git's whole history and fails without it; the dev server and the unit tests place a note git can't place last, by file name, and a note not yet committed counts as the newest.
