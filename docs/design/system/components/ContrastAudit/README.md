# ContrastAudit

Every colour pair the design uses, measured against WCAG 2.2 AA in both themes, before and after the Phase C fixes.

- Text needs 4.5:1, meaningful marks (focus ring, control borders, the active underline, the selected ring) 3:1. Every pair passes in light, dark and high contrast.
- Labels on orange buttons are dark (`on-accent` #1f1f1f, 4.9:1); the brand orange stays. Hover is lighter, `accent-hover` #ff6a2b (5.8:1).
- Accent as text or a thin mark on light surfaces is `accent-strong` (#c23604); the focus ring is `focus-ring`; fields and Steppers are edged in `field-line`; the off Switch is `switch-off`; danger-filled buttons label in `on-danger`.
- `danger` (light) was #c23604 (#b91c1c since ticket 0855, below), `ruler` #6a6a6a / #8c8c8c, `subtle` (light) #767676, `muted` and `box-muted` (dark) #949494.
- Ticket 0855 (the `danger` and `button-line` pairs, never measured before; `src/styles/tokenContrast.test.ts` keeps them):

| Pair | Light | Dark | High contrast |
|---|---|---|---|
| `danger` on `panel` | #b91c1c on #f5f1e8, 5.7:1 | #f87171 on #202020, 5.9:1 (was #ef4444, 4.3:1) | #a82c00 on #ffffff, 6.9:1 |
| `danger` on `elevated` | #b91c1c on #ffffff, 6.5:1 | #f87171 on #2a2a2a, 5.2:1 | #a82c00 on #ffffff, 6.9:1 |
| `danger` on `canvas` | #b91c1c on #ffffff, 6.5:1 | #f87171 on #141414, 6.7:1 | #a82c00 on #ffffff, 6.9:1 |
| `on-danger` on `danger` | #ffffff on #b91c1c, 6.5:1 | #0a0a0a on #f87171, 7.2:1 | #ffffff on #a82c00, 6.9:1 |
| `--selbar-danger` on the Selection bar | danger lifted on #1f1f1f, 5.8:1 | danger darkened on #ffffff, 4.7:1 | danger lifted on #000000, 7.6:1 |
| `button-line` on `box` / `panel` | #c7c7c7 on #fafafa, 1.6:1 (light not in this ticket) | #7a7a7a on #202020, 3.8:1 (was #202020, 1:1) | #595959 on #ffffff, 7.0:1 |
| `button-line` on `elevated` | | #7a7a7a on #2a2a2a, 3.3:1 | |
| Message edge and icon, `danger` tone (`--message-danger`) | #b91c1c on #f5f1e8, 5.7:1 | #faff69 on #2a2a2a, 13.4:1 | #a82c00 on #ffffff, 6.9:1 |
| Message edge and icon, `warning` tone | (unchanged) | #f59e0b on #2a2a2a, 6.7:1 (the edge was `accent-strong` before) | #9a5b00 on #ffffff, 5.4:1 |

- In light `danger` (#b91c1c) and `accent-strong` (#c23604) are two values: red for destructive rows and errors, orange for accents and status.

Hand-written from the Phase C sign-off (Option A).
