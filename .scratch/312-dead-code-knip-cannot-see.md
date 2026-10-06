# 312: Remove dead translation keys, CSS and component props

**What to build:** knip (ticket 311) finds unused files, exports and dependencies, but not these kinds of dead code. Find them and remove them:

1. **Translation keys** in `src/i18n/translations.ts` (the `Translations` interface), `en.ts` and `ru.ts` that no code reads. Keys are reached as `t.value.section.key` or `t.section.key`; watch for keys picked dynamically (e.g. by a computed name or a map of tool names) and keep those.
2. **CSS:** scoped and global classes (`src/style.css`, `src/styles/*.css`, `<style>` blocks) that no template, `:class` binding or `classList` call uses, and custom properties in `src/styles/design-values.css`/`tokens.css` that nothing reads. Design-system tokens that the design system's own cards define stay, even if the app doesn't use them yet (`DESIGN.md`); remove only app-side leftovers. If a token is removed from the app's copy of the design system, update `docs/design/system/` in the same change (CLAUDE.md, Design).
3. **Vue props and emits** that no parent passes or listens to, and `defineExpose` members no one calls.

A small script or a one-off search is fine for finding them; adding another permanent CI tool is not part of this ticket unless it is tiny and has no false positives. Not in scope: the switched-off Tour and `MirrorControls.vue` (see ticket 311). Candidate G4 of the architecture review of 2026-10-05.

**Blocked by:** 311 (knip's cleanup first, so this pass sees only what knip can't).

**Status:** needs-triage

- [ ] Unused translation keys are removed from the interface, English and Russian together; dynamically chosen keys are kept, and the PR lists how they were checked
- [ ] Unused CSS classes and app-side custom properties are removed; the visual check is unchanged
- [ ] Unused props, emits and exposed members are removed, with their tests
- [ ] The PR description lists what was removed in each category, and what was kept on purpose and why
- [ ] Typecheck, lint, unit tests, the text fit check and the visual check pass in CI
