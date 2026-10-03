/**
 * Features that are built but switched off. The code stays; only the way in is hidden, so turning one back on is
 * flipping its flag here.
 */

/**
 * The Tour (ticket 80), switched off by ticket 247: no "Take the tour" menu item, no Tour band on the Overview, and a
 * Tour left running on a device does not resume. The Tour's own code and tests stay.
 */
export const TOUR_ENABLED = false
