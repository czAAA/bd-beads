import { changedRows, sameFrame, type BeadMap } from './canvas'
import type { Layer } from './grid'
import { beadIdOfLayer, frameOf, heldWeave, layerOf, type Layered } from './layerRecord'
import { sameWeave } from './layerWeave'

// Beads since last file (SaveReminder card, ticket 0796): how much drawing a Project's last Project file on this device
// is behind, and when the save ring and its label show.

/** What the device keeps per Project beside its library entry, never in the Project or its file (ticket 0796). */
export interface SinceFile {
  /** Bead positions changed by drawing since the last Project file; never below 0. */
  beads: number
  /** When a Project file of it was last saved on this device; absent when it never was. */
  lastFileAt?: number
  /** That file's name, which the Project panel's Save row shows (ticket 0859); absent in records older builds wrote. */
  fileName?: string
}

const DAY_MS = 24 * 60 * 60 * 1000

/** The ring shows from this many beads, or from {@link PERSISTED_THRESHOLD} where the browser keeps storage. */
export const SAVE_THRESHOLD = 50
/** Storage pressure can't clear a persisted library (ticket 399), so the ring waits twice as long. */
const PERSISTED_THRESHOLD = 100
/** After the threshold, the label opens again every this many beads. */
const LABEL_EVERY = 100
/** A Project opening at the threshold with its last file this old opens the label once. @internal Tests date files by it. */
export const STALE_FILE_MS = 7 * DAY_MS

/** How many positions hold a different value in two bead maps; rows both share by reference cost nothing (ADR 0036). */
function changedPositions(before: BeadMap, after: BeadMap): number {
  let count = 0
  for (const row of changedRows(before, after)) {
    const [was, now] = [before[row] ?? {}, after[row] ?? {}]
    for (const key in now) if (was[Number(key)] !== now[Number(key)]) count += 1
    for (const key in was) if (now[Number(key)] === undefined) count += 1
  }
  return count
}

/** Whether a layer's beads may be compared across an Edit: it is there before and after with the same Technique and
 * Bead, and a Frame in the same place, size and turn (moving or turning it is no drawing). */
function comparable(before: Layered, after: Layered, layer: Layer): boolean {
  const [was, now] = [layerOf(before, layer), layerOf(after, layer)]
  if (!was || !now || beadIdOfLayer(before, layer) !== beadIdOfLayer(after, layer)) return false
  if (!sameWeave(heldWeave(before, layer)!, heldWeave(after, layer)!)) return false
  if (layer === 'canvas') return true
  const [x, y] = [frameOf(before)!, frameOf(after)!]
  return sameFrame(x, y) && x.quarterTurns === y.quarterTurns
}

/** An Edit's count (ticket 0796): the bead positions whose value differs between its before and after layers, skipping
 * a layer whose Technique or Bead changed. Symmetric, so Undo takes off and Redo puts back the same number. */
export function changedBeadCount(before: Layered, after: Layered): number {
  return (['canvas', 'frame'] as const).reduce(
    (count, layer) => count + (comparable(before, after, layer) ? changedPositions(layerOf(before, layer)!.beads, layerOf(after, layer)!.beads) : 0),
    0,
  )
}

/** The count moved by `delta` beads (an Edit or Redo adds, Undo takes off), never below 0. */
export function countedBeads(since: SinceFile, delta: number): SinceFile {
  return { ...since, beads: Math.max(0, since.beads + delta) }
}

/** The ring's threshold: {@link PERSISTED_THRESHOLD} once the browser keeps storage, else {@link SAVE_THRESHOLD}. */
export function saveThreshold(persisted: boolean): number {
  return persisted ? PERSISTED_THRESHOLD : SAVE_THRESHOLD
}

/** Which label step a count is at: -1 below the threshold, 0 from it, then 1 more every {@link LABEL_EVERY} beads.
 * The label opens when the step goes up. */
export function labelStep(beads: number, threshold: number): number {
  return beads < threshold ? -1 : Math.floor((beads - threshold) / LABEL_EVERY)
}

/** Whether a Project opening with this count and last file (or creation) time should open the label once: at the
 * threshold or above and 7 days or more behind. */
export function staleOnOpen(since: SinceFile, createdAt: number, threshold: number, now: number): boolean {
  return since.beads >= threshold && now - (since.lastFileAt ?? createdAt) >= STALE_FILE_MS
}


/** How long ago a last file was, in whole calendar days, weeks, months or years, for `Intl.RelativeTimeFormat` with
 * `numeric: "auto"` (today, yesterday, 2 days ago): the save ring's Tooltip's "Last file: {when}". */
export function lastFileAgo(then: number, now: number): { value: number; unit: 'day' | 'week' | 'month' | 'year' } {
  const midnight = (time: number) => new Date(time).setHours(0, 0, 0, 0)
  const days = Math.round((midnight(now) - midnight(then)) / DAY_MS)
  if (days < 7) return { value: days === 0 ? 0 : -days, unit: 'day' }
  if (days < 30) return { value: -Math.floor(days / 7), unit: 'week' }
  if (days < 365) return { value: -Math.floor(days / 30), unit: 'month' }
  return { value: -Math.floor(days / 365), unit: 'year' }
}
