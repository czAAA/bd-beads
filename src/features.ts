/** Features that are built but switched off. The code stays; only the way in is hidden, so a flag here turns one
 * back on. */

/** The Tour (ticket 80), switched off by ticket 247: no menu item, no Overview band, a running Tour does not resume. */
export const TOUR_ENABLED = false

// Mirror (tickets 09, 44–50), switched off by ticket 174 pending a redesign (ADR 0006): no Mirror UI or keys. The
// domain code, session state and live mirroring stay but are inert with no way to raise an axis count. The redo starts
// from ADR 0006's first two points.
export const MIRROR_ENABLED = false
