# Accessibility and stacking

Every screen meets WCAG 2.2 AA in both themes and works with a keyboard, a screen reader, 200% zoom and system high contrast; layers stack in one fixed order.

## Contrast

- Text 4.5:1, meaningful marks 3:1 (the focus ring, control borders, the active underline, the selected ring), in light, dark and high contrast. The ContrastAudit card lists every pair.
- **Orange buttons carry dark labels.** `on-accent` is #1f1f1f in light (4.9:1 on #fa520f), the same move the dark theme makes with dark text on yellow. Hover lightens to `accent-hover` #ff6a2b (5.8:1). The brand orange itself is unchanged.
- **Accent as text or a thin mark** on light surfaces is `accent-strong` (#c23604, 4.9:1 on panel): the active tool label and underline, the open Saved Pattern ring and name, message edges, accent icons, links. `accent` stays for fills, the current row and the logo.
- The focus ring is `focus-ring`. Fields and Steppers, whose border is their only edge, use `field-line`; the off Switch uses `switch-off`; danger-filled buttons label in `on-danger`.
- Changed values: `danger` light #c23604; `ruler` #6a6a6a / #8c8c8c; `subtle` light #767676; `muted` and `box-muted` dark #949494.
- **Rulers** are measured on all eleven canvas backgrounds: regular numbers in `ruler` at 4.8:1 or more (Ash uses a lifted `#a0a0a0`, 5.4:1), every 5th in `body` at 7.9:1 or more, the current row's `marker` at 13:1 or more, and 10.9:1, 16.5:1 and 21:1 in high contrast. The Rulers card has the table. Column numbers from 100 are turned a quarter turn; none is ever thinned.
- The logo on an accent tile (app icon, apple-touch icon, the cover) stays white in light: a graphic needs 3:1 and has 3.3:1.

## High contrast

- Pressed states use `--press-fill` #d4d4d4 and hover `--hover-fill` #f0f0f0, so black text stays at 15:1 or more; a pressed link keeps full strength and gains a 2px underline instead of fading.

- A third theme, `contrast` (`data-theme="contrast"`), light-based. It follows `prefers-contrast: more` while the theme control is on Match device, and is its fourth option, "High contrast".
- Text at least 7:1 (`ink` #000, `body` #1f1f1f, `muted` #3d3d3d), `accent` and `danger` #a82c00 with white labels, every line #595959 and drawn 2px, every surface white, every elevation `none`, a 3px black focus ring. Bead colours never change.
- `forced-colors: active` (Windows): system colours win; outlines and borders stay; focus, the active tab and the open Pattern use `Highlight`.

## Never colour alone

- Every state with a colour also has a shape or a word: the active tool its inset outline and `aria-pressed` (no underline since v18), the selected swatch its ring, errors their icon and sentence, the current row its outline and "Row 12".
- Bead colours carry names in Beads needed and in swatch labels ("Color 1, red").
- Warnings are an icon on a neutral edge, never warning-coloured text.

## Text and zoom

- Sizes in `rem`, so the browser's text size scales the chrome; the layout holds at 200% zoom (the left column scrolls, the header drops labels as on smaller tiers).
- Nothing below 11px (rulers, Saved Pattern sizes and the hotkey in a tool tile's corner: 10px in the Toolbox, 11px on the iPad toolbar, 12px in the phone Dock); on a phone nothing below 12px. Phone rulers are therefore 12px.
- `lang="en"` / `lang="ru"` on `<html>` follows the language.

## Keyboard

- Tab order: Skip to Pattern (visible on focus), header, Toolbox, save box, Beads needed, Saved Patterns, canvas strip, the Pattern, Progress bar.
- One stop per group; arrow keys inside the tool tiles, swatches and segmented controls (roving tabindex). The Pattern is one stop with a bead cursor: arrows move, Space or Enter paints.
- Modals and the modal Pattern and Menu sheets trap focus and return it to the opener. Escape closes the top-most thing: modal → sheet → menu → Selection → open disclosure row.
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
| `z-chrome` | 20 | Header, Dock, Progress bar when they overlap scrolling content. |
| `z-context-bar` | 30 | The Selection ContextBar above the Progress bar. |
| `z-sheet` | 50 | ToolSheets; the modal Pattern sheet and its scrim. |
| `z-popover` | 60 | Menus, the Image colors popover, the HeaderMenu. |
| `z-toast` | 70 | Toast messages: above sheets so a result is never hidden, below modals. |
| `z-modal` | 80 | Modals and their scrim (scrim one below): confirmations, QR export, Keyboard shortcuts, New Pattern on phone. |
| `z-tour-dim` | 84 | The Tour's dim layer and its hole (v15). |
| `z-tour-connector` | 85 | The Tour's ring of beads around the hole and the connector. |
| `z-tour-card` | 86 | The Tour's step card. Above modals, so the Tour can guide inside New Pattern on the phone. |
| `z-tooltip` | 90 | Tooltips: always on top, never interactive. |

- A scrim sits one below its layer (39, 49, 79). The Tour's layers sit above modals and below tooltips; the pointed control is seen and used through the hole, whatever its own layer. One modal at a time. Nothing inside the canvas box goes above `z-canvas-overlay`; the Save-failed notice row is in the page flow, not a layer.

## The Tour (v15)

- The step card is a non-modal `role="dialog"` named "Tour, step {n} of 11: {title}" and described by its text; focus moves into it when a step starts. Tab cycles the card's buttons and the lit control only; everything outside the holes is `inert` for the step.
- Escape skips the Tour; if a menu, sheet or modal is open, the first Escape closes it. A pointer move inside a step is one polite status line ("Next: Yellow, in Colors.").
- The gold `tour-highlight` ring is not a focus indicator; the 2px `focus-ring` still shows on the focused control. High contrast replaces the ring with 3px `ink` and drops the glow; key caps and the grey pointer keep 3:1 against the dim layer. Full rules: the TourStep card.
- The Overview's handwritten notes, bead drawings and background marks are `aria-hidden`; its carousel is a `tablist` from 1024. `note-gold` (about 2.5:1 on white) is for the decorative note only.

## Open canvas and Frame (v16)

- **Keys:** `6` starts Set Frame, `R` toggles the rulers, `5` picks the Hand tool. Space pressed on its own still paints at the bead cursor; Space held while dragging moves the canvas. The wheel moves the canvas and ⌘ or Ctrl + wheel zooms. The CanvasHint that names these is aria-hidden; the same list is in Keyboard shortcuts.
- **Bead cursor:** arrows move it across the whole open canvas, and the canvas scrolls to keep it in view. With the Frame being set, arrows move the Frame by one bead, Shift + arrows resize it, Enter sets it and Escape cancels.
- **Names:** the Rulers toggle is "Rulers" with `aria-pressed`. The Frame number is "Frame 1, bring it into view". Rotate without a Frame is disabled and named "Rotate, Set Frame first". The export prompt is a dialog named "Set Frame to export"; focus moves into it and returns to Export.
- **Announced:** "Frame set, width 21, height 19", "Frame removed", the margin notice in full ("Frame set. 1 bead was in the margin and moved outside it."), and the rotate notice in full: "Pattern rotated. 1 piece was in the way and moved outside the Frame."
- **Never colour alone:** the Frame is a line plus its rulers; a piece is a rectangle plus its rulers. The Frame line is `ink`, the strongest mark on every canvas background. The piece rectangle (`line-strong`) is decoration: the rulers carry the information.
- **Touch targets:** the phone's Frame handles are drawn at 16px with a 44px hit area.
- The keyboard rules for the Frame and the announcements are proposed with v16 and were not part of the signed-off mockups.
