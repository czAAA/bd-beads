# Accessibility and stacking

Every screen meets WCAG 2.2 AA in both themes and works with a keyboard, a screen reader, 200% zoom and system high contrast; layers stack in one fixed order.

## Contrast

- Text 4.5:1, meaningful marks 3:1 (the focus ring, control borders, the active underline, the selected ring), in light, dark and high contrast. The ContrastAudit card lists every pair.
- **Orange buttons carry dark labels.** `on-accent` is #1f1f1f in light (4.9:1 on #fa520f), the same move the dark theme makes with dark text on yellow. Hover lightens to `accent-hover` #ff6a2b (5.8:1). The brand orange itself is unchanged.
- **Accent as text or a thin mark** on light surfaces is `accent-strong` (#c23604, 4.9:1 on panel): the active tool label and underline, the open Saved Pattern ring and name, message edges, accent icons, links. `accent` stays for fills, the current row and the logo.
- The focus ring is `focus-ring`. Fields and Steppers, whose border is their only edge, use `field-line`; the off Switch uses `switch-off`; danger-filled buttons label in `on-danger`.
- Changed values: `danger` light #c23604; `ruler` #6a6a6a / #888888; `subtle` light #767676; `muted` and `box-muted` dark #949494.
- The logo on an accent tile (app icon, apple-touch icon, the cover) stays white in light: a graphic needs 3:1 and has 3.3:1.

## High contrast

- Pressed states use `--press-fill` #d4d4d4 and hover `--hover-fill` #f0f0f0, so black text stays at 15:1 or more; a pressed link keeps full strength and gains a 2px underline instead of fading.

- A third theme, `contrast` (`data-theme="contrast"`), light-based. It follows `prefers-contrast: more` while the theme control is on Match device, and is its fourth option, "High contrast".
- Text at least 7:1 (`ink` #000, `body` #1f1f1f, `muted` #3d3d3d), `accent` and `danger` #a82c00 with white labels, every line #595959 and drawn 2px, every surface white, every elevation `none`, a 3px black focus ring. Bead colours never change.
- `forced-colors: active` (Windows): system colours win; outlines and borders stay; focus, the active tab and the open Pattern use `Highlight`.

## Never colour alone

- Every state with a colour also has a shape or a word: the active tool its underline and `aria-pressed`, the selected swatch its ring, errors their icon and sentence, the current row its outline and "Row 12".
- Bead colours carry names in Beads needed and in swatch labels ("Color 1, red").
- Warnings are an icon on a neutral edge, never warning-coloured text.

## Text and zoom

- Sizes in `rem`, so the browser's text size scales the chrome; the layout holds at 200% zoom (the left column scrolls, the header drops labels as on smaller tiers).
- Nothing below 11px (rulers and Saved Pattern sizes only); on a phone nothing below 12px.
- `lang="en"` / `lang="ru"` on `<html>` follows the language.

## Keyboard

- Tab order: Skip to Pattern (visible on focus), header, Toolbox, save box, Beads needed, Saved Patterns, canvas strip, the Pattern, Progress bar.
- One stop per group; arrow keys inside tool tabs, swatches and segmented controls (roving tabindex). The Pattern is one stop with a bead cursor: arrows move, Space or Enter paints.
- Modals, the Drawer and the modal Pattern sheet trap focus and return it to the opener. Escape closes the top-most thing: modal → sheet or Drawer → menu → Selection → open disclosure row.
- Focus is never hidden behind the header or the Dock (`scroll-margin`).

## Painting with the keyboard

- The Pattern is one Tab stop with a bead cursor: 2px `focus-ring`, 2px outside the bead (3px in high contrast), and the cursor's row and column marked on the rulers (`ink`, bold, a `focus-ring` underline). See the BeadCursor card.
- Arrows move, Shift + arrows extend a Selection, Home / End and Page Up / Down jump, Space or Enter uses the current tool, Escape leaves. The canvas strip shows "arrows move · space paints · esc leaves".
- Screen readers hear "Row 4, column 5, orange" as it moves and "Painted blue" after Space.

## Screen readers

- Landmarks: `header`, `aside` "Tools", `main` (the canvas box); phone sheets are `dialog`s named by their title.
- The Pattern is `role="img"` named "Logo panel, 40 by 30 beads, 2 colors, row 12 of 30 done"; Beads needed is its text equivalent.
- Every icon-only button has a name in the app's own words (the ScreenReaders card lists them). Toggles use `aria-pressed`, the Switch `role="switch"`, disclosure rows `aria-expanded`.
- Results are `role="status"` (polite), errors `role="alert"`; one announcement per action, none for painting single beads.

## Stacking order

| Token | Value | Layer |
| --- | --- | --- |
| `z-canvas-overlay` | 10 | Rulers, current-row marker, Selection, paste preview, ZoomPill: inside the canvas box. |
| `z-chrome` | 20 | Header, Dock, BottomToolbar, Progress bar when they overlap scrolling content. |
| `z-context-bar` | 30 | The Selection ContextBar above the Progress bar. |
| `z-drawer` | 40 | The iPad mini Drawer and its scrim (scrim one below). |
| `z-sheet` | 50 | ToolSheets; the modal Pattern sheet and its scrim. |
| `z-popover` | 60 | Menus, the Image colors popover, OverflowMenu. |
| `z-toast` | 70 | Toast messages: above sheets so a result is never hidden, below modals. |
| `z-modal` | 80 | Modals and their scrim (scrim one below): confirmations, QR export, Keyboard shortcuts, New Pattern on phone. |
| `z-tooltip` | 90 | Tooltips: always on top, never interactive. |

- A scrim sits one below its layer (39, 49, 79). One modal at a time. Nothing inside the canvas box goes above `z-canvas-overlay`; the Save-failed notice row is in the page flow, not a layer.
