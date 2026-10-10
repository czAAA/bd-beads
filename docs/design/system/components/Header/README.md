# Header

The 64px app header: brand, what is being edited, Replace bead, imports, New Pattern, language, theme and shortcuts.

On `canvas`, 1px `line-soft` bottom border, items 10px apart, none shrinking, padding 0 32. In order:
1. **Brand:** the X1 Cross-weave logo mark (22px, `accent`, stroke 3.8) and "bd-beads" (`brand`), 8px apart, 10px extra space after. See the Logo section of the brand book.
1a. **Menu** (v15): a 34px ghost icon button with the `menu` icon, right after the wordmark; it opens the HeaderMenu (Overview, Take the tour). See the HeaderMenu card.
2. **"currently editing"** (`label`), the Pattern summary (`control`), then the BeadPill. Only while a Pattern is open.
3. **Replace bead:** a primary select.
4. A flexible gap.
5. **Import a file:** a text button with an icon; its results and errors show beside it.
6. **New Pattern:** primary button with a plus icon.
7. **EN / RU**, 8. **ThemeToggle**, 9. **Keyboard shortcuts** (round icon button, 34px).

Library-wide notices (Message) take their own full-width row directly under the header, only while there is something to say.

Hand-written from DESIGN.md §4.1; static rendition at 960px (the reference is 1440px).
