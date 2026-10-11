import type { InfoPopover } from './hoverSource'

/**
 * What the hover text check lets be (ticket 264). Each entry has a written reason; add one only with a reason a
 * reviewer would accept, and delete it when the thing it excuses is gone.
 */

/**
 * Native `title` attributes that show hover text, as `file|what`. None are left (ADR 0035, ticket 341): hover text is
 * the shared Tooltip's, so that it gets its look, its keyboard and touch way in, and this check's measuring.
 */
export const NATIVE_TITLES: Record<string, string> = {}

/**
 * The hand-made hover texts: info popovers, opened by click (or the info button's focus) rather than hover, whose own
 * `role="tooltip"` is not the shared Tooltip's. The text fit check measures them (ticket 229); the hover text check
 * only needs them listed once, here, and seen open. Another one made by hand is a failure of the source guard. None are
 * left (ticket 342 removed the New Project form's Estimate info popup).
 */
export const INFO_POPOVERS: InfoPopover[] = []

/**
 * Places in the source that make a Tooltip which no screen opens, by component name (or `info:<test id>`), each with
 * why. The first thing to try for one that is not seen open is a screen that reaches its state, in
 * e2e/visual/textFit.spec.ts; an exemption is for a Tooltip no state of the app can show.
 */
export const UNREACHED: Record<string, string> = {
  MirrorControls: 'not mounted anywhere in the app today (ticket 79 pulled it out of the Toolbox for a Mirror ToolSheet that is not built); only its own unit test renders it',
}
