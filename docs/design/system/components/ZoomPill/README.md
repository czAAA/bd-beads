# ZoomPill

The phone's zoom control: the Rulers toggle, zoom out, fit and zoom in, floating in the bottom-right corner of the Pattern.

- `canvas` pill, 1px `line`, `elevation-1`; 36px buttons with 18px icons; the order is out, the level, in, Fit, as on the CanvasStrip; the level is DM Mono `type-meta`, 48px wide and centered so the buttons don't shift (ticket 287; it was hidden by tickets 143 and 215). Zoom runs 10% to 400% in 10% steps, and the tier's smallest-bead floor wins where it is higher.
- The Rulers toggle (v16) comes first: the `ruler` icon, pressed as an `ink` circle with a `canvas` icon. Pinch zooms and two fingers move the open canvas; the pill is for fit and exact steps. On larger screens the canvas strip holds the same controls.

- The pill has no handle (ticket 302; ticket 297 gave it one). A drag from any point on it, the gaps, the zoom level and the buttons alike, by touch, Pencil or mouse, moves it anywhere inside the canvas box (never over the Dock, which sits outside the box), clamped so it stays fully inside; it does not draw or pan. A press that travels less than 6px is a tap and presses the button under it; a drag never presses the button it started on, and that button's Tooltip stays closed while the pill is dragged. The dragged state lifts the pill to `elevation-2` and the cursor turns `grabbing`. On release the pill glides (`duration-base`, `ease-out`; no glide with reduced motion) to the nearest corner and rests there 16px from the edges. Alt + an arrow key, with focus anywhere in the pill, sends it to the neighbouring corner and announces the new corner once. The corner is kept on the device, and the Frame bar and Selection context bar keep clear of the pill.

Hand-written from the responsive sign-off.
