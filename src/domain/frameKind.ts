import type { FrameSheet } from './canvas'
import { rowsOrder, type RowOrder, type RowWay } from './rowOrder'
import type { Weave } from './weave'

/** The Frame kinds (spec 0590, ADR 0077): what sort of Frame it is. Rectangular is the Frame as it has always been;
 * the Custom frame kinds join it from ticket 0593. */
export type FrameKindId = 'rectangular'

/** The kind a Frame with none stored is: every Frame made before kinds, and every Rectangular one, as it is left
 * unsaved. */
export const DEFAULT_FRAME_KIND: FrameKindId = 'rectangular'

/** A Frame as its kind reads it: its kind, its size and its Weave. */
export type KindedSheet = Pick<FrameSheet, 'kind' | 'rows' | 'columns'> & Weave

/** Everything that differs by Frame kind; code asks the Frame's kind rather than testing which it is. Its settings,
 * the tools it allows and how it is exported join with the first Custom frame kind, the first to differ. */
export interface FrameKind {
  id: FrameKindId
  /** What Remove Frame does with the Frame's beads: drop them onto the Canvas where they stand (ticket 497), or
   * remove them with the Frame. */
  removedBeads: 'dropped' | 'removed'
  /** How Row progress steps through the Frame, worked one way. */
  rowOrder(sheet: KindedSheet, way: RowWay): RowOrder
}

/** The registry, one entry per kind, like the Starters'. */
const FRAME_KINDS: Readonly<Record<FrameKindId, FrameKind>> = {
  rectangular: {
    id: 'rectangular',
    removedBeads: 'dropped',
    // Chosen by the Frame's Technique, through its Weave's passes.
    rowOrder: rowsOrder,
  },
}

/** Whether a stored value names a Frame kind. */
export function isFrameKind(value: unknown): value is FrameKindId {
  return typeof value === 'string' && Object.hasOwn(FRAME_KINDS, value)
}

/** The kind of a Frame: its own, or Rectangular when it has none. */
export function frameKindOf(frame: Pick<FrameSheet, 'kind'>): FrameKind {
  return FRAME_KINDS[frame.kind ?? DEFAULT_FRAME_KIND]
}

/** The Frame's Row order worked one way: what Row progress's first row, current row, next row and pass count ask. */
export function rowOrderOf(sheet: KindedSheet, way: RowWay): RowOrder {
  return frameKindOf(sheet).rowOrder(sheet, way)
}
