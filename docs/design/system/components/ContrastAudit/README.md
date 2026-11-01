# ContrastAudit

Every colour pair the design uses, measured against WCAG 2.2 AA in both themes, before and after the Phase C fixes.

- Text needs 4.5:1, meaningful marks (focus ring, control borders, the active underline, the selected ring) 3:1. Every pair passes in light, dark and high contrast.
- Labels on orange buttons are dark (`on-accent` #1f1f1f, 4.9:1); the brand orange stays. Hover is lighter, `accent-hover` #ff6a2b (5.8:1).
- Accent as text or a thin mark on light surfaces is `accent-strong` (#c23604); the focus ring is `focus-ring`; fields and Steppers are edged in `field-line`; the off Switch is `switch-off`; danger-filled buttons label in `on-danger`.
- `ai` (ticket 0764), for the AI mark and the AI Loading only: #6e44ff in light (5.3:1 on `canvas`, 4.7:1 on `panel`), #b9a6ff in dark (8.7:1 on `canvas`, 6.8:1 on `elevated`), #4a1fd1 in high contrast (7.6:1 or more); 4.5:1 or more on `canvas`, `surface`, `panel`, `elevated` and `box` in all three, checked by `src/styles/ai-contrast.test.ts`. On an `ink` fill it falls under 3:1 in dark and high contrast, so a chosen chip draws its mark in `canvas` (README, Iconography).
- `danger` (light) is #c23604, `ruler` #6a6a6a / #8c8c8c, `subtle` (light) #767676, `muted` and `box-muted` (dark) #949494.

Hand-written from the Phase C sign-off (Option A).
