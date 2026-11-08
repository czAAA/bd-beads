# Pull requests

## Headline format

`type:[ticketNumber] Description`

- **type** is one of:
  - `feat`: new functionality
  - `fix`: fix of an issue
  - `ref`: refactoring
- **ticketNumber** is the `.scratch/` ticket number, in square brackets.
- **Description** is short, with no trailing period.

Example: `ref:[189] Extract undo/redo history into useUndoHistory`

## What a pull request holds

Only code and the public docs (`docs/design/system/`, `docs/agents/`, `docs/glossary/`, `CONTEXT.md`, `DESIGN.md`, ...). Tickets, ADRs and specs are in the private docs repo `bd-beads-docs` and are committed straight to its `main` and pushed at once, with no branch and no PR; the code PR links the ticket by number only. Archiving the ticket is a commit in the docs repo, made when the PR that completes the ticket is ready for review (not at the merge), and undone if review finds something wrong or missing.

## Release notes

A PR that ships a user-facing change adds a release note at the top of `src/data/releaseNotes.ts`: the day it ships and one short line in every shipped language, in the product's voice (`docs/design/system/writing.md`), no full stop. The Homepage's What's new tile shows the newest three; `releaseNotes.test.ts` keeps every language and the order.
