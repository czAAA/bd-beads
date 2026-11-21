import type { Rotation } from './grid'
import type { RowProgress, SeenWay } from './project'
import type { RowWay } from './rowOrder'
import { startingWay, type Technique } from './weave'

export type { SeenWay }

/** The ways in the order a quarter turn clockwise takes each to the next. */
const CLOCKWISE: readonly SeenWay[] = ['down', 'left', 'up', 'right']

/** A way turned `turns` quarters clockwise (a negative count turns it back). */
export function turnedWay(way: SeenWay, turns: number): SeenWay {
  return CLOCKWISE[(((CLOCKWISE.indexOf(way) + turns) % 4) + 4) % 4]!
}

/** The Frame's own axis and end (spec 1182) that run `way` as seen on a Frame lying at `turn`, its nearest quarter turn
 * on the table: along its own rows or columns, from its first or its last. What its Row order is worked by (the peyote
 * counter's line, the Word chart's Row 1, the ruler's pass marker and pass building); `reversed` is left out, never false. */
export function ownRowWay(way: SeenWay, turn: Rotation): RowWay {
  const own = turnedWay(way, -turn / 90)
  return { direction: own === 'down' || own === 'up' ? 'rows' : 'columns', ...(own === 'up' || own === 'left' ? { reversed: true } : {}) }
}

/** The way as seen that the Frame's own axis and end run on a Frame lying at `turn`: `ownRowWay` the other way round,
 * for a rule worked in the Frame's own lines (Remove line) that must find the pointer it counts on. */
export function seenWayOfOwn({ direction, reversed }: RowWay, turn: Rotation): SeenWay {
  const own: SeenWay = direction === 'rows' ? (reversed ? 'up' : 'down') : reversed ? 'left' : 'right'
  return turnedWay(own, turn / 90)
}

/** Row progress as it starts afresh (spec 1182): at the first pass, the rows running the Frame Technique's starting
 * way as seen (see startingWay), however the Frame or the Canvas lies. A Custom frame works its Row order one way, so it
 * starts along its rows. */
export function startingRowProgress(technique: Technique, shaped = false): RowProgress {
  return { way: shaped ? 'down' : startingWay(technique) }
}

/** Row progress with the way and every pointer's slot turned `turns` quarters clockwise, so each count stays on the
 * Frame's own rows as the Frame turns that far: Rotate Frame with a pass done, and the Canvas carrying the Frame round
 * until 1188. With no pass done Rotate Frame leaves Row progress as it is, so the way sticks as seen. */
export function turnedWithFrame(rowProgress: RowProgress, turns: number): RowProgress {
  const turned: RowProgress = { way: turnedWay(rowProgress.way, turns) }
  for (const way of CLOCKWISE) {
    const count = rowProgress[way]
    if (count) turned[turnedWay(way, turns)] = count
  }
  return turned
}
