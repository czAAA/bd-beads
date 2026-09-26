# 156: DESIGN.md becomes the entry point to design system v13

**What to build:** One source of truth for the design. the design system in `docs/design/system/` (version 13: tokens for three themes, six guideline docs, 64 component cards, logo, favicon and icons) becomes the spec. `DESIGN.md` is rewritten as a short entry point: the principles, the rule for which source wins, a map of where each topic lives in the design system, and the app-specific notes the design system doesn't carry (the `PatternTheme` mapping for the canvas renderer, exports always drawn in light, fonts bundled for offline use, the ADR links, the map of what changes from today's app, and how to refresh the copy from claude.ai). The duplicated token and component tables leave `DESIGN.md`, so the two can't drift. Docs only.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `DESIGN.md` no longer repeats token values or component specs; every topic links to its design system file (tokens, `responsive.md`, `forms-and-states.md`, `interaction-and-motion.md`, `accessibility.md`, `printed-output.md`, `writing.md`, the component cards)
- [ ] The rule is written down: the design system wins for tokens, specs, copy and artwork; `DESIGN.md` wins only for its app-specific notes; a need neither covers is added to the design system on claude.ai first, then copied in
- [ ] The app-specific notes are kept and brought up to date with v13 (three themes, `PatternTheme` values including `print-board`, the new icons)
- [ ] The copy in the repo is cleaned: the stale `DOWNLOAD-README.md` and the legacy `row-progress.svg` are removed, and the design system version is recorded in `DESIGN.md`
- [ ] `CLAUDE.md` and ADR 0021 describe the new arrangement; `docs/design/light.png` and `dark.png` stay as the approved reference pictures
- [ ] Every design ticket (75–83, 136–168) still points at the right source after the rewrite
