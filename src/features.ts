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

/**
 * The Dock layout (ticket 383, ADR 0046) is the main layout at every width: the canvas first, the Dock below it, sheets for
 * the controls, the slim Canvas strip always there; no header, no left column, no Toolbox. This flag reads the other way
 * round from the rest of the file: ON is the new normal. OFF restores the Toolbox layout above 1024px and today's 1024px
 * split (ADR 0032), exactly as before. It is a build-time constant because the layout is decided by CSS media queries, which
 * cannot read a script value; the shell carries `app-shell--dock` on its root while this is on.
 */
export const DOCK_LAYOUT_ENABLED = true
