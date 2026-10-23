# Responsive

One layout at every width: the Dock layout (ADR 0046, ticket 412; ADR 0032 and ticket 295 laid it down for phones). The width only decides how much room the canvas has, never which controls there are or where they sit. Every tool and button is reachable at every size.

Devices (CSS px) the layout is checked on: iPhone 16e 390×844, iPhone 17 · 17 Pro 402×874, iPhone Air 420×912, iPhone 17 Pro Max 440×956, the same on their side (844×390, 956×440), iPad mini 744×1133, iPad · iPad Air 11″ 820×1180, iPad Pro 11″ 834×1210, iPad Air 13″ 1024×1366, iPad Pro 13″ 1032×1376, the same on their side, MacBook Air 13″ 1470×956, 24″ Full HD 1920×1080, iMac 24″ 2240×1260, 27″ QHD 2560×1440, 32″ 4K 3840×2160.

The `bp-*` tokens in `tokens.json` stay for the `bead-min-*` and Ruler step rules; no layout rule is written against them any more.

- The screen belongs to the Pattern and the Progress bar. **No header and no left column**: the canvas starts at the top edge, padded by `env(safe-area-inset-top)`. What the header and the column held lives in the Dock's Project and Menu sheets (the open Pattern's name, size, bead and save state, Save and Export, Beads needed and Saved Patterns in the Project sheet; language, theme, Name on exports, Keyboard shortcuts when a keyboard is attached, Overview and the source link in the Menu). Undo, Redo, Rulers and zoom are in the Canvas strip (ticket 425).
- A slim Canvas strip stays above the canvas at every width: Rulers, Undo, Redo, zoom out, level, zoom in and Fit, the cluster scrolling sideways on a phone (ticket 425).
- Pinch to zoom and pan; the Canvas strip has the same zoom buttons for a fit or an exact step.
- The Progress bar is the largest control on the screen: 48px (ticket 411), or 88px at 30rem and under, where Row not done/Row done take a second row -- the switch with Turn row direction beside it, a "1/222" counter, the track, and Row not done/Row done as large text buttons whose label and arrow follow Row direction. It is shown at every width, whether or not Row progress is on, and its switch is the only way to turn Row progress on or off.
- **The Tool pill (ToolPill card, ticket 0439) replaces the Dock:** the canvas box fills the screen 12px from each edge and the tools float as a pill over the drawing area, docked to any edge; the Colour sheet becomes a popover beside the pill. The Dock lines below describe the app until that ships.
- **A slim, icon-only Dock of five buttons** (Tool, Colour, Frame, Pattern, Menu): 48px plus `env(safe-area-inset-bottom)` (at most 4px) in portrait and landscape alike, at most 480px wide and centred, whatever the screen's width. No text labels: each button keeps its name as an accessible name and a Tooltip. With no Pattern open, the New Pattern / Import bar replaces the Dock, with the Menu button at its bottom right.
- Tool, Colour and Frame sheets are light: no scrim, only as tall as their content, so the Pattern stays visible; tapping the Pattern or the button again closes them. The Frame sheet also holds Rotate, Copy and Paste. The Pattern sheet (name and size, save, export, Replace bead, Beads needed, Saved Patterns, New, Import) and the Menu sheet are modal, with a scrim.
- While a Selection exists, a bar anchored above it offers Copy, Cut, Fill, Frame and Clear selection (ticket 415): 28px high (36px on touch), icon-only, always inside the canvas box, flipping below the Selection when there is no room above; Copy arms paste mode and the bar is gone until it is left (ticket 437, ContextBar card).
- **Frame bar:** while the Frame is being set, the Frame's size, Fit to drawing, ✕ and Done float at the top-centre of the canvas box over the beads, taking no row and never covering the Dock.
- **Wide screens:** the extra space goes to the Pattern, never to bigger chrome. Type and controls keep their size. The surface is largest at 24″ and up; ticket 83 checks it on a Core i3-class laptop.

## Smallest bead

Only the canvas zooms at every size: the browser's Page zoom is locked (ADR 0034), so the Dock and sheets never change size, and ⌘ or Ctrl + plus, minus and 0 zoom the canvas. The Zoom floor is 10% on every size (ADR 0033); zoom out, pinch, wheel and Fit all reach it, and Fit stays capped at 100%. The rulers thin their numbers instead (the Ruler step: every 5, 10, 50, 100 beads as room allows). `bead-min-phone` 16px (12px ruler numbers) and `bead-min-tablet` 15px mark where a number needs more room. See the Rulers card.

## Fitting longer text

- The Selection bar has no labels (ticket 415); it folds its last actions into a "…" menu when it cannot fit. The Dock is icon-only, so its names never need to fit.
- See the LongerText card.

## Input, not width

- `@media (pointer: coarse)`: touch and Pencil, at any width: every control keeps its drawn size but gets a `touch-target` (44 × 44px) hit area; tool tiles and swatches are both at least 36px (one grid, so they stay the same size), with their hit areas kept apart by the 6px gap, Dock items are 48px tall and keep their `touch-target` hit area.
- Nothing is hover-only on a coarse pointer: the Remove × on Saved Pattern thumbnails is always visible, tooltips become long-press, there is no hover paint preview.
- Hotkey chips follow the device (ticket 438): shown with a hovering fine pointer or once a real keyboard key is seen, otherwise hidden; the switch in Keyboard shortcuts overrides it. Keyboard shortcuts itself is in the phone menu on every device.
- A stroke on the drawing surface never scrolls the page: `touch-action: none` on the surface.

## Screen edges and height

- `viewport-fit=cover`: the canvas pads by `env(safe-area-inset-top)`, the Dock by `env(safe-area-inset-bottom)`, and the canvas by the side insets.
- The shell is `position: fixed; inset: 0`, so the mobile address bar never hides the Progress bar or the Dock and no band of page shows under it (`100dvh` can fall short of the screen on iOS).
- The page never scrolls at any width; only sheets and the Pattern scroll.

## Type and performance

- Type sizes do not change between tiers: 14px controls and body everywhere. Long Pattern names truncate with an ellipsis.
- The drawing surface resizes once the layout settles (a debounced ResizeObserver), never on every scroll or animation frame. Sheets slide with `transform`, so the canvas does not resize when they open (ADR 0018).
- Check with ticket 103's performance run at the phone sizes in portrait and landscape, and at 2240px on the Core i3 reference (ticket 83).

## Header menu, Overview and the Tour (v15)

- **Menu and Project (spec 0440):** both open as a dropdown under their buttons on every screen size (ADR 0071), with the same rows, sizes and animation; the strip's two buttons stay lit. On a narrow screen the dropdown is held 8px from the screen's edge, and a tall panel scrolls inside the room below its button. Rows grow with their content and never have a fixed height. See the MenuPanel and ProjectPanel cards.
- **Overview:** the one page outside the editor. It scrolls as a page; container 1080px (1200px at 24″), padding 16 / 24 / 32 / 40. The features carousel is a list plus a large example from 1024 and swipe cards below; on a MacBook Air it sits above the fold. See the Overview card.
- **Tour placement:** docked above the Dock, reaching sheet controls through their Dock button. When a control can't be brought on screen, the card is centred with no pointer. See the TourStep card.

## Open canvas and Frame (v16)

The canvas is open at every width: no board, no size to set first, pieces with their own rulers, and one Frame that marks the Pattern (BeadBoard, Frame and Rulers cards). What the layout gives it:

- **Phone, tablet and desktop:** two fingers move the canvas and pinch zooms; one finger uses the tool. The Canvas strip starts with the Rulers toggle. The Dock's third button is Frame; its sheet holds Set Frame, Fit to drawing, the steppers, Remove Frame, Rotate, Copy and Paste. While the Frame is being set it has four 16px corner handles and the Frame bar floats at the top-centre of the canvas box with its size, Fit to drawing, ✕ and Done. With no Frame the Progress bar reads "Row progress · Set Frame to start" with a Set Frame button. No CanvasHint.
- **Wheel and keyboard:** the wheel moves the canvas, ⌘ or Ctrl + wheel zooms.
- **Zoom floor:** 10%, with the Ruler step, for piece rulers and Frame rulers alike. Fit now fits the Frame, or every piece when there is no Frame.
