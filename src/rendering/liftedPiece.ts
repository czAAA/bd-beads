import { beadBounds, frameContains, type BeadMap, type Rect } from '../domain/canvas'
import { BLACK, BLACK_WHITE_BALANCE, channelsOf, mix, relativeLuminance, toHex, WHITE } from '../domain/color'
import { footprintOf } from '../domain/footprint'
import { beadsOfLayer, type Layered } from '../domain/layerRecord'
import { canvasWeave } from '../domain/layerWeave'
import { withMargin } from '../domain/margin'
import { beadRoundness, describeWeave, hasHalfCircleCorner, type Weave } from '../domain/weave'
import { BEAD_GAP_PX, isOpenWeave, type BeadDrawer, type DrawingContext } from './beadLook'
import { cellSizePx } from './cellSize'

// The Lifted piece (ticket 1004, BeadBoard card, Canvas look): on the screen in light and dark, every Piece is one
// object on the grid: a contour a few px outside its beads, its own ground inside it, a soft shadow under it. Part of
// the picture, so a pan moves it too; no canvas `filter` (missing on iPad Safari): the shadow is `shadowBlur`.

/** How far outside a bead's body the contour's outer edge runs, and the line's width, in grid px. */
const CONTOUR_OUT_PX = 4
const CONTOUR_LINE_PX = 1.25
/** The contour's corner, in grid px; the ground's is the line's width less. */
const CONTOUR_RADIUS_PX = 5

/** How far a bead's body stands in from its cell. */
const BODY_INSET_PX = BEAD_GAP_PX / 2

/** How far toward white (dark look) or black (light look) the contour is from the Background. */
const CONTOUR_TOWARD = { dark: 0.484, light: 0.384 }
/** How far toward white the piece's ground is from the Background. */
const GROUND_TOWARD_WHITE = { dark: 0.05, light: 0.8 }

/** The two shadows under the piece ground, at 100% zoom: a soft one well down and a close one. `blur` is the Gaussian's
 * spread (a CSS `blur()`), `down` how far below the piece it falls, `opacity` its black's in each look. */
const SHADOWS = [
  { blur: 9, down: 6, opacity: { dark: 0.6, light: 0.2 } },
  { blur: 2, down: 1.5, opacity: { dark: 0.5, light: 0.16 } },
] as const

/** How far from a bead's cell anything of its piece is drawn, in grid px: the contour, and the soft shadow's fall
 * and three spreads of its blur. A bead further than this from what is drawn leaves it as it is.
 * @internal Tests check what a redraw takes in. */
export const LIFT_REACH_PX = SHADOWS[0].down + SHADOWS[0].blur * 3 + CONTOUR_OUT_PX

/** The colors a piece lies in on a Background. */
interface LiftLook {
  contour: string
  ground: string
  /** The shadows' black, strongest first. */
  shadows: readonly string[]
}

const looks = new Map<string, LiftLook>()

/** The piece's look on `background`, in the look that Background is drawn in: dark on a dark one, light on a light
 * one, by the rule that picks a Custom color's (canvasBackgrounds.ts).
 * @internal Tests name the colors a Background gives. */
export function liftLookOf(background: string): LiftLook {
  let look = looks.get(background)
  if (!look) {
    const channels = channelsOf(background)
    const side = relativeLuminance(channels) < BLACK_WHITE_BALANCE ? 'dark' : 'light'
    look = {
      contour: toHex(mix(channels, side === 'dark' ? WHITE : BLACK, CONTOUR_TOWARD[side])),
      ground: toHex(mix(channels, WHITE, GROUND_TOWARD_WHITE[side])),
      shadows: SHADOWS.map(({ opacity }) => `rgba(0, 0, 0, ${opacity[side]})`),
    }
    looks.set(background, look)
  }
  return look
}

/** A bead's cell in grid px, and where it was drawn when that isn't the transform the piece is drawn in (a bead turned
 * to its panel's angle). */
export interface LiftCell {
  x: number
  y: number
  width: number
  height: number
  transform?: DOMMatrix2DInit
  /** With a round bead (Open weave, ticket 1010): one bead's width, whose half circle is the piece's corner here. A
   * cell of a bead whose corner isn't a half circle leaves it out. */
  bead?: number
}

/** Sets a transform kept as a matrix, by its six numbers. */
function setMatrix(context: Pick<DrawingContext, 'setTransform'>, { a = 1, b = 0, c = 0, d = 1, e = 0, f = 0 }: DOMMatrix2DInit): void {
  context.setTransform(a, b, c, d, e, f)
}

/** Where `own` puts a point, as seen from `base`: base⁻¹ · own, the two being affine and kept as six numbers. */
function relativeTo({ a: a1 = 1, b: b1 = 0, c: c1 = 0, d: d1 = 1, e: e1 = 0, f: f1 = 0 }: DOMMatrix2DInit, { a = 1, b = 0, c = 0, d = 1, e = 0, f = 0 }: DOMMatrix2DInit): DOMMatrix2DInit {
  const det = a1 * d1 - b1 * c1
  const [ia, ib, ic, id, ie, jf] = [d1 / det, -b1 / det, -c1 / det, a1 / det, (c1 * f1 - d1 * e1) / det, (b1 * e1 - a1 * f1) / det]
  return { a: ia * a + ic * b, b: ib * a + id * b, c: ia * c + ic * d, d: ib * c + id * d, e: ia * e + ic * f + ie, f: ib * e + id * f + jf }
}

/** The ground's shape: each cell grown past its body, rounded. */
const GROUND_OUT_PX = CONTOUR_OUT_PX - CONTOUR_LINE_PX
const GROUND_RADIUS_PX = CONTOUR_RADIUS_PX - CONTOUR_LINE_PX

/** The two shapes of a piece: how far past a body each reaches and how round its corner is. */
const SHAPES = [
  { key: 'ground', out: GROUND_OUT_PX, radius: GROUND_RADIUS_PX },
  { key: 'contour', out: CONTOUR_OUT_PX, radius: CONTOUR_RADIUS_PX },
] as const

/** A cell's corner on a shape reaching `out` past the body: the card's, or a round bead's own half circle, grown with
 * it (ticket 1010). */
function cornerOf({ bead }: LiftCell, out: number, radius: number): number {
  return bead === undefined ? radius : bead / 2 - BODY_INSET_PX + out
}

/** The least inner-corner rounding drawn, in grid px: a smaller one is not seen. */
const LEAST_FILLET_PX = 0.4
/** How much smaller each try of an inner corner's rounding is than the last, where the first doesn't fit. */
const FILLET_SHRINK = 0.7

/** The key a line of cells is kept under: where it starts across the lines, to a thousandth of a px. */
const lineKey = (v: number): number => Math.round(v * 1000)

/** An inward step of a round piece's outline (`u` along the lines, `v` across): touching cells meet at `vt`; the one
 * reaching further on side `su` gives the straight edge (to `straightEnd`), the other its corner's half circle (at
 * `cornerEnd`); `sv` points to the empty side; `halfGap` is midway to the corner's next cell, which roundings don't pass. */
interface InnerCorner {
  su: -1 | 1
  sv: -1 | 1
  vt: number
  straightEnd: number
  cornerEnd: number
  halfGap: number
}

/** The inner corners of a round piece's outline (ticket 1010): where one cell reaches further than the touching cell of
 * the next line. `rows` says the lines are rows, else columns. Cells are the untransformed ones that have a bead. */
function innerCornersOf(cells: readonly LiftCell[], rows: boolean): InnerCorner[] {
  // A cell in line terms: u runs along its line, v across lines.
  const lines = new Map<number, { u0: number; u1: number; v1: number }[]>()
  for (const { x, y, width, height } of cells) {
    const [u0, u1, v0, v1] = rows ? [x, x + width, y, y + height] : [y, y + height, x, x + width]
    const key = lineKey(v0)
    const line = lines.get(key)
    if (line) line.push({ u0, u1, v1 })
    else lines.set(key, [{ u0, u1, v1 }])
  }
  const found: InnerCorner[] = []
  for (const line of lines.values()) {
    line.sort((a, b) => a.u0 - b.u0)
    const below = lines.get(lineKey(line[0]!.v1))
    if (!below) continue
    below.sort((a, b) => a.u0 - b.u0)
    // Every pair that overlaps along the lines, by a sweep of both.
    for (let at = 0, from = 0; at < line.length; at += 1) {
      const above = line[at]!
      while (from < below.length && below[from]!.u1 <= above.u0) from += 1
      for (let each = from; each < below.length && below[each]!.u0 < above.u1; each += 1) {
        const under = below[each]!
        const vt = above.v1
        // Midway to the next cell of the corner's own line, where there is one.
        const [before, after] = [(cells: typeof line, at: number) => cells[at - 1]?.u1, (cells: typeof line, at: number) => cells[at + 1]?.u0]
        const mid = (end: number, next: number | undefined, su: -1 | 1) => (next === undefined ? su * Infinity : (end + next) / 2)
        if (above.u0 < under.u0) found.push({ su: -1, sv: 1, vt, straightEnd: above.u0, cornerEnd: under.u0, halfGap: mid(under.u0, before(below, each), -1) })
        if (above.u1 > under.u1) found.push({ su: 1, sv: 1, vt, straightEnd: above.u1, cornerEnd: under.u1, halfGap: mid(under.u1, after(below, each), 1) })
        if (under.u0 < above.u0) found.push({ su: -1, sv: -1, vt, straightEnd: under.u0, cornerEnd: above.u0, halfGap: mid(above.u0, before(line, at), -1) })
        if (under.u1 > above.u1) found.push({ su: 1, sv: -1, vt, straightEnd: under.u1, cornerEnd: above.u1, halfGap: mid(above.u1, after(line, at), 1) })
      }
    }
  }
  return found
}

/** Adds the rounding of an inner corner to `path`, on a shape reaching `grow` past the bodies with corners of radius `r`:
 * the spandrel between the straight edge, the other cell's corner circle and a circle tangent to both, a px into the cells
 * so no seam shows, wound as a rounded rectangle is. Left out where the straight edge is too short to reach its foot. */
function addFillet(path: Path2D, corner: InnerCorner, grow: number, r: number, most: number, rows: boolean): void {
  const { su, sv, vt, straightEnd, cornerEnd, halfGap } = corner
  const line = sv > 0 ? vt + grow : vt - grow
  const [centreU, centreV] = [cornerEnd + su * (grow - r), sv > 0 ? vt - grow + r : vt + grow - r]
  // Where the straight edge cuts the corner's circle.
  const reach = r * r - (line - centreV) ** 2
  if (reach <= 0) return
  const meet = centreU + su * Math.sqrt(reach)
  // The rounding's circle, tangent to the line and outside the corner's, as big as the straight edge allows.
  const footLimit = su > 0 ? Math.min(straightEnd + grow - r, halfGap) : Math.max(straightEnd - grow + r, halfGap)
  for (let rho = most; rho >= LEAST_FILLET_PX; rho *= FILLET_SHRINK) {
    const centreF = line + sv * rho
    const apart = (r + rho) ** 2 - (centreV - centreF) ** 2
    if (apart <= 0) return
    const foot = centreU + su * Math.sqrt(apart)
    if (su * foot > su * footLimit || su * foot < su * meet) continue
    const touch = [centreU + ((foot - centreU) * r) / (r + rho), centreV + ((centreF - centreV) * r) / (r + rho)] as const
    const into = line - sv
    const [mapped, ring] = [(u: number, v: number) => (rows ? [u, v] : [v, u]) as readonly [number, number], [] as (readonly [number, number])[]]
    ring.push(mapped(foot, into), mapped(meet, into), mapped(meet, line), mapped(touch[0], touch[1]), mapped(foot, line))
    const [fx, fy] = mapped(foot, centreF)
    const [fromX, fromY] = mapped(touch[0], touch[1])
    const [toX, toY] = mapped(foot, line)
    const [from, to] = [Math.atan2(fromY - fy, fromX - fx), Math.atan2(toY - fy, toX - fx)]
    // The way round the circle that is the short one, the corner's side.
    const sweep = Math.atan2(Math.sin(to - from), Math.cos(to - from))
    // Clockwise on the screen is a positive area, as y runs down.
    const area = ring.reduce((sum, [x, y], at) => sum + x * ring[(at + 1) % ring.length]![1] - ring[(at + 1) % ring.length]![0] * y, 0)
    if (area > 0) {
      path.moveTo(...ring[0]!)
      path.lineTo(...ring[1]!)
      path.lineTo(...ring[2]!)
      path.lineTo(...ring[3]!)
      path.arc(fx, fy, rho, from, to, sweep < 0)
    } else {
      path.moveTo(...ring[0]!)
      path.lineTo(...ring[4]!)
      path.arc(fx, fy, rho, to, from, sweep > 0)
      path.lineTo(...ring[3]!)
      path.lineTo(...ring[2]!)
      path.lineTo(...ring[1]!)
    }
    path.closePath()
    return
  }
}

/** The piece's shapes, built in one pass over the cells: each grown past its body, rounded, as one path, so overlapping
 * cells make one outline. The ground's (the shadows' too) and the contour's, in the space the context draws in (`base`,
 * where beads are turned: each put into that). A round bead's cell takes its half circle, and inner corners are rounded. */
function shapesOf(cells: readonly LiftCell[], base: DOMMatrix2DInit | undefined, rows: boolean): { ground: Path2D; contour: Path2D } {
  const paths = { ground: new Path2D(), contour: new Path2D() }
  for (const cell of cells) {
    const { x, y, width, height, transform } = cell
    const into = transform && base ? relativeTo(base, transform) : undefined
    for (const { key, out, radius } of SHAPES) {
      const grow = out - BODY_INSET_PX
      const corner = cornerOf(cell, out, radius)
      if (into) {
        const own = new Path2D()
        own.roundRect(x - grow, y - grow, width + grow * 2, height + grow * 2, corner)
        paths[key].addPath(own, into)
      } else paths[key].roundRect(x - grow, y - grow, width + grow * 2, height + grow * 2, corner)
    }
  }
  // Every round cell of a piece has the one bead's width: a Frame's and the Canvas's are drawn apart.
  const round = cells.filter((cell) => cell.bead !== undefined && !cell.transform)
  if (round.length > 1) {
    const { bead, height } = round[0]!
    for (const inner of innerCornersOf(round, rows)) {
      for (const { key, out, radius } of SHAPES) {
        const grow = out - BODY_INSET_PX
        // A corner is at most half the shorter side, as the rounded rectangles draw it (a brick stitch bead lies wide).
        const corner = Math.min(bead! / 2 + grow, rows ? height / 2 + grow : Infinity)
        addFillet(paths[key], inner, grow, corner, radius, rows)
      }
    }
  }
  return paths
}

/** How many device px the shadows' own picture takes per px of it, at most: a blur this soft loses nothing drawn
 * smaller, and blurring and laying down a sixteenth of the pixels is what keeps a large pattern's redraw quick. */
const MOST_SHADOW_STEP = 4

/** How many device px a shadow's sheet takes per px of it: as many as keep its blur over a sheet px or so. */
function shadowStep(blur: number, deviceScale: number): number {
  return Math.max(1, Math.min(MOST_SHADOW_STEP, Math.floor((blur * deviceScale) / 2)))
}

let shadowCanvas: HTMLCanvasElement | null | undefined

/** The shadows' own sheet and its context, kept from draw to draw; undefined where there is no canvas to make one on. */
function shadowSheet(): { canvas: HTMLCanvasElement; sheet: CanvasRenderingContext2D } | undefined {
  if (shadowCanvas === undefined) shadowCanvas = typeof document === 'undefined' ? null : document.createElement('canvas')
  const sheet = shadowCanvas?.getContext('2d')
  return shadowCanvas && sheet ? { canvas: shadowCanvas, sheet } : undefined
}

/** The device px box round the cells' ground, grown by `reach`. */
function deviceBox(cells: readonly LiftCell[], transform: DOMMatrix2DInit, reach: number): { left: number; top: number; right: number; bottom: number } {
  const grow = GROUND_OUT_PX - BODY_INSET_PX
  const box = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity }
  for (const { x, y, width, height, transform: own } of cells) {
    const { a = 1, b = 0, c = 0, d = 1, e = 0, f = 0 } = own ?? transform
    for (const [px, py] of [[x - grow, y - grow], [x + width + grow, y - grow], [x - grow, y + height + grow], [x + width + grow, y + height + grow]] as const) {
      const [dx, dy] = [a * px + c * py + e, b * px + d * py + f]
      box.left = Math.min(box.left, dx)
      box.right = Math.max(box.right, dx)
      box.top = Math.min(box.top, dy)
      box.bottom = Math.max(box.bottom, dy)
    }
  }
  return { left: Math.floor(box.left - reach), top: Math.floor(box.top - reach), right: Math.ceil(box.right + reach), bottom: Math.ceil(box.bottom + reach) }
}

/** Casts the shadows at `at` of `shape` onto `context`, each `step` times smaller and `aside` px right of the shape, the
 * shape put on it by `transform`. A shadow's blur is twice its spread, and it is in device px whatever the transform,
 * so it follows the zoom and falls down the screen however the Project is turned. */
function castShadows(context: DrawingContext, shape: Path2D, at: readonly number[], shadows: readonly string[], deviceScale: number, { transform, step, aside }: { transform?: DOMMatrix2DInit; step: number; aside: number }): void {
  context.save()
  if (transform) setMatrix(context, transform)
  for (const each of at) {
    const { blur, down } = SHADOWS[each]!
    context.shadowColor = shadows[each]!
    context.shadowBlur = (blur * 2 * deviceScale) / step
    context.shadowOffsetX = aside
    context.shadowOffsetY = (down * deviceScale) / step
    context.fill(shape)
  }
  context.restore()
}

/** The shadows at `at`, blurred together on a sheet `step` times smaller than the screen and laid down smoothed, as a
 * layer laid over the screen costs its size. The shape lies a sheet's width to the left, so the sheet holds the shadows
 * alone. At step 1, or with no sheet, they fall straight on the context, under a shape the contour covers. */
function drawShadows(context: DrawingContext, shape: Path2D, cells: readonly LiftCell[], at: readonly number[], step: number, look: LiftLook, deviceScale: number, base: DOMMatrix2DInit | undefined): void {
  const own = step > 1 ? shadowSheet() : undefined
  if (!own) {
    context.fillStyle = look.contour
    castShadows(context, shape, at, look.shadows, deviceScale, { step: 1, aside: 0 })
    return
  }
  const transform = base ?? context.getTransform()
  const box = deviceBox(cells, transform, Math.max(...at.map((each) => SHADOWS[each]!.down + SHADOWS[each]!.blur * 3)) * deviceScale)
  const [width, height] = [Math.ceil((box.right - box.left) / step), Math.ceil((box.bottom - box.top) / step)]
  if (width <= 0 || height <= 0) return
  const { canvas, sheet } = own
  // The sheet only grows: sizing it allocates and clears it, and a smaller picture takes the corner of a larger one.
  if (canvas.width < width || canvas.height < height) {
    canvas.width = Math.max(canvas.width, width)
    canvas.height = Math.max(canvas.height, height)
  } else {
    sheet.setTransform(1, 0, 0, 1, 0, 0)
    sheet.clearRect(0, 0, width, height)
  }
  const { a = 1, b = 0, c = 0, d = 1, e = 0, f = 0 } = transform
  sheet.fillStyle = '#000'
  castShadows(sheet, shape, at, look.shadows, deviceScale, { transform: { a: a / step, b: b / step, c: c / step, d: d / step, e: (e - box.left) / step - width, f: (f - box.top) / step }, step, aside: width })
  context.save()
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.imageSmoothingEnabled = true
  context.drawImage(canvas, 0, 0, width, height, box.left, box.top, width * step, height * step)
  context.restore()
}

/** The pieces the cells make, at `deviceScale` device px per grid px, on `background`: their shadows, the contour, and
 * the ground inside it. Drawn before the beads, which cover the rest. The shapes are built once, so overlapping cells
 * make one outline. `rows` says whether the cells are runs of a row, else of a column (for a round bead's inner corners). */
export function drawLift(context: DrawingContext, cells: readonly LiftCell[], background: string, deviceScale: number, rows = true): void {
  if (!cells.length) return
  const look = liftLookOf(background)
  const base = cells.some((cell) => cell.transform) ? context.getTransform() : undefined
  const { ground, contour } = shapesOf(cells, base, rows)
  // Each shadow in a sheet fine enough for its own blur. Laying a sheet over the screen costs the screen, so the
  // shadows share one wherever it is smaller than the screen, at the finest step either needs; where the closest is not
  // drawn smaller, the soft one keeps its coarse sheet and the closest falls straight on the screen.
  const steps = SHADOWS.map(({ blur }) => shadowStep(blur, deviceScale))
  const finest = Math.min(...steps)
  if (finest > 1) drawShadows(context, ground, cells, SHADOWS.map((_, at) => at), finest, look, deviceScale, base)
  else SHADOWS.forEach((_, at) => drawShadows(context, ground, cells, [at], steps[at]!, look, deviceScale, base))
  context.fillStyle = look.contour
  context.fill(contour)
  context.fillStyle = look.ground
  context.fill(ground)
}

/** The runs of touching columns of a stored row, cached by the row itself: a stroke step changes few rows. */
const rowRuns = new WeakMap<Record<number, string>, readonly (readonly [number, number])[]>()

function runsOf(stored: Record<number, string>): readonly (readonly [number, number])[] {
  let runs = rowRuns.get(stored)
  if (!runs) {
    const columns = Object.keys(stored)
      .map(Number)
      .sort((a, b) => a - b)
    const found: [number, number][] = []
    for (const column of columns) {
      const last = found.at(-1)
      if (last && last[1] === column - 1) last[1] = column
      else found.push([column, column])
    }
    runs = found
    rowRuns.set(stored, runs)
  }
  return runs
}

/** Cells of one line that touch end to end as one: a column's, where columns are staggered. */
function joinedDown(cells: LiftCell[]): LiftCell[] {
  cells.sort((a, b) => a.x - b.x || a.y - b.y)
  const joined: LiftCell[] = []
  for (const cell of cells) {
    const last = joined.at(-1)
    if (last && last.x === cell.x && last.width === cell.width && Math.abs(last.y + last.height - cell.y) < 1e-6) last.height += cell.height
    else joined.push({ ...cell })
  }
  return joined
}

/** Whether a Weave's beads are lifted as runs of a row (loom, brick stitch), else of a column (peyote). */
export function liftsAcross(weave: Weave): boolean {
  const description = describeWeave(weave)
  return !description.shifted || description.staggers === 'rows'
}

/** What part of the Canvas a draw covers, in grid px, and the rows it redraws when only some. */
export interface LiftView {
  area: { left: number; right: number; top: number; bottom: number }
  rows?: { first: number; last: number }
  /** How many positions wide the keep-out margin is drawn, whose beads aren't. */
  margin: number
}

/** The Canvas's beads whose piece reaches what a draw covers, as cells: a row's touching beads as one, where rows
 * stand straight or shift sideways, else a column's. The keep-out margin's beads are left out, as they aren't drawn. */
export function canvasLiftCells(project: Layered, { area, rows, margin }: LiftView): LiftCell[] {
  const beads: BeadMap = beadsOfLayer(project, 'canvas')
  if (!beadBounds(beads)) return []
  const weave = canvasWeave(project)
  const description = describeWeave(weave)
  const cell = cellSizePx(weave.technique, weave.cell)
  const reach = LIFT_REACH_PX
  const visible = description.visible({ left: area.left - reach, right: area.right + reach, top: area.top - reach, bottom: area.bottom + reach }, cell.width, cell.height)
  const rowsReach = Math.ceil(reach / cell.height) + 1
  const first = rows ? Math.max(visible.firstRow, rows.first - rowsReach) : visible.firstRow
  const last = rows ? Math.min(visible.lastRow, rows.last + rowsReach) : visible.lastRow
  const covered = footprintOf(project)
  const keptOut: Rect | undefined = covered && withMargin(covered, margin)
  const across = liftsAcross(weave)
  // A round bead's piece follows its half circle (ticket 1010).
  const round = hasHalfCircleCorner(beadRoundness(weave.technique, weave.cell)) ? { bead: cell.width } : {}
  const cells: LiftCell[] = []
  for (const key in beads) {
    const row = Number(key)
    if (row < first || row > last) continue
    const seen = visible.columnsOf(row)
    for (const [from, to] of runsOf(beads[row]!)) {
      const [start, end] = [Math.max(from, seen.first), Math.min(to, seen.last)]
      if (start > end) continue
      // A run split where the keep-out margin crosses it.
      const kept = keptOut && row >= keptOut.row && row < keptOut.row + keptOut.rows ? keptOut : undefined
      for (let column = start; column <= end; ) {
        if (kept && frameContains(kept, { row, column })) {
          column = kept.column + kept.columns
          continue
        }
        const stop = kept && kept.column > column ? Math.min(end, kept.column - 1) : end
        if (across) {
          const left = description.box({ row, column }, cell.width, cell.height)
          const right = description.box({ row, column: stop }, cell.width, cell.height)
          cells.push({ x: left.x, y: left.y, width: right.x + right.width - left.x, height: left.height, ...round })
        } else {
          for (let each = column; each <= stop; each += 1) {
            const { x, y, width, height } = description.box({ row, column: each }, cell.width, cell.height)
            cells.push({ x, y, width, height, ...round })
          }
        }
        column = stop + 1
      }
    }
  }
  return across ? cells : joinedDown(cells)
}

/** Cells of one line that touch end to end as one: a row's, where rows are not staggered. */
function joinedAcross(cells: LiftCell[]): LiftCell[] {
  cells.sort((a, b) => a.y - b.y || a.x - b.x)
  const joined: LiftCell[] = []
  for (const cell of cells) {
    const last = joined.at(-1)
    if (last && last.y === cell.y && last.height === cell.height && Math.abs(last.x + last.width - cell.x) < 1e-6) last.width += cell.width
    else joined.push({ ...cell })
  }
  return joined
}

/** A Frame's cells, the upright ones that touch joined as the Canvas's are (a row's, or a column's where columns are
 * staggered), so its piece has the same outline (ticket 1010) and one rectangle per line, not per bead: Safari took 15 s
 * to cast a large Frame's shadow from one per bead (ticket 1030). Turned beads' cells are left as they are. */
export function joinedUpright(cells: readonly LiftCell[], across: boolean): LiftCell[] {
  const upright = cells.filter((cell) => !cell.transform)
  if (!upright.length) return cells.slice()
  const turned = cells.filter((cell) => cell.transform)
  return [...turned, ...(across ? joinedAcross(upright) : joinedDown(upright))]
}

/** A bead drawer that draws the empty positions with `draw` and keeps the painted beads' cells for the piece under
 * them, where they were drawn when `turned` (each bead at its own angle). */
export function liftCollector(draw: BeadDrawer, turned: boolean): { drawer: BeadDrawer; cells: LiftCell[] } {
  const cells: LiftCell[] = []
  const drawer: BeadDrawer = (context, bead) => {
    if (bead.color === null) {
      draw(context, bead)
      return
    }
    const { x, y, size, width = size, height = size } = bead
    const round = isOpenWeave(bead.cornerRadius, width) ? { bead: width } : {}
    cells.push(turned ? { x, y, width, height, transform: context.getTransform(), ...round } : { x, y, width, height, ...round })
  }
  return { drawer, cells }
}

/** A bead drawer that draws the painted beads only: the empty ones are drawn already, under the piece. */
export function paintedOnly(draw: BeadDrawer): BeadDrawer {
  return (context, bead) => {
    if (bead.color !== null) draw(context, bead)
  }
}

/** The rows a redraw of `rows` takes in for the pieces reaching them, in a layer whose cells are `cellHeight` tall. */
export function liftRows(rows: { first: number; last: number } | undefined, cellHeight: number): { first: number; last: number } | undefined {
  const reach = Math.ceil(LIFT_REACH_PX / cellHeight) + 1
  return rows && { first: rows.first - reach, last: rows.last + reach }
}
