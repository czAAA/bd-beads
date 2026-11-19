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

The one exception is the release PR, titled `release: X.Y.Z` (Production releases, below).

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

The notes from before 1.0.0 sit apart in `src/data/releaseNotes/before-1.0.0/`, with no kind and no number; never add one there. The app's script holds no note: the build writes one notes file per language, `notes/<locale>.json` (`vite.notes.ts`, `scripts/notesFile.ts`), with the notes since the older of the last two releases, and the Homepage's What's new reads it (ticket 1047); the notes from before 1.0.0 are in `CHANGELOG.md` only. `releaseNotes.test.ts` checks every language, that each file's name matches its date, that every note since 1.0.0 has a kind, and that every note in the release record is still there with the recorded kind. CI's Build job runs `node scripts/notes-guard.ts origin/main`, which refuses a branch on which a note that is on `main` is missing, renamed or of another kind.

## Production releases

The release record, `src/data/releases.json`, lists the Production releases, oldest first (spec 1043, ADR 0096). It is a JSON list that starts with release 1.0.0 (ticket 1045, with no notes); each release is `{ "version": "X.Y.Z", "date": "YYYY-MM-DD", "notes": [{ "name": "YYYY-MM-DD-NNNN", "version": "X.Y.Z", "kind": "new" | "changed" | "fixed" }, …] }`: its Version, the day it was made, and every Release note it released, by the note's file name, with the number and kind that note got. A release is only ever added at the end, never edited or removed. The commit on `main` that adds one is a **release commit**: merging it deploys production, and production takes no other commit (`docs/deploy.md`, Releasing to production). `scripts/release.ts` is the only code that decides which commit is a release.

The Build's Version is worked out at build time (`vite.version.ts`): the record gives the released notes their numbers, and the notes since are placed in the order their commits sit on `main` (`scripts/noteOrder.ts`) and numbered by `scripts/versions.ts`. A note that merged while a release PR was open, and so is not in its list, keeps the number it had before the release. A build (`vite build`) needs git's whole history and fails without it; the dev server and the unit tests place a note git can't place last, by file name, and a note not yet committed counts as the newest.

### The release PR

A Production release is made by one command and one pull request (ticket 1046):

- **When.** An agent opens a release PR only when the owner says "release", and never as part of a ticket or a bulk run.
- **The command.** On a branch from fresh `main` (`git fetch origin main`, then a worktree `git worktree add -b release/YYYY-MM-DD ../bd-beads-worktrees/bd-beads-release origin/main` with its `npm ci`), run `npm run release`. It adds the next release to the record (the Version of its newest note, today's date, and the number and kind of every Release note no release lists, numbered in the order they merged on `origin/main`) and writes `CHANGELOG.md`. It refuses, changing nothing, when no note is unreleased, and when the branch is behind `origin/main` (merge it in and run again). Run again on the release branch after `main` moved, it makes the same release again with the notes merged meanwhile.
- **What it holds.** Exactly what the command wrote: `src/data/releases.json` and `CHANGELOG.md`, nothing else. A release has a number and a date, no headline and no Release note of its own. A fix on production is another release.
- **Major only when the owner says.** A release keeps its newest note's Version; nothing steps the first number unless the owner asks for a major release ("release 2.0.0"): then run `npm run release -- --major`, which makes the newest release's first number plus one, `.0.0` (ticket 1103).
- **Its title** is `release: X.Y.Z`, the one title that names a Version. It has **no ticket**, so no ticket number in the title and no ticket to archive.
- **Only the owner merges it.** No skill merges one; the bulk run skips it and names it in its report. Its checks run (it changes the release record, not only Markdown). Merging it deploys production (`docs/deploy.md`, Releasing to production).
- A note that merges after the last run and before the merge keeps the number it had before the release, and the next release writes it down. The notes after it go on from the higher of its number and the release's, so none is given twice.

### The changelog

`CHANGELOG.md` at the repo's root is the owner's history, generated by `npm run changelog` (`scripts/changelog.ts`) and never edited by hand: English, newest first, a line per Production release with its date, under it every block (the notes sharing the first and second number, headed by the highest Version in it and the date of its newest note) with a row per note (Version, kind, line, ticket), and at the end the notes from before 1.0.0 under "Before 1.0.0", by date. It holds the released part only. `scripts/changelog.test.ts` fails when the committed file is not what the generator writes, so a pull request that corrects a released note's English line runs `npm run changelog` too. `npm run changelog:print` writes the same to the terminal with the unreleased part on top: what the next release would hold.
