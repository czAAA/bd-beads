import type { PendingEntry } from './textFitPending'

/**
 * The Tooltips that are cut off and not yet fixed (ticket 264), so that the hover text check can stay green while they
 * are fixed. The same shape and rules as the text fit check's list (textFitPending.ts): `screen` is the screen the cut-off
 * Tooltip was first seen on, `texts` the Tooltip's own text, `at` the widths in each language where it is cut. An entry
 * that stops failing fails the check until it is removed. Ticket 265 fixed them all and deleted every entry; the list is empty, so the check is strict, and stays for any Tooltip that is cut off in future.
 */
export const HOVER_PENDING: PendingEntry[] = []
