# 157: Buttons and controls with every interaction state

**What to build:** The shared building blocks every restyle ticket uses: Button (primary, secondary, secondary in a box, text, danger), IconButton (square and round), Link, Select, the expand button and the Tooltip, each with every state in `interaction-and-motion.md`: hover (fine pointers only), pressed with its slight shrink, the keyboard-only focus ring, disabled with its reason nearby, and selected. Motion uses the duration and easing tokens and respects reduced motion. The header's New Pattern button is the first real use, so the ticket is verifiable in the app.

**Blocked by:** 136, 137

**Status:** done

- [x] Each control matches its component card (Button, InteractionStates, Motion) in all three themes
- [x] Hover exists only under `(hover: hover)`; pressed uses `--press-fill` and the shrink; focus is `:focus-visible` with the `focus-ring` token and is never removed
- [x] Disabled controls have no hover or press and `cursor: not-allowed`
- [x] With `prefers-reduced-motion: reduce` nothing slides or scales
- [x] Primary labels use `on-accent` (dark on orange in light, per `accessibility.md`)
- [x] No hardcoded colors, fonts, sizes, shadows, durations or z-index values: only design system tokens
- [x] Unit tests cover the variants and states; New Pattern uses the new Button
