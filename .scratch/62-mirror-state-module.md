# 62: Extract Mirror's session state into its own module

**What to build:** Mirror's axis counts, copy mode, hover state, the two derived previews (axes shown at their effective count while hovering, and the cells a click would overwrite), and the "Mirror current" command itself move out of the app shell into one place, behind a small interface. No visible change: the same Toolbox controls, the same axis lines, the same undo behaviour.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Decisions (2026-09-19):** — from an architecture review (see ADR 0013 for a related rejected candidate)
- Axis counts, copy mode, hover state, both preview computations, and "Mirror current" itself all move together — not just the passive state, since "Mirror current" is Mirror's own command over Mirror's own state.
- "Mirror current" commits through the existing shared grid-change/undo path (the same one Fill uses), not a private copy.
- Axis-count clamping still reads the open Pattern's live column/row count.
- Mirror's session state still resets whenever the open Pattern changes, through the app shell's existing single reset point.
- The new module (`useMirrorState`) exposes its axis-count/copy-mode state so ticket 63's module can read it, without that module needing to know this one exists.
- This candidate's evidence held up under scrutiny: four consecutive Mirror tickets (44, 45, 46, 47) each directly edited this exact code, unlike a rejected candidate from the same review (ADR 0013).

- [ ] Axis counts, copy mode, hover state, and both preview computations live in one module, not the app shell
- [ ] "Mirror current" lives there too, and still commits as one undo step through the existing shared path
- [ ] Axis-count clamping still respects the open Pattern's current size
- [ ] Mirror's session state still resets on a Pattern switch
- [ ] Every existing Mirror test (rich-mirror, Toolbox, grid, canvas) passes unchanged
- [ ] A new test file covers the extracted module directly
