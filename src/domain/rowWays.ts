import type { RowProgress } from './project'
import { startingWay, type Technique } from './weave'

/** Which way the rows run on the Canvas, as an arrow points: down is top to bottom. */
export type ShownWay = 'down' | 'left' | 'up' | 'right'

/** The ways in the order a quarter turn clockwise takes each to the next. */
const CLOCKWISE: readonly ShownWay[] = ['down', 'left', 'up', 'right']

/** A way turned `turns` quarters clockwise (a negative count turns it back). */
export function turnedWay(way: ShownWay, turns: number): ShownWay {
  return CLOCKWISE[(((CLOCKWISE.indexOf(way) + turns) % 4) + 4) % 4]!
}

/** The Frame's own way (along its own rows or columns, from its first or its last) as an arrow on its upright grid. */
export function ownWayOf({ direction, reversed }: Pick<RowProgress, 'direction' | 'reversed'>): ShownWay {
  return direction === 'rows' ? (reversed ? 'up' : 'down') : reversed ? 'left' : 'right'
}

/** The Frame's own direction and end that run `way` on its upright grid; `reversed` is left out, never false. */
export function ownDirection(way: ShownWay): Pick<RowProgress, 'direction' | 'reversed'> {
  return { direction: way === 'down' || way === 'up' ? 'rows' : 'columns', ...(way === 'up' || way === 'left' ? { reversed: true } : {}) }
}

/** Row progress as it starts afresh (spec 1182): at the first pass, the rows running the Frame Technique's starting way
 * as seen (see startingWay), its own rows lying `seenTurns` quarters clockwise on screen. A Custom frame works its Row
 * order one way, so it starts along its rows. Callers go through `startingRowProgressOf`, which knows how the Frame lies. */
export function startingRowProgress(technique: Technique, seenTurns = 0, shaped = false): RowProgress {
  if (shaped) return { direction: 'rows', currentRow: 0, currentColumn: 0 }
  return { ...ownDirection(turnedWay(startingWay(technique), -seenTurns)), currentRow: 0, currentColumn: 0 }
}

/** The pointer each of the Frame's own ways counts on. */
const POINTER_OF: Record<ShownWay, 'currentRow' | 'currentColumn' | 'currentRowBack' | 'currentColumnBack'> = {
  down: 'currentRow',
  right: 'currentColumn',
  up: 'currentRowBack',
  left: 'currentColumnBack',
}

/** Row progress kept as seen while the Frame's own rows turn `turns` quarters clockwise on screen (Rotate Frame, spec
 * 1182): its own way and each pointer's slot step back as far, so the way and every count stay where they were seen. */
export function keptAsSeen(rowProgress: RowProgress, turns: number): RowProgress {
  const kept: RowProgress = { ...ownDirection(turnedWay(ownWayOf(rowProgress), -turns)), currentRow: 0, currentColumn: 0 }
  for (const way of CLOCKWISE) {
    const count = rowProgress[POINTER_OF[way]]
    if (count) kept[POINTER_OF[turnedWay(way, -turns)]] = count
  }
  return kept
}
