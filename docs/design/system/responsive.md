# Responsive

Five tiers, from iPhone to 24″ displays, set by the viewport width in CSS pixels. The MacBook Air tier is the layout DESIGN.md defines; every other tier is a change from it. Every tool and button the desktop has is reachable at every size.

| Tier | Width | Token |
| --- | --- | --- |
| Phone | 0 – 743 | (below `bp-tablet`) |
| iPad mini | 744 – 1023 | `bp-tablet` |
| iPad 13″ | 1024 – 1279 | `bp-tablet-lg` |
| MacBook Air | 1280 – 1919 | `bp-laptop` |
| 24″ and larger | 1920 and up | `bp-desktop` |

A phone on its side (height up to `bp-phone-landscape`, 499px) keeps the phone layout whatever its width. Media queries cannot read custom properties, so the app writes the breakpoints as literal values: `@media (min-width: 744px)`.

### Phone · 0 – 743 px

Devices (CSS px): iPhone 16e 390×844, iPhone 17 · 17 Pro 402×874, iPhone Air 420×912, iPhone 17 Pro Max 440×956.

- The screen belongs to the Pattern and the Progress bar. Header 52px (ticket 188): the `bead` icon in the wordmark's place (its name a hover/focus label), the open Pattern's own bead as a second icon (opens the Pattern sheet's Bead pill row), a single-icon theme control (opens a small four-way sheet), Undo, Redo and a More menu (Pattern name/size/save state, Theme, Language, Name on exports, Keyboard shortcuts when a keyboard is attached) -- every gap tightened to 4px so these all fit the narrowest phone in the table above.
- No canvas strip: pinch to zoom and pan; a small zoom pill (rulers · out · level · in · fit) floats in the bottom-right corner of the Pattern.
- The Progress bar is the largest control on the screen: 56px, its own compact mode (ticket 188) in place of the reference tier's spelled-out one -- a "1/222" counter, Turn row direction, and Row not done/Row done as icon-only buttons (their hover/focus label carries the word) -- and a 3px progress line under it.
- A dock of five buttons, one per kind of tool (the active tool, Color, Edit, Frame, Pattern; no Mirror, which the app hides pending a redesign, ticket 174); each opens its own bottom sheet with every option of that kind. Nothing the desktop has is missing.
- Tool, Colour, Edit and Frame sheets are light: no scrim, only as tall as their content, so the Pattern stays visible; tapping the Pattern or the button again closes them. The Pattern sheet (Canvas color button in its header, save, export, Replace bead, Beads needed, Saved Patterns, New, Import) is modal, with a scrim.
- While a Selection exists, a context bar above the Progress bar offers Copy, Rotate, Remove line and clear; after Copy it turns into "Tap where to paste" with Rotate and Cancel.
- Landscape (height under 500px): the dock becomes a 64px rail on the left, the header drops to 44px.

### iPad mini · 744 – 1023 px

Devices (CSS px): iPad mini 744×1133, iPad · iPad Air 11″ 820×1180, iPad Pro 11″ 834×1210.

- Header 64px: Tools (opens the drawer), the mark and wordmark, the Pattern name, the Bead pill and Replace bead, New Pattern, and a More menu with Import a file, Import QR code, language and theme.
- The left column leaves the page: the Tools button opens it as a drawer (326px) over the canvas, with a scrim. It holds everything the desktop column holds.
- A bottom toolbar keeps the five tools (Hand included), the colour, Undo and Redo under the thumb, so drawing never needs the drawer.
- The Selection context bar from the phone appears above the Progress bar (Copy, Rotate, Remove line, clear; then Paste).
- Canvas box with 12px page padding, its normal radius and border, and the full strip with zoom.

### iPad 13″ · 1024 – 1279 px

Devices (CSS px): iPad Air 13″ 1024×1366, iPad Pro 13″ 1032×1376, iPad mini, landscape 1133×744, iPad 11″, landscape 1180×820.

- The left column is docked again, 300px wide (286px boxes), with 16px page padding and 12px between boxes.
- Beads needed and Saved Patterns start collapsed; the Toolbox and save box stay open.
- Header 64px with the Bead pill and Replace bead; Import a file and Import QR code are icon buttons with tooltips. Keyboard shortcuts shows when a keyboard or trackpad is attached. No bottom toolbar.

### MacBook Air · 1280 – 1919 px

Devices (CSS px): iPad Air 13″, landscape 1366×1024, DESIGN.md reference 1440×900, MacBook Air 13″ 1470×956, MacBook Air 15″ 1710×1107.

- The layout DESIGN.md defines, unchanged: 326px column (312px boxes), page padding 24 / 32, header 64px with every item and its label.
- This is the reference tier: every other tier is described as a change from it.

### 24″ and larger · 1920 and up px

Devices (CSS px): 24″ Full HD 1920×1080, iMac 24″ 2240×1260, 27″ QHD 2560×1440, 32″ 4K 3840×2160.

- The column grows to 360px (344px boxes); page padding 32 / 40; header padding 0 40.
- Beads needed shows 5 colour rows and Saved Patterns 10 thumbnails before they need expanding.
- Type and controls keep their size: the extra space goes to the Pattern, never to bigger chrome.
- Performance: the drawing surface is largest here; ticket 83 checks it on a Core i3-class laptop.

## Smallest bead

Each tier has a floor under the bead size, so zoom out and Fit never draw a bead the rulers cannot label: `bead-min-phone` 16px (12px ruler numbers), and 15px at every other tier. Wider Patterns are panned, not shrunk. See the Rulers card.

## Fitting longer text

- The header fits by priority, not only by tier: when its content does not fit, first Import a file and Import QR code become icon buttons, then the Pattern name is cut with an ellipsis, then the imports move into More. Russian at 1440px takes the first step.
- The ContextBar drops labels right to left (Remove line, Rotate, Copy) and keeps Cancel's label. Dock and BottomToolbar buttons share the width equally.
- See the LongerText card.

## Input, not width

- `@media (pointer: coarse)`: touch and Pencil, at any width: every control keeps its drawn size but gets a `touch-target` (44 × 44px) hit area; tool tiles and swatches are both at least 36px (one grid, so they stay the same size), with their hit areas kept apart by the 6px gap, Dock items 56 × 56.
- Nothing is hover-only on a coarse pointer: the Remove × on Saved Pattern thumbnails is always visible, tooltips become long-press, there is no hover paint preview.
- Keyboard shortcuts shows only when a fine pointer or keyboard is present: `(any-pointer: fine)`.
- A stroke on the drawing surface never scrolls the page: `touch-action: none` on the surface.

## Screen edges and height

- `viewport-fit=cover`: the header pads by `env(safe-area-inset-top)`, the Dock and BottomToolbar by `env(safe-area-inset-bottom)`, the landscape rail by the side insets.
- Heights use `100dvh`, so the mobile address bar never hides the Progress bar or the Dock.
- The page never scrolls at any tier; only the left column, sheets, the drawer and the Pattern scroll.

## Type and performance

- Type sizes do not change between tiers: 14px controls and body everywhere. Only spacing, the column width and which labels show change. On the phone, long Pattern names truncate with an ellipsis.
- The drawing surface resizes once the layout settles (a debounced ResizeObserver), never on every scroll or animation frame. Sheets and the drawer slide with `transform`, so the canvas does not resize when they open (ADR 0018).
- Check with ticket 103's performance run at the phone and iPad sizes, and at 2240px on the Core i3 reference (ticket 83).

## Header menu, Overview and the Tour (v15)

- **Header menu:** a `menu` button next to the logo at every tier (after the mark on the phone, after the wordmark from 744). Below 1024 it holds what More held at that size plus Overview and Take the tour; from 1024 only Overview and Take the tour. They are links, with no check on the current page. See the HeaderMenu card.
- **Overview:** the one page outside the editor. It scrolls as a page; container 1080px (1200px at 24″), padding 16 / 24 / 32 / 40. The features carousel is a list plus a large example from 1024 and swipe cards below; on a MacBook Air it sits above the fold. See the Overview card.
- **Tour placement:** 1024 and up, the card sits right of the left column for its controls, below header controls and above the Progress bar; iPad mini, above the BottomToolbar and below the header, opening the Drawer first for controls inside it; phone, docked under the header, reaching sheet controls through their Dock button. When a control can't be brought on screen, the card is centred with no pointer. See the TourStep card.

## Open canvas and Frame (v16)

The canvas is open at every tier: no board, no size to set first, pieces with their own rulers, and one Frame that marks the Pattern (BeadBoard, Frame and Rulers cards). What differs per tier:

- **Phone:** two fingers move the canvas and pinch zooms; one finger uses the tool. The ZoomPill starts with the Rulers toggle. The Dock's fifth button is Frame, in Size's place; its sheet holds Set Frame, Fit to drawing, the steppers and Remove Frame. While the Frame is being set it has four 16px corner handles and the ContextBar shows its size, Fit to drawing and Done. With no Frame the Progress bar reads "Row progress · Set Frame to start" with a Set Frame button. No CanvasHint.
- **iPad mini:** the BottomToolbar holds five tools (Hand added). The Frame is set from the Frame row in the Drawer or the Progress bar's Set Frame button. The canvas strip shows the Rulers toggle, and the CanvasHint shows, since a keyboard or trackpad may be attached.
- **iPad 13″, MacBook Air, 24″:** the left column's Toolbox has six tool tiles on the swatch grid and the Frame row; the canvas strip has the Rulers toggle; the CanvasHint sits bottom-left. The wheel moves the canvas, ⌘ or Ctrl + wheel zooms.
- **Smallest bead:** the `bead-min-*` floors still hold, for piece rulers and Frame rulers alike. Fit now fits the Frame, or every piece when there is no Frame.
