# ThemeToggle

The four-way theme control in the header (Match device, Light, Dark, High contrast); the EN / RU language button sits beside it.

- Frame: 34px, `button` fill, `button-line` border, radius-md, padding 2, gap 2. Four 28px icon buttons (`device`, `sun`, `moon`, `contrast`; icons 15px, radius-sm). The chosen one is filled `ink` with its icon in `canvas`; the others are `subtle` with no fill.
- **Match device** is the default and follows `prefers-color-scheme` (and `prefers-contrast: more` for High contrast). Picking Light, Dark or High contrast sticks and is remembered on the device; Match device goes back to following it.
- A radio group: one Tab stop, arrow keys move, `role="radiogroup"` with `role="radio"` and `aria-checked`; each option's name ("Match device", "Light theme", "Dark theme", "High contrast") is its tooltip and `aria-label`.
- Under 1024px: the Dock's Menu sheet holds the same four-way control.
- **EN / RU** is one secondary button: the current language in `ink`, the other in `subtle`. Pressing switches.

Hand-written from DESIGN.md §2 and §5.2–5.3, and the Phase E sign-off.
