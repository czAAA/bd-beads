/** How long (ms) a still press on the Canvas is before it is a hold that opens the Radial toolbox (ticket 1065, spec
 * 1072), kept equal to the CSS `--hold-duration` the hairline is drawn over. */
export const CANVAS_HOLD_MS = 450

/** How long (ms) a finger or the Pencil stays on a control before its Tooltip opens (ticket 0844). Its own length since
 * ticket 1085: the Canvas's hold was made shorter, this one was not. */
export const TOOLTIP_HOLD_MS = 500
