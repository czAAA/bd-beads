# 262: A canvas is a Project; a Pattern is what the Frame holds

**What to build:** Ticket 233 turns what people open, save and share into an endless canvas of Pieces, with a Frame marking which beads are the Pattern. "Pattern" then names two different things: the whole canvas (today's meaning, in the library, files, the New Pattern form, the code) and the beads inside the Frame. This ticket makes the words match the model. The thing a person creates, opens, saves, lists, exports as a file and shares is a **Project**; a **Pattern** is only the beads inside a Project's Frame, which is what Export, Beads needed, Row progress and Rotate act on.

**Blocked by:** 233 (Open canvas and Frame, which introduces Frame and Piece; this ticket renames on top of it). Best landed after 232, which adds strings in the same places (261 has already landed).

**Status:** ready-for-agent

## Vocabulary after the change

| Term | Meaning |
|---|---|
| **Project** | Everything saved under one name: the open canvas with all its Pieces, the Frame, Technique, Bead, rotation, Row progress, Image colors and maker's name. Created, opened, saved, listed in the library, exported as a file and shared. |
| **Pattern** | The beads inside the Project's Frame. What PNG, PDF and QR exports contain, what Beads needed counts, what Row progress and Rotate work on. A Project with no Frame has no Pattern yet. |
| **Piece**, **Frame**, **Set Frame**, **Technique**, **Bead**, **Palette** | Unchanged. |

Rule of thumb for each string and identifier: if it is about the whole canvas or the saved thing, it becomes Project; if it is about the Frame's beads or the finished piece of beadwork, it stays Pattern. Russian: Project is "проект"; Pattern keeps "схема".

## What the investigation found

Counts are for `main` before 233 lands, so they will grow.

**Becomes Project (user-facing):**
- Saved Patterns, New Pattern (header, sidebar, phone sheet, drawer, Overview), Create Pattern, Save Pattern, Export Pattern, "No Pattern open yet", "Open a Pattern to see how many beads it needs", Pattern library, Pattern file ("Export Pattern", "the Pattern file" in the Overview and Tour), "Patterns imported", "Pattern imported from QR code", the import-switch dialog ("Switch to the imported Pattern?"), the failed-save message, "Skip to Pattern", the patterns-saved counter, the per-project label read to screen readers, the confirmation to remove a saved one (ticket 232). About 47 English and 49 Russian strings, plus the same words inside the Tour's steps.
- Every new string 233 adds that says Pattern for the whole canvas (the canvas strip's "Pattern" title when no Frame is set, "Save Pattern saves the whole canvas", "New Pattern with optional size").

**Stays Pattern (and is now more precise):**
- The canvas strip once a Frame is set ("Pattern · 21 columns · 19 rows"), the header's "Star · 21×19", Beads needed, Row progress, "Pattern rotated…", exports' contents, Pattern size (renamed in CONTEXT.md to the Frame's size), Estimated size and weight.
- Convert image: it creates a Project whose Frame holds the picture, so "turn a picture into a Pattern" is still true; wording on its crop hint and "choose what becomes the Pattern" stays.

**Decided:** "Clear pattern" becomes just "Clear" (it empties the whole canvas and resets Row progress), and Replace Bead's dialog says Project ("this Project will be about…"). **Still to settle in the ADR:** the Pattern renderer and its "Pattern surface" (they draw Pieces and the Frame, not just the Pattern), the Row progress glossary text ("on the Pattern's grid").

**Code and tests (mechanical, wide):**
- The domain type `Pattern` and its siblings (size, encoding, file, resize, library, thumbnail, labels, undo, zoom, new-pattern and shared-link flows, import, list, canvas, ruler and surface components) are the saved thing, so they become `Project*`. Roughly 140 source files and 91 test files mention "pattern", about 12 e2e files, 30 `data-testid`s, and the i18n keys.
- The new Frame-contents view (what exports and Beads needed read) takes over the name `Pattern`, so the order matters: rename the saved thing first, then introduce the narrow `Pattern`.
- This is a wide rename: blast radius is the whole codebase, so do it as one mechanical pass per layer (domain, then services and composables, then components, then tests and e2e) on an integration branch, with the final verification in one place.

**Stored and shared data (do not change silently):**
- localStorage key `bd-beads:patterns`, file kinds `bd-beads/pattern`, `bd-beads/library`, `bd-beads/qr-pattern`, and the share link's `#pattern=` hash are wire formats that live on people's devices, in their files, in printed QR codes and in links already sent. The stored-data compatibility test pins them.
- Suggested: leave all of them as they are, say so in the ADR, and add nothing. Renaming gains nothing a person sees and risks stranding saved work. Say so in the ADR as a deliberate exception to "no code refers to the old word". Exported file names (`bd-beads-<name>.json`, PNG, PDF) contain no such word.

**Docs:**
- CONTEXT.md: add Project, redefine Pattern, update every entry that says Pattern for the saved thing (Pattern library, Pattern file, Pattern size, Resize, Clear pattern, Convert image, Replace Bead, Row progress, Mirror, Selection, Undo, Pattern renderer, Canvas, Tour and Overview entries), and update the "_Avoid_" lines (Pattern surface, extracted palette, pattern palette…).
- A new ADR records the split, the options (rename only the UI; rename UI and code; do nothing and teach "Pattern means both"), and what it supersedes in earlier ADR wording. Existing ADRs are history and keep their words, with a one-line note at the top of the ones whose titles name "pattern" (0007, 0012, 0016, 0018, 0019). Archived tickets are not touched.
- README, `docs/agents/*` and the e2e support names.

**Design system:** v16 uses "New Pattern" and "Saved Patterns" throughout. The design system is being updated separately on claude.ai, and this ticket does not wait for it: it follows the vocabulary in this ticket, never edits `docs/design/system/` by hand, and applies the new version's copy where it differs once the user copies it in (DESIGN.md §6). Where the two disagree, the design system wins for strings and card names, and this ticket's code and docs follow it.

## Decisions

1. **Wire formats:** unchanged, as suggested above (the owner did not object).
2. **Clear pattern** becomes **Clear**: button, confirmation title and confirm button, in English and Russian.
3. **Replace Bead** says Project: the confirmation reads "With {bead}, this Project will be about…" and is checked against the Pattern size shown in the same dialog.

## Acceptance criteria

- [ ] CONTEXT.md and a new ADR define Project and the narrowed Pattern, list what stays and what changes, and record the wire-format decision
- [ ] The strings, docs and code follow the vocabulary above; `docs/design/system/` is not edited by hand, and if a newer design system version is in the repo its copy wins where it differs
- [ ] No string in English or Russian, including the Overview, Tour, dialogs, tooltips, screen-reader labels and error messages, says Pattern for the whole canvas or the saved thing; every string that says Pattern means the Frame's beads
- [ ] "Pattern" in the app appears only where there is a Frame, or where the person is told to set one; a Project with no Frame never claims to have a Pattern
- [ ] No source, test, e2e, fixture or testid name uses Pattern for the saved thing; the new `Pattern` name is used only for the Frame's contents
- [ ] Every Project saved before, every Project file, library file and QR code, and every earlier share link opens unchanged; the stored-data compatibility test passes without edits to its fixtures
- [ ] Nothing a person sees or does changes besides the words: layout, behaviour and visual test references stay as they are, apart from screenshots that show a renamed string
- [ ] Typecheck, lint and the affected tests pass; the full suite is left to CI
- [ ] Overview and Tour: not added; the owner does not want either changed for this ticket beyond the strings that must follow the new words

## Outcome

Done in ADR 0028. The saved thing is a Project in strings, docs and code (types, files, test ids, i18n keys); Pattern means only the Frame's beads. Wire formats are unchanged (kept `bd-beads:patterns`, the three file kinds, the `patterns`/`pattern` JSON keys and `#pattern=`). No `Pattern` type was added: the Frame's beads are read through `beadsInFrame`, so the word is used in copy and docs only. The Pattern renderer is now the Project renderer.

Left for a human: copy in the design system version that carries the Project terms when it exists (DESIGN.md §6); the design system's own names (`pattern.svg`, the `TourPattern`, `SavedPatterns` cards) still say Pattern. Playwright visual and e2e specs typecheck but were not run here.
