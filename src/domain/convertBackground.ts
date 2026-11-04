import { colorDistance, toOklab, type Oklab } from './color'
import { NO_COLOR } from './imageConversion'

/** Tolerance's range (ConvertImage card, 2 Background; ticket 0787): how far, in hundredths of an OKLab distance, a bead's
 * color may be from a background family and still be background. 10 takes a photo's noise and soft shading round a
 * plain field; 40 reaches well into colors that only look alike. */
export const BACKGROUND_TOLERANCE = { min: 2, max: 40, start: 10 } as const

/** What the background is found in: a block of bead colors, row by row, packed (imageConversion's pixelPackedAt), with
 * NO_COLOR where the picture has none. */
export interface BackgroundInput {
  colors: Int32Array
  columns: number
  rows: number
  tolerance: number
}

/** One step made with the Background tool (ConvertImage card, Preview pane; ticket 0787): the beads a tap or a drag
 * crossed, as indices into the block, and what it does to the patch under each. `keep` takes a found patch out of the
 * background; `remove` puts a kept patch in. */
export interface BackgroundMark {
  kind: 'keep' | 'remove'
  beads: readonly number[]
}

/** How close two border colors are, in OKLab, to be one family (as beadAreaColor groups a bead's pixels). */
const FAMILY_DISTANCE = 0.07
/** The smallest share of the border a family must cover to be background: a subject touching the edge in a few beads
 * does not make its own colors background. */
const MIN_FAMILY_SHARE = 0.02
/** At most this many background families; a border with more colors than this has no plain background to take. */
const MAX_FAMILIES = 16
/** A family this many times more present in the picture's middle third than on its border is the subject touching the
 * edge (a close-up), not the background behind it. */
const MIDDLE_WEIGHT = 1.5
/** A mark's patch reaches this many times the Tolerance from the tapped bead's color: it is held by what it touches and
 * by the beads' state, so it can be wider than the edge fill without eating the subject, and a tap on fur takes a patch. */
const MARK_REACH = 2

type Lab = (packed: number) => Oklab

/** Tolerance as the OKLab distance it stands for: the slider reads in hundredths. */
const reachOf = (tolerance: number) => tolerance / 100

/** OKLab of each packed color, worked out once: a photo repeats its colors. */
function oklabLookup(): Lab {
  const known = new Map<number, Oklab>()
  return (packed) => {
    let color = known.get(packed)
    if (color === undefined) {
      color = toOklab({ r: (packed >> 16) & 0xff, g: (packed >> 8) & 0xff, b: packed & 0xff })
      known.set(packed, color)
    }
    return color
  }
}

interface Family {
  color: Oklab
  beads: number
}

/** The colors round the block's border as families, most beads first, and how many border beads have a color. */
function borderFamilies(colors: Int32Array, columns: number, rows: number, lab: Lab) {
  const counts = new Map<number, number>()
  let withColor = 0
  const count = (index: number) => {
    const packed = colors[index]!
    if (packed === NO_COLOR) return
    counts.set(packed, (counts.get(packed) ?? 0) + 1)
    withColor += 1
  }
  for (let column = 0; column < columns; column += 1) {
    count(column)
    if (rows > 1) count((rows - 1) * columns + column)
  }
  for (let row = 1; row < rows - 1; row += 1) {
    count(row * columns)
    if (columns > 1) count(row * columns + columns - 1)
  }
  const families: Family[] = []
  for (const [packed, beads] of [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])) {
    const color = lab(packed)
    const near = families.find((family) => colorDistance(family.color, color) < FAMILY_DISTANCE)
    if (near) near.beads += beads
    else families.push({ color, beads })
  }
  return { families: families.sort((a, b) => b.beads - a.beads), withColor }
}

/** The background's families (ticket 0787): the border's, less those too small to be a background and those more in the
 * picture's middle than on its border, which are the subject touching the edge. The middle is counted at the family's
 * own width, as the border was, so the rule does not move with Tolerance. */
function backgroundFamilies({ colors, columns, rows }: BackgroundInput, lab: Lab): Oklab[] {
  const { families, withColor } = borderFamilies(colors, columns, rows, lab)
  const large = families.filter((family) => family.beads >= withColor * MIN_FAMILY_SHARE).slice(0, MAX_FAMILIES)
  const inMiddle = large.map(() => 0)
  let middleBeads = 0
  for (let row = Math.floor(rows / 3); row < Math.ceil((rows * 2) / 3); row += 1) {
    for (let column = Math.floor(columns / 3); column < Math.ceil((columns * 2) / 3); column += 1) {
      const packed = colors[row * columns + column]!
      if (packed === NO_COLOR) continue
      middleBeads += 1
      const color = lab(packed)
      large.forEach((family, at) => {
        if (colorDistance(family.color, color) < FAMILY_DISTANCE) inMiddle[at] += 1
      })
    }
  }
  return large
    .filter((family, at) => middleBeads === 0 || inMiddle[at]! / middleBeads <= (family.beads / withColor) * MIDDLE_WEIGHT)
    .map((family) => family.color)
}

/** A fill over the block's four-neighbours from `seeds`, through every bead `through` lets pass, with `reach` told of
 * each bead it takes: the edge fill's and a mark's patch's one bookkeeping. */
function flood(columns: number, rows: number, seeds: Iterable<number>, through: (index: number) => boolean, reach: (index: number) => void) {
  const visited = new Uint8Array(columns * rows)
  const queue = new Int32Array(columns * rows)
  let tail = 0
  const visit = (index: number) => {
    if (visited[index] || !through(index)) return
    visited[index] = 1
    reach(index)
    queue[tail] = index
    tail += 1
  }
  for (const seed of seeds) visit(seed)
  for (let head = 0; head < tail; head += 1) {
    const index = queue[head]!
    const column = index % columns
    if (column > 0) visit(index - 1)
    if (column < columns - 1) visit(index + 1)
    if (index >= columns) visit(index - columns)
    if (index < (rows - 1) * columns) visit(index + columns)
  }
}

function* border(columns: number, rows: number) {
  for (let column = 0; column < columns; column += 1) {
    yield column
    yield (rows - 1) * columns + column
  }
  for (let row = 0; row < rows; row += 1) {
    yield row * columns
    yield row * columns + columns - 1
  }
}

/** The background, found from the edges inward (ConvertImage card, 2 Background; tickets 0780, 0787): the beads within
 * Tolerance of one of the border's background families, as far as they join up with the edge, through places with no
 * color (gone through but not counted); then each mark keeps or removes the patch under it. 1 marks a bead found. */
export function findBackground(input: BackgroundInput, marks: readonly BackgroundMark[] = []): Uint8Array {
  const { colors, columns, rows, tolerance } = input
  const found = new Uint8Array(columns * rows)
  if (columns === 0 || rows === 0) return found
  const lab = oklabLookup()
  const families = backgroundFamilies(input, lab)
  const reach = reachOf(tolerance)
  const judged = new Map<number, boolean>()
  const isBackground = (packed: number) => {
    let known = judged.get(packed)
    if (known === undefined) {
      const color = lab(packed)
      known = families.some((family) => colorDistance(family, color) <= reach)
      judged.set(packed, known)
    }
    return known
  }
  flood(
    columns,
    rows,
    border(columns, rows),
    (index) => colors[index] === NO_COLOR || isBackground(colors[index]!),
    (index) => {
      if (colors[index] !== NO_COLOR) found[index] = 1
    },
  )
  for (const mark of marks) applyMark(found, input, mark, lab)
  return found
}

/** A mark's patches (ticket 0787): from each bead it crossed that is in the state it changes, the beads in that state
 * joined to it whose color is within MARK_REACH Tolerances of its own, flipped. A bead the mark flipped is left so. */
function applyMark(found: Uint8Array, { colors, columns, rows, tolerance }: BackgroundInput, mark: BackgroundMark, lab: Lab) {
  const from = mark.kind === 'keep' ? 1 : 0
  const to = mark.kind === 'keep' ? 0 : 1
  const reach = reachOf(tolerance) * MARK_REACH
  for (const at of mark.beads) {
    const packed = colors[at]
    if (packed === undefined || packed === NO_COLOR || found[at] !== from) continue
    const seed = lab(packed)
    flood(
      columns,
      rows,
      [at],
      (index) => colors[index] !== NO_COLOR && found[index] === from && colorDistance(lab(colors[index]!), seed) <= reach,
      (index) => {
        found[index] = to
      },
    )
  }
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
