import type { RowProgress } from './project'
import { startingWay, type Technique } from './weave'

/** Which way the rows run on the Canvas, as an arrow points: down is top to bottom. */
export type ShownWay = 'down' | 'left' | 'up' | 'right'

/** The ways in the order a quarter turn clockwise takes each to the next. */
export const CLOCKWISE: readonly ShownWay[] = ['down', 'left', 'up', 'right']

/** Row progress as a new Frame woven in this Technique starts out: at the first pass, the rows running the Technique's
 * starting way as seen (see startingWay), the Canvas lying turned `seenTurns` quarters clockwise. The Frame keeps its own
 * way whatever turns follow; a Custom frame works its Row order one way, so it starts along its rows. */
export function startingRowProgress(technique: Technique, seenTurns = 0, shaped = false): RowProgress {
  if (shaped) return { direction: 'rows', currentRow: 0, currentColumn: 0 }
  const own = CLOCKWISE[(CLOCKWISE.indexOf(startingWay(technique)) - seenTurns + 4) % 4]!
  const direction = own === 'down' || own === 'up' ? ('rows' as const) : ('columns' as const)
  return { direction, ...(own === 'up' || own === 'left' ? { reversed: true } : {}), currentRow: 0, currentColumn: 0 }
}
