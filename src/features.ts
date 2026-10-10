/**
 * Features that are built but switched off. The code stays; only the way in is hidden, so turning one back on is
 * flipping its flag here.
 */

/**
 * The Tour (ticket 80), switched off by ticket 247: no "Take the tour" menu item, no Tour band on the Overview, and a
 * Tour left running on a device does not resume. The Tour's own code and tests stay.
 */
export const TOUR_ENABLED = false

/**
 * Mirror (tickets 09, 44–50), switched off by ticket 174 pending its own redesign (ADR 0006): no Mirror row in the
 * Toolbox, no Mirror button or sheet on the phone, no Mirror group in the shortcuts help, and no Mirror keys. The
 * domain code, the session state and live mirroring while drawing stay; with no way to raise an axis count they stay
 * inert. The redo starts from ADR 0006's first two points.
 */
export const MIRROR_ENABLED = false
