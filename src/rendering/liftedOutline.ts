// The outline of a lifted Frame (ticket 1177, BeadBoard card, Lifted Frame): the cells of its beads joined and grown by the
// ground's width, an exact rectilinear shape with its holes filled, traced into loops once for a layout of beads. Pure
// numbers: `liftedFrame.ts` turns the loops into the rounded paths a canvas fills.

/** A cell's body in grid px: the part of a bead that is drawn, from its cell's corner. */
export interface LiftBody {
  x: number
  y: number
  width: number
  height: number
}

/** A loop of corners, clockwise on the screen (y down), the shape inside on the right of each edge. */
export type Loop = readonly (readonly [number, number])[]

/** What a layout of beads leaves the shape as. */
export interface LiftOutline {
  /** The outer border, one loop for each piece (holes and gaps closed in). */
  loops: readonly Loop[]
  /** Whether a point lies in the shape or in a hole it closes in: where an empty position lies on a piece. */
  covers(x: number, y: number): boolean
  /** Whether the shape would hold a body grown by `out` as it is: a bead added there changes nothing of the outline. */
  holds(body: LiftBody): boolean
}

/** Less than a thousandth of a px. */
const EPSILON = 0.0005

/** The lines are told apart to a thousandth of a px. */
const key = (v: number): number => Math.round(v * 1000)

/** The index of the greatest line at or below `v`, or -1 before the first. */
function indexBelow(lines: readonly number[], v: number): number {
  let low = 0
  let high = lines.length - 1
  let found = -1
  while (low <= high) {
    const mid = (low + high) >> 1
    if (lines[mid]! <= v) {
      found = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return found
}

/** The four steps along an edge, clockwise: east, south, west, north (y down). */
const STEP = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
] as const

/** The outline of `bodies` grown by `out` on every side: the union of the grown rectangles, its holes filled, as loops.
 * A gap narrower than twice `out` closes by itself. `null` where there is no body. */
export function outlineOf(bodies: readonly LiftBody[], out: number): LiftOutline | null {
  if (bodies.length === 0) return null
  const xSet = new Set<number>()
  const ySet = new Set<number>()
  for (const { x, y, width, height } of bodies) {
    xSet.add(key(x - out))
    xSet.add(key(x + width + out))
    ySet.add(key(y - out))
    ySet.add(key(y + height + out))
  }
  const xKeys = [...xSet].sort((a, b) => a - b)
  const yKeys = [...ySet].sort((a, b) => a - b)
  const xAt = new Map(xKeys.map((k, i) => [k, i]))
  const yAt = new Map(yKeys.map((k, i) => [k, i]))
  const xs = xKeys.map((k) => k / 1000)
  const ys = yKeys.map((k) => k / 1000)
  const columns = xs.length - 1
  const rows = ys.length - 1
  const filled = new Uint8Array(columns * rows)
  for (const { x, y, width, height } of bodies) {
    const [left, right] = [xAt.get(key(x - out))!, xAt.get(key(x + width + out))!]
    const [top, bottom] = [yAt.get(key(y - out))!, yAt.get(key(y + height + out))!]
    for (let j = top; j < bottom; j += 1) filled.fill(1, j * columns + left, j * columns + right)
  }

  // What the outside reaches from the border is open; the rest of the empty cells are holes, closed in.
  const outside = new Uint8Array(columns * rows)
  const stack: number[] = []
  const reach = (i: number, j: number) => {
    const at = j * columns + i
    if (!filled[at] && !outside[at]) {
      outside[at] = 1
      stack.push(at)
    }
  }
  for (let i = 0; i < columns; i += 1) {
    reach(i, 0)
    reach(i, rows - 1)
  }
  for (let j = 0; j < rows; j += 1) {
    reach(0, j)
    reach(columns - 1, j)
  }
  while (stack.length) {
    const at = stack.pop()!
    const [i, j] = [at % columns, Math.floor(at / columns)]
    if (i > 0) reach(i - 1, j)
    if (i < columns - 1) reach(i + 1, j)
    if (j > 0) reach(i, j - 1)
    if (j < rows - 1) reach(i, j + 1)
  }
  const inside = (i: number, j: number) => i >= 0 && j >= 0 && i < columns && j < rows && !outside[j * columns + i]

  return {
    loops: traceLoops(xs, ys, columns, rows, inside),
    covers: (x, y) => inside(indexBelow(xs, x), indexBelow(ys, y)),
    holds: ({ x, y, width, height }) => {
      const [x1, y1] = [x + width + out - EPSILON, y + height + out - EPSILON]
      const [first, top] = [indexBelow(xs, x - out), indexBelow(ys, y - out)]
      if (first < 0 || top < 0 || x1 > xs[columns]! || y1 > ys[rows]!) return false
      for (let j = top; j < rows && ys[j]! < y1; j += 1) {
        for (let i = first; i < columns && xs[i]! < x1; i += 1) if (!inside(i, j)) return false
      }
      return true
    },
  }
}

/** The loops round the filled cells of a compressed grid, clockwise, each a run of corners with no straight-through one. */
function traceLoops(xs: readonly number[], ys: readonly number[], columns: number, rows: number, inside: (i: number, j: number) => boolean): Loop[] {
  const stride = columns + 1
  // Edges leaving a corner, by direction: the cell they have on their right is inside, the one on the left is not.
  const leaving = new Map<number, number>()
  const mark = (i: number, j: number, direction: number) => {
    const at = j * stride + i
    leaving.set(at, (leaving.get(at) ?? 0) | (1 << direction))
  }
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < columns; i += 1) {
      if (!inside(i, j)) continue
      if (!inside(i, j - 1)) mark(i, j, 0)
      if (!inside(i + 1, j)) mark(i + 1, j, 1)
      if (!inside(i, j + 1)) mark(i + 1, j + 1, 2)
      if (!inside(i - 1, j)) mark(i, j + 1, 3)
    }
  }

  const loops: Loop[] = []
  const used = new Set<number>()
  for (const [start, bits] of leaving) {
    for (let first = 0; first < 4; first += 1) {
      if (!(bits & (1 << first)) || used.has(start * 4 + first)) continue
      const corners: [number, number][] = []
      let at = start
      let direction = first
      while (!used.has(at * 4 + direction)) {
        used.add(at * 4 + direction)
        corners.push([xs[at % stride]!, ys[Math.floor(at / stride)]!])
        at += STEP[direction]![1] * stride + STEP[direction]![0]
        const here = leaving.get(at)!
        // The sharpest right turn first, so pieces touching at a corner stay apart.
        direction = [1, 0, 3].map((turn) => (direction + turn) % 4).find((d) => here & (1 << d))!
      }
      loops.push(withoutStraight(corners))
    }
  }
  return loops
}

/** A loop without the corners an edge runs straight through. */
function withoutStraight(corners: readonly (readonly [number, number])[]): Loop {
  const count = corners.length
  return corners.filter(([x, y], at) => {
    const [px, py] = corners[(at + count - 1) % count]!
    const [nx, ny] = corners[(at + 1) % count]!
    return !((px === x && x === nx) || (py === y && y === ny))
  })
}
