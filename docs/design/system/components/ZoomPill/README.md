# ZoomPill

The phone's zoom control: the Rulers toggle, zoom out, fit and zoom in, floating in the bottom-right corner of the Pattern.

- `canvas` pill, 1px `line`, `elevation-1`; 36px buttons with 18px icons; the order is out, the level, in, Fit, as on the CanvasStrip; the level is DM Mono `type-meta`, 48px wide and centered so the buttons don't shift (ticket 287; it was hidden by tickets 143 and 215). Zoom runs 10% to 400% in 10% steps, and the tier's smallest-bead floor wins where it is higher.
- The Rulers toggle (v16) comes first: the `ruler` icon, pressed as an `ink` circle with a `canvas` icon. Pinch zooms and two fingers move the open canvas; the pill is for fit and exact steps. On larger screens the canvas strip holds the same controls.

Hand-written from the responsive sign-off; static rendition.
