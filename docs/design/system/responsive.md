# Responsive

Four tiers, from iPhone to 24″ displays, set by the viewport width in CSS pixels. The MacBook Air tier is the layout DESIGN.md defines; every other tier is a change from it. Every tool and button the desktop has is reachable at every size.

| Tier | Width | Token |
| --- | --- | --- |
| Phone | 0 – 1023 | (below `bp-tablet-lg`) |
| iPad 13″ | 1024 – 1279 | `bp-tablet-lg` |
| MacBook Air | 1280 – 1919 | `bp-laptop` |
| 24″ and larger | 1920 and up | `bp-desktop` |

Every width under 1024px, in portrait and landscape, is the phone layout ([ADR 0032](../../adr/0032-everything-under-1024px-is-the-phone-layout.md)): a phone on its side (844×390, 956×440) and an iPad held upright (820×1180) get the same layout as a phone held upright. Media queries cannot read custom properties, so the app writes the breakpoints as literal values: `@media (min-width: 1024px)`.

### Phone · 0 – 1023 px

Devices (CSS px): iPhone 16e 390×844, iPhone 17 · 17 Pro 402×874, iPhone Air 420×912, iPhone 17 Pro Max 440×956, the same on their side (844×390, 956×440), iPad mini 744×1133, iPad · iPad Air 11″ 820×1180, iPad Pro 11″ 834×1210.

- The screen belongs to the Pattern and the Progress bar. **No header and no canvas header strip** (ticket 295): the canvas starts at the top edge, padded by `env(safe-area-inset-top)`. What the header held lives in the Dock's Project and Menu sheets (the open Pattern's name, size, bead and save state in the Project sheet; language, theme, Name on exports, Keyboard shortcuts when a keyboard is attached, Overview and the source link in the Menu). Undo, Redo and the Row progress toggle move to the Zoom pill (tickets 296, 297); until then Undo and Redo sit in the Frame sheet.
- Pinch to zoom and pan; a small zoom pill (rulers · out · level · in · fit) floats over the Pattern, bottom-right to start with and then wherever it is dropped (ticket 321).
- The Progress bar is the largest control on the screen: 56px, its own compact mode (ticket 188) in place of the reference tier's spelled-out one -- a "1/222" counter, Turn row direction, and Row not done/Row done as icon-only buttons (their hover/focus label carries the word) -- and a 3px progress line under it.
- **A slim, icon-only Dock of five buttons** (Tool, Colour, Frame, Pattern, Menu; no Mirror, which the app hides pending a redesign, ticket 174): 48px plus `env(safe-area-inset-bottom)` in portrait and landscape alike, at most 480px wide and centred. No text labels: each button keeps its name as an accessible name and a Tooltip. There is no left rail. With no Pattern open, the New Pattern / Import bar replaces the Dock, with the Menu button at its bottom right.
- Tool, Colour and Frame sheets are light: no scrim, only as tall as their content, so the Pattern stays visible; tapping the Pattern or the button again closes them. The Frame sheet also holds Rotate, Copy and Paste. The Pattern sheet (Canvas color button in its header, name and size, save, export, Replace bead, Beads needed, Saved Patterns, New, Import) and the Menu sheet are modal, with a scrim.
- While a Selection exists, a context bar above the Progress bar offers Copy, Rotate, Remove line and clear; after Copy it turns into "Tap where to paste" with Rotate and Cancel.
- **Frame bar:** while the Frame is being set, the Frame's size, Fit to drawing, ✕ and Done float at the top-centre of the canvas box over the beads, taking no row and never covering the Dock.

### iPad 13″ · 1024 – 1279 px

Devices (CSS px): iPad Air 13″ 1024×1366, iPad Pro 13″ 1032×1376, iPad mini, landscape 1133×744, iPad 11″, landscape 1180×820.

- The left column is docked again, 300px wide (286px boxes), with 16px page padding (6px on the left, next to the column) and 12px between boxes.
- Beads needed and Saved Patterns start collapsed; the Toolbox and save box stay open.
- Header 64px with the Bead pill and Replace bead; Import a file and Import QR code are icon buttons with tooltips. Keyboard shortcuts shows when a keyboard or trackpad is attached. No Dock.

### MacBook Air · 1280 – 1919 px

Devices (CSS px): iPad Air 13″, landscape 1366×1024, DESIGN.md reference 1440×900, MacBook Air 13″ 1470×956, MacBook Air 15″ 1710×1107.

- The layout DESIGN.md defines, unchanged: 366px column (352px boxes), page padding 24 / 32 (6px on the left, next to the column), header 64px with every item and its label.
- This is the reference tier: every other tier is described as a change from it.

### 24″ and larger · 1920 and up px

Devices (CSS px): 24″ Full HD 1920×1080, iMac 24″ 2240×1260, 27″ QHD 2560×1440, 32″ 4K 3840×2160.

- The column grows to 360px (344px boxes); page padding 32 / 40 (6px on the left); header padding 0 40.
- Beads needed shows 5 colour rows and Saved Patterns 10 thumbnails before they need expanding.
- Type and controls keep their size: the extra space goes to the Pattern, never to bigger chrome.
- Performance: the drawing surface is largest here; ticket 83 checks it on a Core i3-class laptop.

## Smallest bead

Only the canvas zooms at every size: the browser's Page zoom is locked (ADR 0034), so the header, Dock and sheets never change size, and ⌘ or Ctrl + plus, minus and 0 zoom the canvas. The Zoom floor is 10% on every size (ADR 0033); zoom out, pinch, wheel and Fit all reach it, and Fit stays capped at 100%. The rulers thin their numbers instead (the Ruler step: every 5, 10, 50, 100 beads as room allows). `bead-min-phone` 16px (12px ruler numbers) and `bead-min-tablet` 15px mark where a number needs more room. See the Rulers card.

## Fitting longer text

- The header fits by priority, not only by tier: when its content does not fit, first Import a file and Import QR code become icon buttons, then the Pattern name is cut with an ellipsis, then the imports move into More. Russian at 1440px takes the first step.
- The ContextBar drops labels right to left (Remove line, Rotate, Copy) and keeps Cancel's label. The Dock is icon-only, so its names never need to fit.
- See the LongerText card.

## Input, not width

- `@media (pointer: coarse)`: touch and Pencil, at any width: every control keeps its drawn size but gets a `touch-target` (44 × 44px) hit area; tool tiles and swatches are both at least 36px (one grid, so they stay the same size), with their hit areas kept apart by the 6px gap, Dock items are 48px tall and keep their `touch-target` hit area.
- Nothing is hover-only on a coarse pointer: the Remove × on Saved Pattern thumbnails is always visible, tooltips become long-press, there is no hover paint preview.
- Keyboard shortcuts shows only when a fine pointer or keyboard is present: `(any-pointer: fine)`.
- A stroke on the drawing surface never scrolls the page: `touch-action: none` on the surface.

## Screen edges and height

- `viewport-fit=cover`: the header (1024px and up) and, under 1024px, the canvas pad by `env(safe-area-inset-top)`, the Dock by `env(safe-area-inset-bottom)`, and the canvas by the side insets.
- Heights use `100dvh`, so the mobile address bar never hides the Progress bar or the Dock.
- The page never scrolls at any tier; only the left column, sheets and the Pattern scroll.

## Type and performance

- Type sizes do not change between tiers: 14px controls and body everywhere. Only spacing, the column width and which labels show change. On the phone, long Pattern names truncate with an ellipsis.
- The drawing surface resizes once the layout settles (a debounced ResizeObserver), never on every scroll or animation frame. Sheets slide with `transform`, so the canvas does not resize when they open (ADR 0018).
- Check with ticket 103's performance run at the phone sizes in portrait and landscape, and at 2240px on the Core i3 reference (ticket 83).

## Header menu, Overview and the Tour (v15)

- **Header menu:** a `menu` button next to the logo, from 1024. It holds Overview and Take the tour; under 1024 there is no header, and the Dock's Menu sheet holds them with language, theme, Name on exports and Keyboard shortcuts. They are links, with no check on the current page. See the HeaderMenu card.
- **Overview:** the one page outside the editor. It scrolls as a page; container 1080px (1200px at 24″), padding 16 / 24 / 32 / 40. The features carousel is a list plus a large example from 1024 and swipe cards below; on a MacBook Air it sits above the fold. See the Overview card.
- **Tour placement:** 1024 and up, the card sits right of the left column for its controls, below header controls and above the Progress bar; under 1024, docked above the Dock, reaching sheet controls through their Dock button. When a control can't be brought on screen, the card is centred with no pointer. See the TourStep card.

## Open canvas and Frame (v16)

The canvas is open at every tier: no board, no size to set first, pieces with their own rulers, and one Frame that marks the Pattern (BeadBoard, Frame and Rulers cards). What differs per tier:

- **Phone:** two fingers move the canvas and pinch zooms; one finger uses the tool. The ZoomPill starts with the Rulers toggle. The Dock's third button is Frame; its sheet holds Set Frame, Fit to drawing, the steppers, Remove Frame, Rotate, Copy and Paste. While the Frame is being set it has four 16px corner handles and the Frame bar floats at the top-centre of the canvas box with its size, Fit to drawing, ✕ and Done. With no Frame the Progress bar reads "Row progress · Set Frame to start" with a Set Frame button. No CanvasHint.
- **iPad 13″, MacBook Air, 24″:** the left column's Toolbox has six tool tiles on the swatch grid and the Frame row; the canvas strip has the Rulers toggle; the CanvasHint sits bottom-left. The wheel moves the canvas, ⌘ or Ctrl + wheel zooms.
- **Zoom floor:** 10%, with the Ruler step, for piece rulers and Frame rulers alike. Fit now fits the Frame, or every piece when there is no Frame.
