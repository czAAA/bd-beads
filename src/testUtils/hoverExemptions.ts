import type { InfoPopover } from './hoverSource'

/** What the hover text source guards let be (tickets 264, 552): each entry needs a written reason a reviewer would accept;
 * delete it when moot. */

/** Native `title` attributes that show hover text, as `file|what`. None left (ADR 0035, ticket 341): hover text is
 * the shared Tooltip's. */
export const NATIVE_TITLES: Record<string, string> = {}

// Hand-made hover texts (info popovers opened by click or the info button's focus, own `role="tooltip"`): text fit
// measures them (ticket 229); the hover text check needs them listed here and seen open. A new hand-made one fails the
// source guard. None are left (ticket 342 removed the New Project form's Estimate info popup).
export const INFO_POPOVERS: InfoPopover[] = []
