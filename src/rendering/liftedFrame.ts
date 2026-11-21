import type { BeadMap } from '../domain/canvas'
import { BLACK, channelsOf, mix, toHex, WHITE } from '../domain/color'
import { BEAD_GAP_PX, type DrawingContext } from './beadLook'
import { outlineOf, type LiftBody, type LiftOutline, type Loop } from './liftedOutline'
import { lookSideOf, pieceGroundOf } from './pieceGround'

// The Lifted Frame (ticket 1177, BeadBoard card, Lifted Frame): the Frame's beads stand on one plate with a thin outline
// and two soft shadows round its outer border, holes lying on it like beads. The outline is the exact union of the
// beads' cells grown by the ground's width, filled as anti-aliased paths; no canvas `filter`, the shadows are `shadowBlur`.

/** How far outside a bead's body the outline's outer edge runs, and the line's width, in grid px. */
const OUTLINE_OUT_PX = 4
const OUTLINE_LINE_PX = 1.25
/** The outline's corner, and the rounding of an inner corner, in grid px; the ground's are the line's width in or out. */
const OUTLINE_RADIUS_PX = 5
const FILLET_PX = 3
/** How far a bead's body stands in from its cell. */
const BODY_INSET_PX = BEAD_GAP_PX / 2

/** How far toward white (dark look) or black (light look) the outline is from the Background. */
const OUTLINE_TOWARD = { dark: 0.484, light: 0.384 }

/** The two shadows at 100% zoom: a soft one a little down and a close one. `blur` is the Gaussian's spread, `down` how
 * far below the plate it falls, `opacity` its black's in each look. */
const SHADOWS = [
  { blur: 4.5, down: 3, opacity: { dark: 0.6, light: 0.2 } },
  { blur: 1, down: 0.75, opacity: { dark: 0.5, light: 0.16 } },
] as const

/** How far from a bead anything of the lift is drawn, in grid px: the outline, the soft shadow's fall and three spreads of
 * its blur. A redraw of a band takes in this much more either side. */
export const LIFT_REACH_PX = SHADOWS[0].down + SHADOWS[0].blur * 3 + OUTLINE_OUT_PX

/** The colors a plate lies in on a Background. */
interface LiftLook {
  outline: string
  ground: string
  /** The shadows' black, strongest first. */
  shadows: readonly string[]
}

const looks = new Map<string, LiftLook>()

/** The plate's look on `background`, in the look that Background is drawn in: dark on a dark one, light on a light one. */
function liftLookOf(background: string): LiftLook {
  let look = looks.get(background)
  if (!look) {
    const side = lookSideOf(background)
    look = {
      outline: toHex(mix(channelsOf(background), side === 'dark' ? WHITE : BLACK, OUTLINE_TOWARD[side])),
      ground: pieceGroundOf(background),
      shadows: SHADOWS.map(({ opacity }) => `rgba(0, 0, 0, ${opacity[side]})`),
    }
    looks.set(background, look)
  }
  return look
}

/** What a Frame's beads are for its plate: where each is, and whether they are round (Open weave). */
export interface LiftBeads {
  beads: BeadMap
  /** A position's cell in grid px from the Frame's first corner, or none where the layout has no such position. */
  cellOf: (row: number, column: number) => { x: number; y: number; width: number; height: number } | undefined
  /** What the layout is: the plate is traced again when it changes. */
  layout: string
  round: boolean
}

/** A Frame's plate: its two paths, in the Frame's own px, and where it lies. */
export interface LiftedFrame {
  /** The outline's outer edge. */
  outer: Path2D
  /** Inside the outline, one line's width in. */
  ground: Path2D
  /** Whether a point of the Frame's px is on the plate, a hole closed in included. */
  covers: (x: number, y: number) => boolean
}

/** A rounded loop as a path, moved `inset` in: a corner turning outward is rounded by `convex`, one turning in by `fillet`,
 * each no more than half of either edge it sits on. */
function roundedLoop(path: Path2D, loop: Loop, inset: number, convex: number, fillet: number): void {
  const count = loop.length
  const edge = (at: number): readonly [number, number] => {
    const [x, y] = loop[at]!
    const [nx, ny] = loop[(at + 1) % count]!
    return [Math.sign(nx - x), Math.sign(ny - y)]
  }
  const corners = loop.map(([x, y], at) => {
    const [dx, dy] = edge((at + count - 1) % count)
    const [ex, ey] = edge(at)
    // The shape is on the right of an edge: its normal is (-dy, dx).
    return { x: x + inset * (-dy - ey), y: y + inset * (dx + ex), turn: dx * ey - dy * ex }
  })
  const length = (at: number) => Math.hypot(corners[(at + 1) % count]!.x - corners[at]!.x, corners[(at + 1) % count]!.y - corners[at]!.y)
  const mid = (at: number): [number, number] => [(corners[at]!.x + corners[(at + 1) % count]!.x) / 2, (corners[at]!.y + corners[(at + 1) % count]!.y) / 2]
  path.moveTo(...mid(count - 1))
  for (let at = 0; at < count; at += 1) {
    const corner = corners[at]!
    const radius = Math.min(corner.turn > 0 ? convex : fillet, length((at + count - 1) % count) / 2, length(at) / 2)
    path.arcTo(corner.x, corner.y, ...mid(at), radius)
  }
  path.closePath()
}

/** The plate of beads' bodies: the outer edge and the ground, from the same outline. */
function pathsOf(outline: LiftOutline, round: boolean, body: number): Pick<LiftedFrame, 'outer' | 'ground'> {
  const outer = new Path2D()
  const ground = new Path2D()
  const convex = round ? body / 2 + OUTLINE_OUT_PX : OUTLINE_RADIUS_PX
  for (const loop of outline.loops) {
    roundedLoop(outer, loop, 0, convex, FILLET_PX)
    roundedLoop(ground, loop, OUTLINE_LINE_PX, convex - OUTLINE_LINE_PX, FILLET_PX + OUTLINE_LINE_PX)
  }
  return { outer, ground }
}

/** A cell's body: the part of a bead that is drawn. */
function bodyOf({ x, y, width, height }: { x: number; y: number; width: number; height: number }): LiftBody {
  return { x: x + BODY_INSET_PX, y: y + BODY_INSET_PX, width: width - 2 * BODY_INSET_PX, height: height - 2 * BODY_INSET_PX }
}

/** Adds a body to `bodies`, joined to the last one where both stand in one line less than twice the outline's reach apart:
 * their grown shapes are one then, so a row of beads is traced as a single run, not bead by bead. */
function joinRun(bodies: LiftBody[], body: LiftBody): void {
  const last = bodies[bodies.length - 1]
  if (last && last.y === body.y && last.height === body.height && body.x >= last.x && body.x - (last.x + last.width) < 2 * OUTLINE_OUT_PX) {
    last.width = Math.max(last.width, body.x + body.width - last.x)
  } else {
    bodies.push(body)
  }
}

/** What the last plate was traced from: a plate lasts while only colors change, or beads are added inside it. */
let kept: { layout: string; beads: BeadMap; outline: LiftOutline; plate: LiftedFrame; round: boolean } | undefined

/** Each position that differs between two bead maps, with whether it held a bead and does now; rows the maps share are
 * not looked into. */
function* changesBetween(before: BeadMap, after: BeadMap): Generator<{ row: number; column: number; was: boolean; is: boolean }> {
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const row = Number(key)
    const [was, is] = [before[row], after[row]]
    if (was === is) continue
    for (const column of new Set([...Object.keys(was ?? {}), ...Object.keys(is ?? {})])) {
      const at = Number(column)
      const [had, has] = [was?.[at] !== undefined, is?.[at] !== undefined]
      if (had !== has) yield { row, column: at, was: had, is: has }
    }
  }
}

/** The plate of a Frame's beads, traced once for a layout of them and kept until a bead is added outside it or erased;
 * a color change, a pan or a zoom draws it again, never traces it again. None where the Frame holds no bead. */
export function liftedFrameOf({ beads, cellOf, layout, round }: LiftBeads): LiftedFrame | undefined {
  if (kept && kept.layout === layout && kept.round === round) {
    if (kept.beads === beads) return kept.plate
    let same = true
    for (const { row, column, is } of changesBetween(kept.beads, beads)) {
      const cell = is ? cellOf(row, column) : undefined
      if (!is || !cell || !kept.outline.holds(bodyOf(cell))) {
        same = false
        break
      }
    }
    if (same) {
      kept = { ...kept, beads }
      return kept.plate
    }
  }
  const bodies: LiftBody[] = []
  for (const key in beads) {
    const row = Number(key)
    for (const column in beads[row]) {
      const cell = cellOf(row, Number(column))
      if (cell) joinRun(bodies, bodyOf(cell))
    }
  }
  const outline = outlineOf(bodies, OUTLINE_OUT_PX)
  if (!outline) {
    kept = undefined
    return undefined
  }
  const plate: LiftedFrame = { ...pathsOf(outline, round, bodies[0]!.width), covers: outline.covers }
  kept = { layout, beads, outline, plate, round }
  return plate
}

/** How far a shadow's own picture is made smaller than the surface, at most: a blur this soft loses nothing drawn small. */
const MOST_SHADOW_STEP = 4
/** The fewest sheet px of a blur's spread worth drawing small: under it the shadow is cast on the surface itself. */
const LEAST_SPREAD_SHEET_PX = 2
/** How far a shape is held off its sheet, so only its shadow lands on it, in sheet px. */
const OFF_SHEET_PX = 100_000

/** The soft shadow's own sheet, kept from draw to draw and only ever grown: canvas allocation and clearing cost more than
 * the blur of a small picture. */
let sheet: { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } | null | undefined

function shadowSheet(width: number, height: number): NonNullable<typeof sheet> | undefined {
  if (sheet === undefined) {
    const canvas = typeof document === 'undefined' ? undefined : document.createElement('canvas')
    const context = canvas?.getContext('2d')
    sheet = canvas && context ? { canvas, context } : null
  }
  if (!sheet) return undefined
  if (sheet.canvas.width < width) sheet.canvas.width = width
  if (sheet.canvas.height < height) sheet.canvas.height = height
  return sheet
}

/** Draws the plate at `origin` (the Frame's first corner in grid px): the soft shadow, the close one, the outline, the
 * ground. Shadow sizes are in device px, whatever the transform, so they follow `deviceScale` and fall down the screen. The
 * soft one is blurred on a sheet `step` times smaller than the `surface` (device px), a fraction of the cost. */
export function drawLiftedFrame(context: DrawingContext, plate: LiftedFrame, { origin, background, deviceScale, surface }: { origin: { x: number; y: number }; background: string; deviceScale: number; surface: { width: number; height: number } }): void {
  const look = liftLookOf(background)
  const [soft, close] = SHADOWS
  const step = Math.max(1, Math.min(MOST_SHADOW_STEP, Math.floor((soft.blur * deviceScale) / LEAST_SPREAD_SHEET_PX)))
  const small = step > 1 ? shadowSheet(Math.ceil(surface.width / step), Math.ceil(surface.height / step)) : undefined
  context.save()
  const base = context.getTransform()
  if (small) castSmall(context, small, plate.outer, base, origin, { shadow: look.shadows[0]!, blur: soft.blur * 2 * deviceScale, down: soft.down * deviceScale, step, surface })
  context.translate(origin.x, origin.y)
  if (!small) {
    context.shadowColor = look.shadows[0]!
    context.shadowBlur = soft.blur * 2 * deviceScale
    context.shadowOffsetY = soft.down * deviceScale
    context.fillStyle = look.outline
    context.fill(plate.outer)
    context.shadowColor = 'rgba(0, 0, 0, 0)'
    context.shadowBlur = 0
    context.shadowOffsetY = 0
  }
  // The close shadow: the shape again a little lower, in the shadow's black, under the outline.
  context.save()
  const fall = close.down * deviceScale
  const det = base.a * base.d - base.b * base.c
  context.translate((-base.c * fall) / det, (base.a * fall) / det)
  context.fillStyle = look.shadows[1]!
  context.fill(plate.outer)
  context.restore()
  context.fillStyle = look.outline
  context.fill(plate.outer)
  context.fillStyle = look.ground
  context.fill(plate.ground)
  context.restore()
}

/** Casts the soft shadow on `small`, `step` times smaller than the surface, and lays it on `context`, smoothed. */
function castSmall(context: DrawingContext, { canvas, context: on }: NonNullable<typeof sheet>, outer: Path2D, base: DOMMatrix, origin: { x: number; y: number }, { shadow, blur, down, step, surface }: { shadow: string; blur: number; down: number; step: number; surface: { width: number; height: number } }): void {
  const [width, height] = [Math.ceil(surface.width / step), Math.ceil(surface.height / step)]
  on.setTransform(1, 0, 0, 1, 0, 0)
  on.clearRect(0, 0, width, height)
  // The shape is drawn off the sheet and its shadow offset back onto it.
  on.setTransform(base.a / step, base.b / step, base.c / step, base.d / step, base.e / step - OFF_SHEET_PX, base.f / step)
  on.translate(origin.x, origin.y)
  on.shadowColor = shadow
  on.shadowOffsetX = OFF_SHEET_PX
  on.shadowOffsetY = down / step
  on.shadowBlur = blur / step
  on.fillStyle = '#000'
  on.fill(outer)
  on.shadowColor = 'rgba(0, 0, 0, 0)'
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.imageSmoothingEnabled = true
  context.drawImage(canvas, 0, 0, width, height, 0, 0, width * step, height * step)
  context.setTransform(base)
}
