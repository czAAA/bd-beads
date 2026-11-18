import { beadBounds, frameContains, type BeadMap, type Rect } from '../domain/canvas'
import { BLACK, channelsOf, mix, toHex, WHITE } from '../domain/color'
import { footprintOf } from '../domain/footprint'
import type { LayerGeometry } from '../domain/layerGeometry'
import { beadsOfLayer, frameOf, type Layered } from '../domain/layerRecord'
import { canvasWeave, frameWeave } from '../domain/layerWeave'
import { withMargin } from '../domain/margin'
import { beadRoundness, describeWeave, hasHalfCircleCorner, type Weave } from '../domain/weave'
import { BEAD_GAP_PX, isOpenWeave, type BeadDrawer, type DrawingContext } from './beadLook'
import { CELL_SIZE_PX, cellSizePx } from './cellSize'
import { liftedPositionsOf, type LiftedPositions } from './liftedGround'
import { inGridPx } from './surfaceView'
import { lookSideOf, pieceGroundOf } from './pieceGround'

// The Lifted piece (ticket 1004, BeadBoard card, Canvas look): on the screen in light and dark, every Piece is one object
// on the grid: its ground a bead past its beads (its rim, 1036), a contour a few px outside it, a soft shadow under it.
// Part of the picture, so a pan moves it too; no canvas `filter` (missing on iPad Safari): the shadow is `shadowBlur`.

/** How far outside a bead's body the contour's outer edge runs, and the line's width, in grid px. */
const CONTOUR_OUT_PX = 4
const CONTOUR_LINE_PX = 1.25
/** The contour's corner, in grid px; the ground's is the line's width less. */
const CONTOUR_RADIUS_PX = 5

/** How far a bead's body stands in from its cell. */
const BODY_INSET_PX = BEAD_GAP_PX / 2

/** How far toward white (dark look) or black (light look) the contour is from the Background. */
const CONTOUR_TOWARD = { dark: 0.484, light: 0.384 }

/** The two shadows under the piece ground, at 100% zoom: a soft one a little down and a close one. `blur` is the Gaussian's
 * spread (a CSS `blur()`), `down` how far below the piece it falls, `opacity` its black's in each look. */
const SHADOWS = [
  { blur: 4.5, down: 3, opacity: { dark: 0.6, light: 0.2 } },
  { blur: 1, down: 0.75, opacity: { dark: 0.5, light: 0.16 } },
] as const

/** How far from a cell of a piece (a bead's or a lifted position's) anything of it is drawn, in grid px: the contour, the
 * soft shadow's fall and three spreads of its blur; from a bead, a bead's step more (ticket 1036).
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
    const side = lookSideOf(background)
    look = {
      contour: toHex(mix(channels, side === 'dark' ? WHITE : BLACK, CONTOUR_TOWARD[side])),
      ground: pieceGroundOf(background),
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

/** The most parts one path of a shape holds (ticket 1034): Safari's engine fills a path of rounded parts in time that
 * grows with their number squared (4 000 took 0.27 s; a checkered Frame's 15 000 stopped the screen for 15 s).
 * @internal Tests count the paths a shape of many parts is filled in. */
export const MOST_PARTS_PER_PATH = 32

/** A shape of a piece as the paths that make it up, a few parts each, overlapping where its parts do. */
interface Shape {
  paths: Path2D[]
  parts: number
}

/** The path a shape's next part goes on: its last, or a new one once that is full. */
function nextPart(shape: Shape): Path2D {
  if (shape.parts % MOST_PARTS_PER_PATH === 0) shape.paths.push(new Path2D())
  shape.parts += 1
  return shape.paths.at(-1)!
}

/** Fills a shape, path by path, in the context's fill: one color and opaque, so it is the shape whole. */
function fillParts(context: Pick<DrawingContext, 'fill'>, shape: Shape): void {
  for (const path of shape.paths) context.fill(path)
}

/** The piece's shapes (or those `shapes` names), built in one pass over the cells, each grown past its body and
 * rounded: the ground's and the contour's, in the space the context draws in (`base`, where beads are turned: each put
 * into that). A round bead's cell takes its half circle; inner corners, found among `cornered`, are rounded. */
function shapesOf(cells: readonly LiftCell[], base: DOMMatrix2DInit | undefined, rows: boolean, shapes: readonly (typeof SHAPES)[number][] = SHAPES, cornered = cells): { ground: Shape; contour: Shape } {
  const paths: { ground: Shape; contour: Shape } = { ground: { paths: [], parts: 0 }, contour: { paths: [], parts: 0 } }
  for (const cell of cells) {
    const { x, y, width, height, transform } = cell
    const into = transform && base ? relativeTo(base, transform) : undefined
    for (const { key, out, radius } of shapes) {
      const grow = out - BODY_INSET_PX
      const corner = cornerOf(cell, out, radius)
      if (into) {
        const own = new Path2D()
        own.roundRect(x - grow, y - grow, width + grow * 2, height + grow * 2, corner)
        nextPart(paths[key]).addPath(own, into)
      } else nextPart(paths[key]).roundRect(x - grow, y - grow, width + grow * 2, height + grow * 2, corner)
    }
  }
  // Every round cell of a piece has the one bead's width: a Frame's and the Canvas's are drawn apart.
  const round = cornered.filter((cell) => cell.bead !== undefined && !cell.transform)
  if (round.length > 1) {
    const { bead, height } = round[0]!
    for (const inner of innerCornersOf(round, rows)) {
      for (const { key, out, radius } of shapes) {
        const grow = out - BODY_INSET_PX
        // A corner is at most half the shorter side, as the rounded rectangles draw it (a brick stitch bead lies wide).
        const corner = Math.min(bead! / 2 + grow, rows ? height / 2 + grow : Infinity)
        addFillet(nextPart(paths[key]), inner, grow, corner, radius, rows)
      }
    }
  }
  return paths
}

/** How many device px the shadows' own picture takes per px of it, at most: a blur this soft loses nothing drawn
 * smaller, and blurring and laying down a sixteenth of the pixels is what keeps a large pattern's redraw quick. */
const MOST_SHADOW_STEP = 4

/** How many device px a shadow's sheet takes per px of it: as many as keep its blur's spread two sheet px or more. */
function shadowStep(blur: number, deviceScale: number): number {
  return Math.max(1, Math.min(MOST_SHADOW_STEP, Math.floor((blur * deviceScale) / 2)))
}

/** What a shape is drawn in on a sheet, where only its shadows are kept: opaque, whatever the color. */
const CAST_INK = '#000'

/** A canvas of the piece's own and its context. */
interface Sheet {
  canvas: HTMLCanvasElement
  sheet: CanvasRenderingContext2D
}

const sheets: { shadows?: HTMLCanvasElement | null; shape?: HTMLCanvasElement | null } = {}

/** The shadows' own sheet, or the one a shape of many paths is drawn on as one picture: kept from draw to draw;
 * undefined where there is no canvas to make one on. */
function sheetOf(which: keyof typeof sheets): Sheet | undefined {
  if (sheets[which] === undefined) sheets[which] = typeof document === 'undefined' ? null : document.createElement('canvas')
  const canvas = sheets[which]
  const sheet = canvas?.getContext('2d')
  return canvas && sheet ? { canvas, sheet } : undefined
}

/** Whether a shape drew its picture on its sheet since the whole draw now running began. */
let pictured = false

/** Runs `draw`, a whole draw of the screen (ticket 1040). The picture sheet, which only grows, is let go after it when no
 * shape of it took more than one path, and made again by the next shape that does; a band's draw, outside this, keeps
 * it as it is, so a stroke does not make it band by band. The shadows' sheet, many times smaller, is kept. */
export function drawWholeScreen(draw: () => void): void {
  pictured = false
  try {
    draw()
  } finally {
    const picture = sheets.shape
    // Sizing a canvas to nothing gives its pixels back.
    if (!pictured && picture?.width) picture.width = picture.height = 0
  }
}

/** Clears a sheet's corner of `width` × `height` px for a picture. The sheet only grows: sizing it allocates and clears
 * it, and a smaller picture takes the corner of a larger one. */
function clearSheet({ canvas, sheet }: Sheet, width: number, height: number): void {
  if (canvas.width < width || canvas.height < height) {
    canvas.width = Math.max(canvas.width, width)
    canvas.height = Math.max(canvas.height, height)
  }
  sheet.setTransform(1, 0, 0, 1, 0, 0)
  sheet.clearRect(0, 0, width, height)
}

/** The device px box round the cells' ground, grown by `reach`. */
function deviceBox(cells: readonly LiftCell[], transform: DOMMatrix2DInit, reach: number): Box {
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

/** Casts the shadows at `at` of what `lay` draws onto `context`, each `step` times smaller and `aside` px right of it.
 * A shadow's blur is twice its spread, and it is in device px whatever the transform, so it follows the zoom and falls
 * down the screen however the Project is turned. */
function castShadows(context: DrawingContext, at: readonly number[], shadows: readonly string[], deviceScale: number, { step, aside }: { step: number; aside: number }, lay: () => void): void {
  context.save()
  for (const each of at) {
    const { blur, down } = SHADOWS[each]!
    context.shadowColor = shadows[each]!
    context.shadowBlur = (blur * 2 * deviceScale) / step
    context.shadowOffsetX = aside
    context.shadowOffsetY = (down * deviceScale) / step
    lay()
  }
  context.restore()
}

/** The shadows at `at`, blurred together on a sheet `step` times smaller than the screen and laid down smoothed, as a
 * layer laid over the screen costs its size; at step 1, or with no sheet, straight on the context, under a shape the
 * contour covers. A shape of many paths casts them as one picture of itself, else each path's would fall on the next's. */
function drawShadows(context: DrawingContext, shape: Shape, cells: readonly LiftCell[], at: readonly number[], step: number, look: LiftLook, deviceScale: number, base: DOMMatrix2DInit | undefined): void {
  const own = step > 1 ? sheetOf('shadows') : undefined
  const picture = shape.paths.length > 1 ? sheetOf('shape') : undefined
  if (!own && !picture) {
    context.fillStyle = look.contour
    castShadows(context, at, look.shadows, deviceScale, { step: 1, aside: 0 }, () => fillParts(context, shape))
    return
  }
  const smaller = own ? step : 1
  const transform = base ?? context.getTransform()
  const box = deviceBox(cells, transform, Math.max(...at.map((each) => SHADOWS[each]!.down + SHADOWS[each]!.blur * 3)) * deviceScale)
  const [width, height] = [Math.ceil((box.right - box.left) / smaller), Math.ceil((box.bottom - box.top) / smaller)]
  if (width <= 0 || height <= 0) return
  const { a = 1, b = 0, c = 0, d = 1, e = 0, f = 0 } = transform
  /** The context's transform on a sheet: from the box's corner, `smaller` times smaller, `aside` px to the left. */
  const onSheet = (aside: number) => ({ a: a / smaller, b: b / smaller, c: c / smaller, d: d / smaller, e: (e - box.left) / smaller - aside, f: (f - box.top) / smaller })
  if (picture) {
    pictured = true
    clearSheet(picture, width, height)
    setMatrix(picture.sheet, onSheet(0))
    picture.sheet.fillStyle = own ? CAST_INK : look.contour
    fillParts(picture.sheet, shape)
  }
  if (!own) {
    // The picture of the shape, pixel on pixel, where the contour covers it.
    castShadows(context, at, look.shadows, deviceScale, { step: 1, aside: 0 }, () => {
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.drawImage(picture!.canvas, 0, 0, width, height, box.left, box.top, width, height)
    })
    return
  }
  // The shape lies a sheet's width to the left, so the sheet holds the shadows alone.
  const { canvas, sheet } = own
  clearSheet(own, width, height)
  sheet.fillStyle = CAST_INK
  castShadows(sheet, at, look.shadows, deviceScale, { step, aside: width }, () => {
    if (picture) {
      sheet.drawImage(picture.canvas, 0, 0, width, height, -width, 0, width, height)
      return
    }
    setMatrix(sheet, onSheet(width))
    sheet.fill(shape.paths[0]!)
  })
  context.save()
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.imageSmoothingEnabled = true
  context.drawImage(canvas, 0, 0, width, height, box.left, box.top, width * step, height * step)
  context.restore()
}

/** How far from a point of the screen the shape its shadows are cast from counts, in grid px: the soft shadow's fall
 * and three spreads of its blur. */
const SHADOW_REACH_PX = SHADOWS[0].down + SHADOWS[0].blur * 3

/** The side of the squares the outline's edges are found on, in device px, and at most in grid px: under how far two
 * touching cells' contours overlap, so a square on the line between them lies inside one of them. */
const EDGE_SQUARE_DEVICE_PX = 4
const EDGE_SQUARE_MOST_PX = 3
/** The most squares the edges are found among; past it, every cell casts its shadow. */
const MOST_EDGE_SQUARES = 4_000_000

/** A box in the space the context draws in. */
type Box = { left: number; top: number; right: number; bottom: number }

/** A raster of squares over the base space: `columns` × `rows` of side `step` from `left`, `top`. */
interface Raster {
  columns: number
  rows: number
  left: number
  top: number
  step: number
}

/** Whether a point lies inside a rounded rectangle. */
function insideRounded(px: number, py: number, { left, top, right, bottom }: Box, radius: number): boolean {
  if (px < left || px > right || py < top || py > bottom) return false
  const dx = Math.max(left + radius - px, 0, px - (right - radius))
  const dy = Math.max(top + radius - py, 0, py - (bottom - radius))
  return dx * dx + dy * dy <= radius * radius
}

/** Where a matrix puts a point. */
function mapped({ a = 1, b = 0, c = 0, d = 1, e = 0, f = 0 }: DOMMatrix2DInit, x: number, y: number): readonly [number, number] {
  return [a * x + c * y + e, b * x + d * y + f]
}

/** The box round a cell's rectangle grown by `grow`, put into the base space by `into`. */
function grownBox({ x, y, width, height }: LiftCell, grow: number, into: DOMMatrix2DInit | undefined): Box {
  const box = { left: x - grow, top: y - grow, right: x + width + grow, bottom: y + height + grow }
  if (!into) return box
  const corners = [mapped(into, box.left, box.top), mapped(into, box.right, box.top), mapped(into, box.left, box.bottom), mapped(into, box.right, box.bottom)]
  return { left: Math.min(...corners.map(([px]) => px)), right: Math.max(...corners.map(([px]) => px)), top: Math.min(...corners.map(([, py]) => py)), bottom: Math.max(...corners.map(([, py]) => py)) }
}

/** Marks each square wholly inside a cell's contour as covered: row by row inside its rounded corners, or, for a turned
 * cell, a square whose four corners its turned contour holds. */
function markCovered(covered: Uint8Array, { columns, rows, left, top, step }: Raster, cell: LiftCell, into: DOMMatrix2DInit | undefined): void {
  const grow = CONTOUR_OUT_PX - BODY_INSET_PX
  const own = grownBox(cell, grow, undefined)
  const radius = Math.min(cornerOf(cell, CONTOUR_OUT_PX, CONTOUR_RADIUS_PX), (own.right - own.left) / 2, (own.bottom - own.top) / 2)
  const box = grownBox(cell, grow, into)
  const [firstRow, lastRow] = [Math.max(0, Math.ceil((box.top - top) / step)), Math.min(rows - 1, Math.floor((box.bottom - top) / step) - 1)]
  if (!into) {
    for (let row = firstRow; row <= lastRow; row += 1) {
      const [y0, y1] = [top + row * step, top + (row + 1) * step]
      const edge = Math.min(y0 - own.top, own.bottom - y1)
      const inset = edge >= radius ? 0 : radius - Math.sqrt(radius * radius - (radius - edge) ** 2)
      const from = Math.max(0, Math.ceil((own.left + inset - left) / step))
      const to = Math.min(columns, Math.floor((own.right - inset - left) / step))
      if (to > from) covered.fill(1, row * columns + from, row * columns + to)
    }
    return
  }
  const back = relativeTo(into, {})
  const [firstColumn, lastColumn] = [Math.max(0, Math.ceil((box.left - left) / step)), Math.min(columns - 1, Math.floor((box.right - left) / step) - 1)]
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const [x0, y0] = [left + column * step, top + row * step]
      const corners = [mapped(back, x0, y0), mapped(back, x0 + step, y0), mapped(back, x0, y0 + step), mapped(back, x0 + step, y0 + step)]
      if (corners.every(([px, py]) => insideRounded(px, py, own, radius))) covered[row * columns + column] = 1
    }
  }
}

/** Whether each square lies within `reach` squares of one `covered` leaves open, by a sweep across and one down. */
function nearOpen(covered: Uint8Array, { columns, rows }: Raster, reach: number): Uint8Array {
  const across = new Uint8Array(covered.length)
  for (let row = 0; row < rows; row += 1) {
    const at = row * columns
    let open = 0
    for (let column = 0; column < Math.min(reach, columns); column += 1) open += 1 - covered[at + column]!
    for (let column = 0; column < columns; column += 1) {
      if (column + reach < columns) open += 1 - covered[at + column + reach]!
      if (column - reach - 1 >= 0) open -= 1 - covered[at + column - reach - 1]!
      across[at + column] = open > 0 ? 1 : 0
    }
  }
  const near = new Uint8Array(covered.length)
  for (let column = 0; column < columns; column += 1) {
    let open = 0
    for (let row = 0; row < Math.min(reach, rows); row += 1) open += across[row * columns + column]!
    for (let row = 0; row < rows; row += 1) {
      if (row + reach < rows) open += across[(row + reach) * columns + column]!
      if (row - reach - 1 >= 0) open -= across[(row - reach - 1) * columns + column]!
      near[row * columns + column] = open > 0 ? 1 : 0
    }
  }
  return near
}

/** The parts of `cells` (in the base space) whose shadows can show in `view` (ticket 1034): a shadow shows only where no
 * contour covers the screen, cast by the shape within its reach of there. Found on squares a few device px wide; an
 * upright run is cut to its stretches near an edge, a turned cell kept whole or left out. */
function shadowCells(cells: readonly LiftCell[], view: Box | undefined, deviceScale: number, base: DOMMatrix2DInit | undefined): readonly LiftCell[] {
  const step = Math.min(EDGE_SQUARE_DEVICE_PX / deviceScale, EDGE_SQUARE_MOST_PX)
  const reach = Math.ceil(SHADOW_REACH_PX / step) + 1
  const margin = (reach + 1) * step
  const into = cells.map((cell) => (cell.transform && base ? relativeTo(base, cell.transform) : undefined))
  const bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity }
  cells.forEach((cell, at) => {
    const box = grownBox(cell, CONTOUR_OUT_PX, into[at])
    bounds.left = Math.min(bounds.left, box.left)
    bounds.top = Math.min(bounds.top, box.top)
    bounds.right = Math.max(bounds.right, box.right)
    bounds.bottom = Math.max(bounds.bottom, box.bottom)
  })
  // The squares over the cells and their reach, cut to as far past the view as a shadow cast into it comes from.
  const area = { left: bounds.left - margin, top: bounds.top - margin, right: bounds.right + margin, bottom: bounds.bottom + margin }
  if (view) {
    area.left = Math.max(area.left, view.left - margin)
    area.top = Math.max(area.top, view.top - margin)
    area.right = Math.min(area.right, view.right + margin)
    area.bottom = Math.min(area.bottom, view.bottom + margin)
  }
  if (area.right <= area.left || area.bottom <= area.top) return []
  const raster: Raster = { columns: Math.ceil((area.right - area.left) / step), rows: Math.ceil((area.bottom - area.top) / step), left: area.left, top: area.top, step }
  if (raster.columns * raster.rows > MOST_EDGE_SQUARES) return cells
  const covered = new Uint8Array(raster.columns * raster.rows)
  // Out of view counts as covered: no shadow is seen there, and what lies there was not taken in.
  if (view) {
    for (let row = 0; row < raster.rows; row += 1) {
      const y0 = area.top + row * step
      const outside = y0 + step <= view.top || y0 >= view.bottom
      for (let column = 0; column < raster.columns; column += 1) {
        const x0 = area.left + column * step
        if (outside || x0 + step <= view.left || x0 >= view.right) covered[row * raster.columns + column] = 1
      }
    }
  }
  cells.forEach((cell, at) => markCovered(covered, raster, cell, into[at]))
  const near = nearOpen(covered, raster, reach)
  const groundGrow = GROUND_OUT_PX - BODY_INSET_PX
  const pad = step + GROUND_RADIUS_PX
  const kept: LiftCell[] = []
  cells.forEach((cell, at) => {
    const box = grownBox(cell, groundGrow, into[at])
    const [firstRow, lastRow] = [Math.max(0, Math.floor((box.top - area.top) / step)), Math.min(raster.rows - 1, Math.floor((box.bottom - area.top) / step))]
    const [firstColumn, lastColumn] = [Math.max(0, Math.floor((box.left - area.left) / step)), Math.min(raster.columns - 1, Math.floor((box.right - area.left) / step))]
    // Along the run (a row's, or a column's where it is taller than wide): whether a square across it is near an edge.
    const down = cell.height > cell.width
    const nearAt = (along: number) => {
      if (down) {
        for (let column = firstColumn; column <= lastColumn; column += 1) if (near[along * raster.columns + column]) return true
      } else {
        for (let row = firstRow; row <= lastRow; row += 1) if (near[row * raster.columns + along]) return true
      }
      return false
    }
    const [first, final] = down ? [firstRow, lastRow] : [firstColumn, lastColumn]
    if (into[at]) {
      for (let along = first; along <= final; along += 1) {
        if (nearAt(along)) {
          kept.push(cell)
          return
        }
      }
      return
    }
    // An upright run, cut to its stretches near an edge, each a square and a ground's corner longer either side.
    const [start, length, origin] = down ? [cell.y, cell.height, area.top] : [cell.x, cell.width, area.left]
    let last: { from: number; to: number } | undefined
    const stretches: { from: number; to: number }[] = []
    for (let along = first; along <= final; along += 1) {
      if (!nearAt(along)) continue
      let end = along
      while (end + 1 <= final && nearAt(end + 1)) end += 1
      const from = Math.max(start, origin + along * step - pad)
      const to = Math.min(start + length, origin + (end + 1) * step + pad)
      if (last && from <= last.to) last.to = to
      else if (to > from) stretches.push((last = { from, to }))
      along = end
    }
    if (stretches.length === 1 && stretches[0]!.from === start && stretches[0]!.to === start + length) kept.push(cell)
    else for (const { from, to } of stretches) kept.push(down ? { ...cell, y: from, height: to - from } : { ...cell, x: from, width: to - from })
  })
  // Where every cell casts its shadow whole, the shadows are the ground's own shape.
  return kept.length === cells.length && kept.every((cell, at) => cell === cells[at]) ? cells : kept
}

/** The pieces the cells make, at `deviceScale` device px per grid px, on `background`: their shadows (from the outline's
 * edges near `view` alone, ticket 1034), the contour, and the ground inside it, under the beads. `rows` says whether the
 * cells are runs of a row, else of a column (for a round bead's inner corners). */
export function drawLift(context: DrawingContext, cells: readonly LiftCell[], background: string, deviceScale: number, rows = true, view?: Box): void {
  if (!cells.length) return
  const look = liftLookOf(background)
  const base = cells.some((cell) => cell.transform) ? context.getTransform() : undefined
  const { ground, contour } = shapesOf(cells, base, rows)
  const cast = shadowCells(cells, view, deviceScale, base)
  const shadow = cast === cells ? ground : shapesOf(cast, base, rows, [SHAPES[0]], cells).ground
  // Each shadow in a sheet fine enough for its own blur. Laying a sheet over the screen costs the screen, so the
  // shadows share one wherever it is smaller than the screen, at the finest step either needs; where the closest is not
  // drawn smaller, the soft one keeps its coarse sheet and the closest falls straight on the screen.
  const steps = SHADOWS.map(({ blur }) => shadowStep(blur, deviceScale))
  const finest = Math.min(...steps)
  if (cast.length && finest > 1) drawShadows(context, shadow, cast, SHADOWS.map((_, at) => at), finest, look, deviceScale, base)
  else if (cast.length) SHADOWS.forEach((_, at) => drawShadows(context, shadow, cast, [at], steps[at]!, look, deviceScale, base))
  context.fillStyle = look.contour
  fillParts(context, contour)
  context.fillStyle = look.ground
  fillParts(context, ground)
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

/** The runs of a stored row with its lifted positions, its rim's and its narrow gaps' (tickets 1035, 1036, 1050), kept by
 * the row and those positions. */
const rowLiftedRuns = new WeakMap<Record<number, string>, { lifted: readonly number[]; runs: readonly (readonly [number, number])[] }>()

/** The runs of a row of no bead, the rim's above and below a piece, kept by its lifted positions. */
const rimRuns = new WeakMap<readonly number[], readonly (readonly [number, number])[]>()

function runsWithLifted(stored: Record<number, string> | undefined, lifted: readonly number[] | undefined): readonly (readonly [number, number])[] {
  if (!lifted) return stored ? runsOf(stored) : []
  const known = stored ? rowLiftedRuns.get(stored) : { lifted, runs: rimRuns.get(lifted) }
  if (known?.lifted === lifted && known.runs) return known.runs
  const columns = [...(stored ? Object.keys(stored).map(Number) : []), ...lifted].sort((a, b) => a - b)
  const runs: [number, number][] = []
  for (const column of columns) {
    const last = runs.at(-1)
    if (last && last[1] === column - 1) last[1] = column
    else runs.push([column, column])
  }
  if (stored) rowLiftedRuns.set(stored, { lifted, runs })
  else rimRuns.set(lifted, runs)
  return runs
}

/** The Canvas's empty positions that lie in the lifted piece, its rim a bead round its beads (ticket 1036) and its gaps
 * less than two beads wide (1035, 1050): its keep-out margin lies outside every Piece, as its beads are not drawn. */
export function canvasLifted(project: Layered, margin: number): LiftedPositions {
  const covered = footprintOf(project)
  const keptOut: Rect | undefined = covered && withMargin(covered, margin)
  return liftedPositionsOf('canvas', {
    beads: beadsOfLayer(project, 'canvas'),
    description: describeWeave(canvasWeave(project)),
    has: keptOut ? (row, column) => !frameContains(keptOut, { row, column }) : () => true,
    edge: keptOut ? `${keptOut.row},${keptOut.column},${keptOut.rows},${keptOut.columns}` : '',
  })
}

/** The rows a redraw of `rows` draws to take in the lifted positions an edit changed since the last draw (1035, 1036,
 * 1050), in the Canvas's rows; what changed is forgotten once asked, so a whole draw
 * asks too. `geometry` is the Frame's. */
export function withLiftedRows(rows: { first: number; last: number } | undefined, project: Layered, margin: number, geometry: LayerGeometry | undefined): { first: number; last: number } | undefined {
  const canvas = canvasLifted(project, margin).takeChanged()
  const frame = frameOf(project)
  const framed = frame && geometry ? frameLifted(project, geometry)?.takeChanged() : undefined
  if (!rows) return undefined
  const changed = [canvas, framed && { first: framed.first + frame!.row, last: framed.last + frame!.row }]
  return changed.reduce<{ first: number; last: number }>((band, more) => (more ? { first: Math.min(band.first, more.first), last: Math.max(band.last, more.last) } : band), rows)
}

/** The cells of the Canvas's lifted positions a draw covers, in grid px: where the tiles are drawn again on the piece's
 * ground (tickets 1035, 1036). */
export function canvasLiftedCells(project: Layered, { area, rows }: LiftView, lifted: LiftedPositions): LiftCell[] {
  if (!lifted.rows.size) return []
  const weave = canvasWeave(project)
  const description = describeWeave(weave)
  const cell = cellSizePx(weave.technique, weave.cell)
  const visible = description.visible(area, cell.width, cell.height)
  const [first, last] = rows ? [Math.max(visible.firstRow, rows.first - 1), Math.min(visible.lastRow, rows.last + 1)] : [visible.firstRow, visible.lastRow]
  const cells: LiftCell[] = []
  for (const [row, columns] of lifted.rows) {
    if (row < first || row > last) continue
    const seen = visible.columnsOf(row)
    for (const column of columns) if (column >= seen.first && column <= seen.last) cells.push(description.box({ row, column }, cell.width, cell.height))
  }
  return cells
}

/** The Frame's empty positions that lie in the lifted piece, its narrow gaps' (1035, 1050) and its rim, which stops at
 * the Frame's edge (ticket 1036), on a Frame of rows and columns; a Custom frame's beads, each at its panel's angle, keep
 * every hole's border and have no rim. */
export function frameLifted(project: Layered, geometry: LayerGeometry): LiftedPositions | undefined {
  const beads = beadsOfLayer(project, 'frame')
  const frame = frameOf(project)
  if (!beads || !frame || !geometry.grid) return undefined
  return liftedPositionsOf('frame', {
    beads,
    description: describeWeave(frameWeave(project)),
    has: (row, column) => geometry.hasPosition({ row, column }),
    edge: `${frame.rows},${frame.columns}`,
  })
}

/** The cells of the Frame's lifted positions whose piece reaches `area`, in the rows `rows` takes in when given, from
 * its first position at `origin`, as its beads' cells are kept (liftCollector). */
export function frameLiftedCells(project: Layered, lifted: LiftedPositions, geometry: LayerGeometry, origin: { x: number; y: number }, area: Box, rows: { first: number; last: number } | undefined): LiftCell[] {
  const weave = frameWeave(project)
  const cornerRadius = beadRoundness(weave.technique, weave.cell) * CELL_SIZE_PX
  const cells: LiftCell[] = []
  for (const [row, columns] of lifted.rows) {
    if (rows && (row < rows.first || row > rows.last)) continue
    for (const column of columns) {
      const place = geometry.place({ row, column })
      if (!place) continue
      const box = inGridPx(place.box)
      const [x, y] = [origin.x + box.x, origin.y + box.y]
      if (x > area.right + LIFT_REACH_PX || x + box.width < area.left - LIFT_REACH_PX || y > area.bottom + LIFT_REACH_PX || y + box.height < area.top - LIFT_REACH_PX) continue
      cells.push({ x, y, width: box.width, height: box.height, ...(isOpenWeave(cornerRadius, box.width) ? { bead: box.width } : {}) })
    }
  }
  return cells
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
  // An inner cut close to the beads is part of the piece (ticket 1035), and so is its rim a bead round it (ticket 1036),
  // which lies on rows of no bead too.
  const lifted = canvasLifted(project, margin).rows
  const rowsDrawn = new Set([...Object.keys(beads).map(Number), ...lifted.keys()].filter((row) => row >= first && row <= last))
  const cells: LiftCell[] = []
  for (const row of rowsDrawn) {
    const seen = visible.columnsOf(row)
    for (const [from, to] of runsWithLifted(beads[row], lifted.get(row))) {
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

/** Cells that touch end to end as one, a row's and then a column's: the current pass's raised beads, one shape for
 * their shadow whichever way the Row direction runs (ticket 1032). */
export function joinedTouching(cells: readonly LiftCell[]): LiftCell[] {
  return joinedDown(joinedAcross([...cells]))
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
