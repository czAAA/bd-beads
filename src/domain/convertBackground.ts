import { NO_COLOR } from './imageConversion'

/** Tolerance's range (ConvertImage card, 2 Background): how far, in RGB, a color may be from one of the edge's and still
 * be background. 0 takes only the edge's own colors. */
export const BACKGROUND_TOLERANCE = { min: 0, max: 60, start: 20 } as const

/** What the background is found in: a block of bead colors, row by row, packed (imageConversion's pixelPackedAt), with
 * NO_COLOR where the picture has none. */
export interface BackgroundInput {
  colors: Int32Array
  columns: number
  rows: number
  tolerance: number
}

const channelGap = (a: number, b: number, shift: number) => ((a >> shift) & 0xff) - ((b >> shift) & 0xff)

/** The background, found from the edges inward (ConvertImage card, 2 Background; ticket 0780): the colors touching the
 * edge, and those within Tolerance of one of them, as far as they join up with the edge. A place with no color is gone
 * through but not counted. 1 marks a bead found. */
export function findBackground({ colors, columns, rows, tolerance }: BackgroundInput): Uint8Array {
  const found = new Uint8Array(columns * rows)
  const edge = new Set<number>()
  for (let column = 0; column < columns; column += 1) {
    edge.add(colors[column]!)
    edge.add(colors[(rows - 1) * columns + column]!)
  }
  for (let row = 0; row < rows; row += 1) {
    edge.add(colors[row * columns]!)
    edge.add(colors[row * columns + columns - 1]!)
  }
  edge.delete(NO_COLOR)
  const edgeColors = [...edge]
  const reach = tolerance * tolerance
  // A photo repeats its colors: each is weighed against the edge's once.
  const judged = new Map<number, boolean>()
  function isBackground(color: number): boolean {
    if (edge.has(color)) return true
    if (reach === 0) return false
    let known = judged.get(color)
    if (known === undefined) {
      known = edgeColors.some((other) => {
        const r = channelGap(color, other, 16)
        const g = channelGap(color, other, 8)
        const b = channelGap(color, other, 0)
        return r * r + g * g + b * b <= reach
      })
      judged.set(color, known)
    }
    return known
  }

  const visited = new Uint8Array(columns * rows)
  const queue = new Int32Array(columns * rows)
  let tail = 0
  function visit(index: number) {
    if (visited[index]) return
    const color = colors[index]!
    if (color !== NO_COLOR && !isBackground(color)) return
    visited[index] = 1
    if (color !== NO_COLOR) found[index] = 1
    queue[tail] = index
    tail += 1
  }
  for (let column = 0; column < columns; column += 1) {
    visit(column)
    visit((rows - 1) * columns + column)
  }
  for (let row = 0; row < rows; row += 1) {
    visit(row * columns)
    visit(row * columns + columns - 1)
  }
  for (let head = 0; head < tail; head += 1) {
    const index = queue[head]!
    const column = index % columns
    if (column > 0) visit(index - 1)
    if (column < columns - 1) visit(index + 1)
    if (index >= columns) visit(index - columns)
    if (index < (rows - 1) * columns) visit(index + columns)
  }
  return found
}

/** A row's neighbouring found beads, as one piece: where it starts and how many beads it covers. */
export interface FoundRun {
  row: number
  column: number
  columns: number
}

/** The found beads as runs, row by row (ticket 0785): what the preview hatches in one fill. A fill per bead is tens of
 * thousands on a large picture, which Safari rasterizes so slowly the page stalls for seconds. */
export function foundRuns({ found, columns, rows }: { found: Uint8Array; columns: number; rows: number }): FoundRun[] {
  const runs: FoundRun[] = []
  for (let row = 0; row < rows; row += 1) {
    const from = row * columns
    for (let column = 0; column < columns; ) {
      if (!found[from + column]) {
        column += 1
        continue
      }
      let run = 1
      while (column + run < columns && found[from + column + run]) run += 1
      runs.push({ row, column, columns: run })
      column += run
    }
  }
  return runs
}

/** How much of the picture's beads the background takes: the count and its whole percent (the band's and the step's). */
export function backgroundShare(colors: Int32Array, found: Uint8Array): { beads: number; percent: number } {
  let beads = 0
  let all = 0
  for (let index = 0; index < colors.length; index += 1) {
    if (colors[index] === NO_COLOR) continue
    all += 1
    beads += found[index]!
  }
  return { beads, percent: all === 0 ? 0 : Math.round((beads / all) * 100) }
}

/** The colors with the background's beads made empty places (2 Remove): what the colors are then counted from. */
export function withoutBackground(colors: Int32Array, found: Uint8Array): Int32Array {
  return colors.map((color, index) => (found[index] ? NO_COLOR : color))
}
