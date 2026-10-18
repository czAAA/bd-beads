import type { PendingEntry } from './textFitPending'

// Tooltips that are cut off and not yet fixed (ticket 264); same shape and rules as textFitPending.ts. An entry that
// stops failing fails the check until removed. Ticket 265 fixed them all, so the list is empty and the check is strict
// for any future cut-off.
export const HOVER_PENDING: PendingEntry[] = []
