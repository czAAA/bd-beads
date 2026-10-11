# ThemeToggle

The four-way theme control in the header (Match device, Light, Dark, High contrast); the language button sits beside it.

- Frame: 34px, `button` fill, `button-line` border, radius-md, padding 2, gap 2. Four 28px icon buttons (`device`, `sun`, `moon`, `contrast`; icons 15px, radius-sm). The chosen one is filled `ink` with its icon in `canvas`; the others are `subtle` with no fill.
- **Match device** is the default and follows `prefers-color-scheme` (and `prefers-contrast: more` for High contrast). Picking Light, Dark or High contrast sticks and is remembered on the device; Match device goes back to following it.
- A radio group: one Tab stop, arrow keys move, `role="radiogroup"` with `role="radio"` and `aria-checked`; each option's name ("Match device", "Light theme", "Dark theme", "High contrast") is its tooltip and `aria-label`.
- Under 1024px: the Dock's Menu sheet holds the same four-way control.
- **The language button** (ticket 368) is one secondary button, `control-height` tall, showing the current language's code (`EN`, `RU`, `UK`, `BE`, `ZH`, `ES`, `PL`) in the `control` style with a trailing chevron. Pressing it opens a Menu (Menu card) of every language under the button, or above it where there is no room below, aligned to the button's right edge. Each item is the language's name in itself (English, Русский, Українська, Беларуская, 中文, Español, Polski), carries its own `lang`, and the current one has a 16px check in front of it (the others keep the space, so the names line up) and `aria-current`. Choosing one switches the whole app and closes the Menu. The button's accessible name is "Language: English", in the current language. In the Dock's Menu sheet it sits in the Language row, right-aligned, and its list opens as a popover over the sheet.

Hand-written from DESIGN.md §2 and §5.2–5.3, and the Phase E sign-off.
