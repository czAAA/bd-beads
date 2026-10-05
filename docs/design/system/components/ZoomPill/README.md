# ZoomPill

The phone's zoom control: the Rulers toggle, zoom out, fit and zoom in, floating in the bottom-right corner of the Pattern.

- `canvas` pill, 1px `line`, `elevation-1`; 36px buttons with 18px icons; there is no level readout, and the order is out, Fit, in, as on the CanvasStrip (ticket 215: the percentage is not shown; the smallest zoom is 50%).
- The Rulers toggle (v16) comes first: the `ruler` icon, pressed as an `ink` circle with a `canvas` icon. Pinch zooms and two fingers move the open canvas; the pill is for fit and exact steps. On larger screens the canvas strip holds the same controls.

Hand-written from the responsive sign-off; static rendition.
