import { type GridPosition, type PreviewCell } from '../domain/grid'
import { describeWeave, type Technique, type Weave } from '../domain/weave'
import { footprintOf } from '../domain/footprint'
import { MARGIN, withMargin } from '../domain/margin'
import { beadRoundness, type BeadCell } from '../domain/weave'
import { rowOrderOf } from '../domain/frameShape'
import type { LayerGeometry } from '../domain/layerGeometry'
import type { Layer } from '../domain/layers'
import { colorAt, frameContains, type Rect, type FrameSheet } from '../domain/canvas'
import { canvasWeave, frameScale, frameWeave } from '../domain/layerWeave'
import { currentPass, rowProgressOf, rowProgressOn } from '../domain/rowProgress'
import { selectionFrame, selectionHasHandles, selectionLayer as selectionLayerOf, type PastedCell, type PasteStamp, type Selection } from '../domain/selection'
import type { VisiblePositions } from '../domain/weaveGeometry'
import { GLINT_COLOR, ROW_MOTION, glintMs, glintWash } from './rowMotion'
import { brighten, CURRENT_ROW_BRIGHTNESS, DEFAULT_THEME, drawBeadLetter, drawFlatBead, flatLook, type DrawingContext, type ProjectTheme } from './beadLook'
import { beadInSpace, inSpace, geometryDrawnAlone, spaceOf, type Space } from './space'
import { drawAreaCorners, drawFrameEditing, drawRulers } from './rulerRenderer'
import { outsetBox, type HandleId, type Outset } from './frameHandles'
import { visibleBeadsInSpace, type DrawnProject } from './projectRenderer'
import type { RulerLayout } from './rulers'
import { CELL_SIZE_PX, cellSizePx } from './cellSize'
import { frameOriginPx, gridBox, inGridPx, positionBoxPx, positionsBoxPx, setGridTransform, type Region, type SurfaceView } from './surfaceView'
import { BEAD_GAP_PX } from './beadLook'
import { joinedTouching, lookSideOf } from './liftedPiece'
import { drawDraftBeads, drawsDraft } from './draftRenderer'
import { markLookAt } from './tonalTiles'
import { beadsOfLayer, frameOf, quarterTurnOf } from '../domain/layerRecord'
import { isMirrorOn, mirrorLines, shapeOwnAxes, type MirrorSetting } from '../domain/mirror'
import type { LayoutPoint, LayoutSymmetry } from '../domain/frameLayout'

// The overlay layer of a Drawing surface (CONTEXT.md, ADR 0018): everything that comes and goes with the pointer or a
// tool, drawn over the cells so it changes without redrawing them. Coordinates are the base layer's (see
// projectRenderer): a Project's own px through the same transform, so an overlay lands on its bead at every zoom.

/** The Row progress marker's thickness: the ring round a bead in the current pass (tickets 375, 376, BeadBoard
 * card). */
const MARKER_RING_PX = 2

/** The case line's thickness: the `canvas` line directly inside the ring (ticket 1031, BeadBoard card). */
const MARKER_CASE_PX = 1

/** How much larger than its neighbours a bead of the current pass is drawn on every side, in the layer's px (ticket
 * 1032, BeadBoard card): two touching beads' rings then share one `marker` line. */
const RAISE_PX = 1

/** The one shadow under the current pass's raised beads (ticket 1032, BeadBoard card): its blur's spread (a CSS
 * `blur()`, as the Lifted piece's) and fall in px at 100% zoom, on the screen whatever the turn, and its black's opacity
 * in each look, in the Lifted piece's proportion. */
const RAISED_SHADOW = { blur: 5, down: 2, opacity: { dark: 0.72, light: 0.24 } } as const

/** What a hover preview shows a bead in (BeadHover card): the chosen color at 60%, over whatever the bead holds. */
const PREVIEW_OPACITY = 0.6

/** How thick the hover preview's outline is when there is no color to show (BeadHover card): the pointer's marker
 * shares it. */
const PREVIEW_OUTLINE_PX = 2

/** How thick the hover preview's `mirror` outline is on a bead inside the Mirror's Area (ContextBar card's Mirror bar,
 * ticket 0806): round every counterpart, over its color or alone. */
const MIRROR_PREVIEW_OUTLINE_PX = 1.5

/** Which of a layer's preview beads lie inside the Mirror's Area, and so take its `mirror` outline (ticket 0806). */
type InArea = (cell: GridPosition) => boolean
const NOWHERE: InArea = () => false
const ALL_IN_AREA: InArea = () => true

/** The hover preview (ticket 23): where paint would land, or a pasted block under the cursor. */
interface HoverPreview {
  /** The beads it is on: the hovered one, or every bead of a block about to be pasted on a Custom frame. */
  cells: readonly PreviewCell[]
  /** A block about to be pasted on a grid (ticket 0675): read only where the view reaches, so a big one costs what is on
   * screen. */
  stamp?: PasteStamp
  /** The color to show on beads that carry none of their own; none for a neutral outline (no color selected). */
  color: string | null
}

/** How much of a bead as drawn the pointer's marker is (ticket 353, BeadHover card). */
const POINTER_SCALE = 0.9

/** How much smaller than that the marker is drawn, in px on the screen at any zoom, so it reads as the bead's own
 * size inside the hover preview. */
const POINTER_TRIM_PX = 1

/** The bead-shaped pointer over the board (ticket 353): where the pointer is, in the surface's own px, and the color
 * it shows. */
interface BeadPointer {
  x: number
  y: number
  /** The layer the pointer is over (ticket 492): the marker is shaped like that layer's beads. The Canvas's when none. */
  layer?: 'canvas' | 'frame'
  /** The chosen color, shown at 60%; none for the dark outline. */
  color: string | null
}

export interface OverlayInput {
  /** Whether Row progress is drawn (the current pass lifted, its row number bold). Defaults to
   * `rowProgressOn(project)` (ticket 434). */
  rowMarks?: boolean
  /** The Project whose overlay this is: its Row progress decides the marker. */
  project: DrawnProject
  /** The part of the displayed Project the surface shows, as for renderProject. */
  region: Region
  zoom: number
  pixelRatio?: number
  theme?: ProjectTheme
  /** The theme the Frame's own Background draws it in, as for renderProject; the Canvas's `theme` without one. */
  frameTheme?: ProjectTheme
  /** The hover preview to draw over the beads. */
  preview?: HoverPreview
  /** The marker that stands for the pointer over the beads (ticket 353), with the OS pointer hidden. */
  pointer?: BeadPointer
  /** The rectangle the Select, Piece or Select all marked out (tickets 31, 414): drawn as its outer border. */
  selection?: Selection
  /** Whether the Selection is Mirror mode's rubber band (ADR 0082, ticket 0806): drawn in `mirror`, as the Area it makes,
   * not `marker`. */
  marksArea?: boolean
  /** Where the Selection's eight hot corners stand (tickets 414, 0807): the view the box is measured in, `touch` for the
   * four corners alone, `hot` the one under the pointer or dragged, grown with the size `tooltip` beside it. Without it
   * the Selection has no handles. */
  selectionHandles?: AreaHandles
  // Where positions live, from `spaceOf`, as the base layer was drawn. On the Canvas (ADR 0026) any position can carry
  // a preview or Selection; in Frame-only space (default) the Project is the Frame alone, drawn from its first
  // bead.
  space?: Space
  /** The rulers and their lines (Canvas only): the Frame's line or each piece's rectangle; `surface` is the view the
   * layout was made for. */
  rulers?: { layout: RulerLayout; surface: SurfaceView }
  /** While the Frame is being set (Canvas only): its handles and the size tooltip's text. `touch` gives four larger
   * corner handles; `hot` is the one under the pointer or being dragged, drawn grown (ticket 0657). */
  frameEditing?: { touch: boolean; tooltip: string; hot?: HandleId }
  /** How visible the Frame's margin outline is, 0 to 1 (ticket 276): it fades in while the Frame is set, moved or
   * resized, and after a refused press. */
  marginOutline?: number
  /** How many positions wide the margin outline stands out from the Frame (ticket 459): wider when zoomed out.
   * Defaults to `MARGIN`. */
  margin?: number
  /** The Swatch letters by hex when Letters is on (ticket 0573): the current row's lifted beads carry theirs, as the
   * base layer's do. */
  letters?: Readonly<Record<string, string>>
  /** The Mirror while it is on (ADR 0082, ContextBar card's Mirror bar): its Area and the Axis lines inside it, with
   * every tool, whatever the Rulers toggle says. Never given by an export. */
  mirror?: MirrorSetting
  /** How a Canvas Area's eight hot corners are drawn (ticket 0807), as the Selection's. */
  mirrorArea?: AreaHandles
  /** The Area sheet's band round a rectangle Selection and the Mirror's Canvas Area (ContextBar card, ticket 0808), and
   * the view their boxes are measured in; their hot corners stand on its edge. Never given by an export. */
  areaSheet?: { surface: SurfaceView; outset: Outset }
  /** Row done's motion (ticket 0730), each with the ms since its press: the passes just finished, glinting and held at
   * full color for the dim delay, and the pass the marker left, its ruler pill gliding on. Never given by an export. */
  rowMotion?: RowMotion
}

/** How an area's hot corners are drawn (ContextBar card, Area sheet, ticket 0807). */
interface AreaHandles {
  surface: SurfaceView
  touch: boolean
  hot?: HandleId
  tooltip?: string
}

/** The Area sheet's look (ContextBar card): `--area-band-fill`, `--area-band-edge` and `--area-band-radius`. */
const AREA_BAND_FILL = 0.16
const AREA_BAND_EDGE = 0.55
const AREA_BAND_RADIUS_PX = 8

/** An Area sheet (ContextBar card, ticket 0808): the band round an area's box on screen in its colour, its outer edge a
 * 1px line; nothing on it, its bar sits above it (ticket 0812). In viewport px, the same at every zoom. */
function drawAreaSheet(context: DrawingContext, box: Region, outset: Outset, color: string, pixelRatio: number): void {
  const sheet = outsetBox(box, outset)
  context.save()
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  context.fillStyle = color
  context.globalAlpha = AREA_BAND_FILL
  context.beginPath()
  context.roundRect(sheet.x, sheet.y, sheet.width, sheet.height, AREA_BAND_RADIUS_PX)
  context.rect(box.x, box.y, box.width, box.height)
  context.fill('evenodd')
  context.globalAlpha = AREA_BAND_EDGE
  context.strokeStyle = color
  context.lineWidth = 1
  context.setLineDash([])
  context.beginPath()
  context.roundRect(sheet.x + 0.5, sheet.y + 0.5, sheet.width - 1, sheet.height - 1, AREA_BAND_RADIUS_PX)
  context.stroke()
  context.restore()
}

/** Row done's motion on the Pattern as the overlay draws it (ticket 0730). */
export interface RowMotion {
  glints: readonly { pass: number; elapsed: number }[]
  glide?: { from: number; elapsed: number }
}

/** A bead the current pass weaves: its cell, top left, and its color; on a Custom frame (ticket 0594) its box is centred
 * on 0, 0 and drawn turned to `angle` at `centre`. */
interface PassBead {
  x: number
  y: number
  width: number
  height: number
  color: string
  turned?: { centre: { x: number; y: number }; angle: number; radius: number }
}

/** Draws a pass bead where it lies: in place, or on a Custom frame turned about its centre. */
function inPlace(context: DrawingContext, bead: PassBead, draw: () => void): void {
  if (!bead.turned) {
    draw()
    return
  }
  context.save()
  context.translate(bead.turned.centre.x, bead.turned.centre.y)
  context.rotate(bead.turned.angle)
  draw()
  context.restore()
}

/** A pass bead drawn `by` px larger on every side, its corner `by` px rounder where it carries its own (ticket 1032). */
function raisedBy(bead: PassBead, by: number): PassBead {
  if (by === 0) return bead
  const turned = bead.turned && { ...bead.turned, radius: bead.turned.radius + by }
  return { ...bead, x: bead.x - by, y: bead.y - by, width: bead.width + by * 2, height: bead.height + by * 2, turned }
}

/** The beads the current pass weaves, in order along the line (on peyote's later lines only half the line is); none
 * when the Frame has no such pass. */
function beadsInPass(project: DrawnProject, space: Space, geometry: LayerGeometry, pass = currentPass(rowProgressOf(project))): PassBead[] {
  if (!space.hasFrame) {
    return []
  }
  const weave = frameWeave(project)
  const frame = frameOf(project)
  // The Frame's Row order in its own rows (turned, it lies in others: ticket 0667), or one over the Project drawn alone,
  // measured as its space is.
  const { rows, columns } = frame ?? space
  const order = rowOrderOf({ ...weave, shape: frame?.shape, settings: frame?.settings, quarterTurns: frame?.quarterTurns, rows, columns }, rowProgressOf(project))
  if (frame && !geometry.grid) {
    // A Custom frame's pass is its layout's beads, named by round and place, each at its panel's angle (ticket 0594).
    const beads = beadsOfLayer(project, 'frame')!
    return order.positionsOf(pass).flatMap((position) => {
      const color = colorAt(beads, position.row, position.column)
      const place = geometry.place(position)
      if (color === null || !place) return []
      const { x, y, width, height } = inGridPx(place.box)
      const radius = beadRoundness(weave.technique, weave.cell) * width
      return [{ x: -width / 2, y: -height / 2, width, height, color, turned: { centre: { x: x + width / 2, y: y + height / 2 }, angle: place.angle, radius } }]
    })
  }
  return order.positionsOf(pass).flatMap((position) => {
    const row = space.origin.row + position.row
    const column = space.origin.column + position.column
    // Only a cell that holds a bead is marked: an empty one gets no ring or lift (ticket 411).
    const color = beadInSpace(project, space, row, column)
    return color === null ? [] : [{ ...positionBoxPx(weave, row, column), color }]
  })
}

// The beads of the current pass lifted above their neighbours (ticket 375): drawn again over the cells so on peyote and
// brick stitch, where a neighbour sits in the gaps between corners, their corners aren't covered.
/** A pass bead's size as a bead drawer takes it: its own box turned, else a square of `side` unless its cell is not
 * square (a Bead's cell, ADR 0068, ticket 0724). */
function sizeOf(bead: PassBead, side: number): { size: number; width?: number; height?: number } {
  if (bead.turned) return { size: bead.width, width: bead.width, height: bead.height }
  return bead.width === side && bead.height === side ? { size: side } : { size: side, width: bead.width, height: bead.height }
}

// A pass just finished is drawn the same way, unbrightened and at its own size, while its glint shows it at full color
// (ticket 0730). The current pass is raised `raise` px on every side (ticket 1032); its Letter keeps the bead's size.
function drawLiftedBeads(context: DrawingContext, beads: readonly PassBead[], weave: Weave, zoom: number, pixelRatio: number, theme: ProjectTheme, letters?: Readonly<Record<string, string>>, lift = CURRENT_ROW_BRIGHTNESS, raise = 0): void {
  const cornerRadius = beadRoundness(weave.technique, weave.cell) * CELL_SIZE_PX + raise
  const look = drawsDraft(zoom * pixelRatio) ? flatLook(theme) : theme
  for (const bead of beads) {
    const raised = raisedBy(bead, raise)
    const radius = raised.turned?.radius ?? cornerRadius
    const color = lift ? brighten(bead.color, lift) : bead.color
    inPlace(context, bead, () => {
      drawFlatBead(context, { x: raised.x, y: raised.y, ...sizeOf(raised, CELL_SIZE_PX + raise * 2), cornerRadius: radius, color, dimmed: false, deviceScale: zoom * pixelRatio, theme: look })
      const letter = letters?.[bead.color]
      if (letter) {
        drawBeadLetter(context, { x: bead.x, y: bead.y, ...sizeOf(bead, CELL_SIZE_PX), color, letter, dimmed: false, theme })
      }
    })
  }
}

/** Where a point of a pass bead's box lands across the device's pixels, under the transform `m`. */
function deviceX(m: DOMMatrix2DInit, bead: PassBead, x: number, y: number): number {
  const { a = 1, c = 0, e = 0 } = m
  if (!bead.turned) return a * x + c * y + e
  const { centre, angle } = bead.turned
  const [tx, ty] = [centre.x + x * Math.cos(angle) - y * Math.sin(angle), centre.y + x * Math.sin(angle) + y * Math.cos(angle)]
  return a * tx + c * ty + e
}

// The current pass's shadow (ticket 1032): the raised beads' bodies as one shape, a row's (or column's) touching beads
// joined, filled once. The shape lies left of the device's pixels and the shadow is cast back, so only the shadow shows
// (Safari took seconds over a blurred path of many shapes: ticket 1030). Light and dark on screen only, not the draft look.
function drawRaisedShadow(context: DrawingContext, beads: readonly PassBead[], weave: Weave, deviceScale: number, theme: ProjectTheme): void {
  if (!beads.length || !theme.liftedPiece || drawsDraft(deviceScale)) return
  const inset = BEAD_GAP_PX / 2
  const body = (bead: PassBead) => raisedBy(bead, RAISE_PX - inset)
  const corner = beadRoundness(weave.technique, weave.cell) * CELL_SIZE_PX + RAISE_PX - inset
  const upright = joinedTouching(beads.filter((bead) => !bead.turned)).map((cell) => body({ ...cell, color: '' }))
  const turned = beads.filter((bead) => bead.turned).map(body)
  const shapes = [...upright, ...turned]
  const m = context.getTransform()
  const right = Math.max(0, ...shapes.flatMap((shape) => [[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => deviceX(m, shape, shape.x + u! * shape.width, shape.y + v! * shape.height))))
  const aside = Math.ceil(right) + 2
  // That shift to the left in the device's px, in the layer's own; a turned bead is moved by its centre.
  const { a = 1, b = 0, c = 0, d = 1 } = m
  const det = a * d - b * c
  const [dx, dy] = [(-aside * d) / det, (aside * b) / det]
  context.save()
  context.beginPath()
  for (const shape of upright) roundedRect(context, shape.x + dx, shape.y + dy, shape.width, shape.height, corner)
  for (const shape of turned) {
    const { centre, radius } = shape.turned!
    const moved = { ...shape, turned: { ...shape.turned!, centre: { x: centre.x + dx, y: centre.y + dy } } }
    inPlace(context, moved, () => roundedRect(context, shape.x, shape.y, shape.width, shape.height, radius))
  }
  context.fillStyle = '#000'
  context.shadowColor = `rgba(0, 0, 0, ${RAISED_SHADOW.opacity[lookSideOf(theme.canvas)]})`
  context.shadowBlur = RAISED_SHADOW.blur * 2 * deviceScale
  context.shadowOffsetX = aside
  context.shadowOffsetY = RAISED_SHADOW.down * deviceScale
  context.fill()
  context.restore()
}

/** The glint (ticket 0730, BeadBoard card): each bead of a pass just finished washed in white, one after another in
 * the Row direction, `elapsed` ms after the press; opacity only. */
function drawGlint(context: DrawingContext, beads: readonly PassBead[], weave: Weave, elapsed: number): void {
  const corner = beadRoundness(weave.technique, weave.cell) * CELL_SIZE_PX
  context.save()
  context.fillStyle = GLINT_COLOR
  beads.forEach((bead, index) => {
    const wash = glintWash(elapsed, index, beads.length)
    if (wash <= 0) return
    context.globalAlpha = wash
    inPlace(context, bead, () => {
      context.beginPath()
      roundedRect(context, bead.x, bead.y, bead.width, bead.height, bead.turned?.radius ?? corner)
      context.fill()
    })
  })
  context.restore()
}

/** One line of the ring: its color and thickness, and how far inside the cell's edge it starts. */
interface RingLine {
  color: string
  width: number
  inset: number
}

/** A ring's lines (BeadBoard card, Current row): `marker`, its outer edge on the cell's edge, and directly inside it the
 * case line in `canvas` (ticket 1031), so one of the two reads on a bead of any color. */
function ringLines(theme: ProjectTheme): readonly RingLine[] {
  return [
    { color: theme.marker, width: MARKER_RING_PX, inset: 0 },
    { color: theme.markerCase, width: MARKER_CASE_PX, inset: MARKER_RING_PX },
  ]
}

/** One line of a ring round a bead's box, centred on its own thickness and following the bead's corner `radius`. */
function ringPath(context: DrawingContext, bead: PassBead, line: RingLine, radius: number): void {
  const centre = line.inset + line.width / 2
  roundedRect(context, bead.x + centre, bead.y + centre, bead.width - 2 * centre, bead.height - 2 * centre, Math.max(0, radius - centre))
}

// The Row progress marker (tickets 352, 375, 376, 1031, 1032): a ring round each raised bead in the current pass,
// MARKER_RING_PX of `marker` on its edge and MARKER_CASE_PX of `canvas` inside it. Touching beads' `marker` lines fall
// on the same px; no line joins them otherwise: each line is one path and one stroke.
function drawBeadRings(context: DrawingContext, inPass: readonly PassBead[], weave: Weave, theme: ProjectTheme): void {
  const corner = beadRoundness(weave.technique, weave.cell) * CELL_SIZE_PX + RAISE_PX
  const lines = ringLines(theme)
  const beads = inPass.map((bead) => raisedBy(bead, RAISE_PX))
  const upright = beads.filter(({ turned }) => !turned)
  if (upright.length > 0) {
    for (const line of lines) {
      context.strokeStyle = line.color
      context.lineWidth = line.width
      context.beginPath()
      for (const bead of upright) ringPath(context, bead, line, corner)
      context.stroke()
    }
  }
  // A Custom frame's beads each lie at their panel's angle (ticket 0594): a ring apiece, turned with it.
  for (const bead of beads.filter(({ turned }) => turned)) {
    inPlace(context, bead, () => {
      for (const line of lines) {
        context.strokeStyle = line.color
        context.lineWidth = line.width
        context.beginPath()
        ringPath(context, bead, line, bead.turned!.radius)
        context.stroke()
      }
    })
  }
}

function roundedRect(context: DrawingContext, x: number, y: number, width: number, height: number, radius: number): void {
  if (typeof context.roundRect === 'function') {
    context.roundRect(x, y, width, height, radius)
    return
  }
  context.moveTo(x + radius, y)
  context.arcTo(x + width, y, x + width, y + height, radius)
  context.arcTo(x + width, y + height, x, y + height, radius)
  context.arcTo(x, y + height, x, y, radius)
  context.arcTo(x, y, x + width, y, radius)
}

// The hover preview on each bead it names, inside the rim: its color at a faint opacity over what the bead holds (a
// pasted block in each bead's own colors), or with no color a 2px dark-ink outline. A color fills the bead's own shape.
function drawPreview(context: DrawingContext, weave: Weave, space: Space, cells: readonly PreviewCell[], preview: HoverPreview, theme: ProjectTheme, inArea: InArea, emptied?: string): void {
  const { technique } = weave
  const inset = BEAD_GAP_PX / 2
  const roundness = beadRoundness(technique, weave.cell) * CELL_SIZE_PX - inset
  const boxOf = boxesOf(weave)

  for (const cell of cells) {
    if (!inSpace(space, cell.row, cell.column)) {
      continue
    }
    const box = boxOf(cell.row, cell.column)
    const x = box.x + inset
    const y = box.y + inset
    const width = box.width - BEAD_GAP_PX
    const height = box.height - BEAD_GAP_PX
    drawPreviewBead(context, { x, y, width, height, radius: roundness }, previewColorOf(cell, preview, emptied), theme, inArea(cell))
  }
}

/** One bead of the hover preview: its color faintly, or the neutral outline with none; inside the Mirror's Area a
 * `mirror` outline round it either way (ticket 0806), so the counterparts read as the Mirror's. A bead the Eraser
 * would remove (ticket 1014) comes with its empty position's color, so it fades toward it. */
function drawPreviewBead(context: DrawingContext, bead: BeadRect, color: string | null, theme: ProjectTheme, inArea: boolean): void {
  if (color) fillFaintly(context, { ...bead, radius: Math.max(0, bead.radius) }, color)
  if (inArea) outlineBead(context, bead, theme.mirror, MIRROR_PREVIEW_OUTLINE_PX)
  else if (!color) outlineBead(context, bead, theme.outline, PREVIEW_OUTLINE_PX)
}

/** The color one bead of the hover preview shows: a bead the Eraser would remove its empty position's (`emptied`,
 * ticket 1014), else its own or the preview's. */
function previewColorOf(cell: PreviewCell, preview: HoverPreview, emptied: string | undefined): string | null {
  return cell.erases && emptied ? emptied : (cell.color ?? preview.color)
}

/** What a position shows once its bead is gone (ticket 1014): its tonal tile, or where none is drawn (a theme without
 * them, the draft look) the Canvas itself and, in the Frame, the empty bead. */
function emptiedColorOf(theme: ProjectTheme, layer: Layer, deviceScale: number): string {
  const mark = markLookAt(theme, deviceScale)
  return mark.tiles ? mark.color : layer === 'frame' ? theme.emptyBead : theme.canvas
}

/** How small a bead is on the screen, in device px, below which a pasted block's preview is drawn in the draft look
 * (ticket 0675): there its gap and rounding are about a pixel, and the whole block is in view, a fill a bead. */
const DRAFT_PREVIEW_BEAD_PX = 10

/** A pasted block's preview on a layer laid on a grid: as beads, or zoomed out as one draft image at the preview's
 * opacity. */
function drawStampPreview(context: DrawingContext, weave: Weave, space: Space, cells: readonly PastedCell[], preview: HoverPreview, theme: ProjectTheme, deviceScale: number, inArea: InArea): void {
  if (CELL_SIZE_PX * deviceScale >= DRAFT_PREVIEW_BEAD_PX) {
    drawPreview(context, weave, space, cells, preview, theme, inArea)
    return
  }
  context.globalAlpha = PREVIEW_OPACITY
  drawDraftBeads(context, weave, space.open ? cells : cells.filter(({ row, column }) => inSpace(space, row, column)))
  context.globalAlpha = 1
}

/** The hover preview on beads that lie at their panels' angles (ticket 0592): the same look, each bead turned to its
 * angle at the place the Layer geometry gives it. */
function drawTurnedPreview(context: DrawingContext, geometry: LayerGeometry, roundness: number, cells: readonly PreviewCell[], preview: HoverPreview, theme: ProjectTheme, inArea: InArea, emptied?: string): void {
  for (const cell of cells) {
    const place = geometry.place(cell)
    if (!place) {
      continue
    }
    const box = inGridPx(place.box)
    const bead = { x: -box.width / 2 + BEAD_GAP_PX / 2, y: -box.height / 2 + BEAD_GAP_PX / 2, width: box.width - BEAD_GAP_PX, height: box.height - BEAD_GAP_PX, radius: Math.max(0, roundness * box.width - BEAD_GAP_PX / 2) }
    context.save()
    context.translate(box.x + box.width / 2, box.y + box.height / 2)
    context.rotate(place.angle)
    drawPreviewBead(context, bead, previewColorOf(cell, preview, emptied), theme, inArea(cell))
    context.restore()
  }
}

/** A bead as drawn: where it sits and how big, with its corner radius. */
interface BeadRect {
  x: number
  y: number
  width: number
  height: number
  radius: number
}

/** Where a position's bead is in its layer's Weave, in grid px. */
type BoxOf = (row: number, column: number) => { x: number; y: number; width: number; height: number }

/** `positionBoxPx` with the Weave's geometry looked up once, not for every bead of a big block or shape (ticket 0675). */
function boxesOf(weave: Weave): BoxOf {
  const description = describeWeave(weave)
  const size = cellSizePx(weave.technique, weave.cell)
  return (row, column) => description.box({ row, column }, size.width, size.height)
}

/** A bead-sized square (or rounded square, with a radius) in a color at the hover preview's faint opacity. */
function fillFaintly(context: DrawingContext, { x, y, width, height, radius }: BeadRect, color: string): void {
  context.globalAlpha = PREVIEW_OPACITY
  context.fillStyle = color
  if (radius > 0) {
    context.beginPath()
    roundedRect(context, x, y, width, height, radius)
    context.fill()
  } else {
    context.fillRect(x, y, width, height)
  }
  context.globalAlpha = 1
}

/** A ring `inset` thick inside the bead's rounded corners: the hover preview's neutral look in the dark ink, or its
 * `mirror` outline inside the Mirror's Area. */
function outlineBead(context: DrawingContext, { x, y, width, height, radius }: BeadRect, color: string, inset: number): void {
  context.fillStyle = color
  context.beginPath()
  roundedRect(context, x, y, width, height, Math.max(0, radius))
  roundedRect(context, x + inset, y + inset, width - 2 * inset, height - 2 * inset, Math.max(0, radius - inset))
  context.fill('evenodd')
}

// The pointer's marker (ticket 353): a bead 90% of the drawn size, centred on the pointer and looking like the hover
// preview. In the surface's px, so it follows zoom but not rotation; a pen has no CSS cursor, so one marker serves
// both.
function drawPointer(context: DrawingContext, technique: Technique, cell: BeadCell | undefined, zoom: number, pixelRatio: number, pointer: BeadPointer, theme: ProjectTheme): void {
  const size = Math.max(0, CELL_SIZE_PX * zoom * POINTER_SCALE - POINTER_TRIM_PX)
  const x = pointer.x - size / 2
  const y = pointer.y - size / 2
  const radius = Math.max(0, beadRoundness(technique, cell) * size)

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  if (pointer.color) {
    fillFaintly(context, { x, y, width: size, height: size, radius }, pointer.color)
  } else {
    outlineBead(context, { x, y, width: size, height: size, radius }, theme.outline, PREVIEW_OUTLINE_PX)
  }
}

/** How thick, in the Project's own px, the Selection's border is, inside the edge of the rectangle. */
const OUTLINE_PX = 2

// The Selection (ticket 414): the rectangle's outer border in its area's colour (`marker`, or `mirror` for the Mirror's
// Area and its rubber band, ticket 0806), no wash. One rectangle round the beads, so on peyote and brick stitch
// (alternate rows half a bead over) it spans the furthest any row reaches. Handles are drawn later in the viewport's px.
function drawSelection(context: DrawingContext, weave: Weave, space: Space, selection: Selection, color: string, view: () => VisiblePositions, origin: GridPosition, theme: ProjectTheme): void {
  if (selection.cells) {
    drawShapeOutline(context, weave, selection.cells, view(), origin, color)
    return
  }
  const bottom = space.open ? selection.top + selection.rows - 1 : Math.min(selection.top + selection.rows - 1, space.rows - 1)
  const right = space.open ? selection.left + selection.columns - 1 : Math.min(selection.left + selection.columns - 1, space.columns - 1)
  const { x, y, width, height } = positionsBoxPx(weave, selection.top, selection.left, bottom - selection.top + 1, right - selection.left + 1)

  drawCutHalves(context, weave, { top: selection.top, left: selection.left, bottom, right }, { x, y, width, height }, view(), theme)
  context.fillStyle = color
  if (describeWeave(weave).shifted) {
    drawStaircase(context, weave, { top: selection.top, left: selection.left, bottom, right }, view())
    return
  }
  context.fillRect(x, y, width, OUTLINE_PX)
  context.fillRect(x, y + height - OUTLINE_PX, width, OUTLINE_PX)
  context.fillRect(x, y, OUTLINE_PX, height)
  context.fillRect(x + width - OUTLINE_PX, y, OUTLINE_PX, height)
}

// On brick and peyote the outline runs round the whole beads the area holds, stepping in and out with the lines, so
// the dimmed half positions its edge cuts (`drawCutHalves`) lie plainly outside it (ContextBar card, Area sheet,
// mockup C). In the fill style the caller set. Only the lines in view.
function drawStaircase(context: DrawingContext, weave: Weave, lines: { top: number; left: number; bottom: number; right: number }, view: VisiblePositions): void {
  const description = describeWeave(weave)
  const cell = cellSizePx(weave.technique, weave.cell)
  const beadAt = (row: number, column: number) => description.box({ row, column }, cell.width, cell.height)
  const t = OUTLINE_PX
  if (description.staggers === 'rows') {
    let before: { first: number; end: number } | undefined
    for (let row = Math.max(lines.top, view.firstRow); row <= Math.min(lines.bottom, view.lastRow); row++) {
      const first = beadAt(row, lines.left)
      const last = beadAt(row, lines.right)
      const end = last.x + last.width
      context.fillRect(first.x, first.y, t, first.height)
      context.fillRect(end - t, first.y, t, first.height)
      if (row === lines.top) context.fillRect(first.x, first.y, end - first.x, t)
      if (row === lines.bottom) context.fillRect(first.x, first.y + first.height - t, end - first.x, t)
      if (before) {
        context.fillRect(Math.min(before.first, first.x), first.y - t / 2, Math.abs(before.first - first.x) + t, t)
        context.fillRect(Math.min(before.end, end) - t, first.y - t / 2, Math.abs(before.end - end) + t, t)
      }
      before = { first: first.x, end }
    }
    return
  }
  const firstShown = Math.min(view.columnsOf(view.firstRow).first, view.columnsOf(view.lastRow).first)
  const lastShown = Math.max(view.columnsOf(view.firstRow).last, view.columnsOf(view.lastRow).last)
  let before: { first: number; end: number } | undefined
  for (let column = Math.max(lines.left, firstShown); column <= Math.min(lines.right, lastShown); column++) {
    const first = beadAt(lines.top, column)
    const last = beadAt(lines.bottom, column)
    const end = last.y + last.height
    context.fillRect(first.x, first.y, first.width, t)
    context.fillRect(first.x, end - t, first.width, t)
    if (column === lines.left) context.fillRect(first.x, first.y, t, end - first.y)
    if (column === lines.right) context.fillRect(first.x + first.width - t, first.y, t, end - first.y)
    if (before) {
      context.fillRect(first.x - t / 2, Math.min(before.first, first.y), t, Math.abs(before.first - first.y) + t)
      context.fillRect(first.x - t / 2, Math.min(before.end, end) - t, t, Math.abs(before.end - end) + t)
    }
    before = { first: first.y, end }
  }
}

/** No band round an area: an export's, or a test's that gives none. */
const NO_OUTSET: Outset = { top: 0, right: 0, bottom: 0, left: 0 }

/** How much of the canvas covers a half position an area's edge cuts: `--area-cut` (ContextBar card, Area sheet). */
const AREA_CUT_OPACITY = 0.45

// Where the half-bead shift leaves a position half inside the rectangle (brick's rows, peyote's columns), that half is
// covered with `canvas` (ticket 0807): Select, Fill, Paste and Mirror skip it, and now it shows. Only the lines in view.
function drawCutHalves(context: DrawingContext, weave: Weave, lines: { top: number; left: number; bottom: number; right: number }, box: Region, view: VisiblePositions, theme: ProjectTheme): void {
  const description = describeWeave(weave)
  if (!description.shifted) return
  const cell = cellSizePx(weave.technique, weave.cell)
  const beadAt = (row: number, column: number) => description.box({ row, column }, cell.width, cell.height)
  context.save()
  context.globalAlpha = AREA_CUT_OPACITY
  context.fillStyle = theme.canvas
  if (description.staggers === 'rows') {
    for (let row = Math.max(lines.top, view.firstRow); row <= Math.min(lines.bottom, view.lastRow); row++) {
      const first = beadAt(row, lines.left)
      const last = beadAt(row, lines.right)
      if (first.x > box.x) context.fillRect(box.x, first.y, first.x - box.x, first.height)
      const end = last.x + last.width
      if (end < box.x + box.width) context.fillRect(end, last.y, box.x + box.width - end, last.height)
    }
  } else {
    const firstShown = Math.min(view.columnsOf(view.firstRow).first, view.columnsOf(view.lastRow).first)
    const lastShown = Math.max(view.columnsOf(view.firstRow).last, view.columnsOf(view.lastRow).last)
    for (let column = Math.max(lines.left, firstShown); column <= Math.min(lines.right, lastShown); column++) {
      const first = beadAt(lines.top, column)
      const last = beadAt(lines.bottom, column)
      if (first.y > box.y) context.fillRect(first.x, box.y, first.width, first.y - box.y)
      const end = last.y + last.height
      if (end < box.y + box.height) context.fillRect(last.x, end, last.width, box.y + box.height - end)
    }
  }
  context.restore()
}

/** The eight positions round a bead, as steps down and across: a bit each, in this order, in a bead's `around`. */
const AROUND = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]] as const
const ALL_AROUND = (1 << AROUND.length) - 1

/** A shape's outline by row: each bead with a position round it the shape doesn't hold, and which ones it does. */
type Outline = Map<number, { column: number; around: number }[]>

// A Selection's shape never changes in place, so its outline is worked out once per shape and only drawn after that
// (ticket 0675).
const outlines = new WeakMap<readonly GridPosition[], Outline>()

function outlineOf(cells: readonly GridPosition[]): Outline {
  const known = outlines.get(cells)
  if (known) return known
  const rows = new Map<number, Set<number>>()
  for (const { row, column } of cells) rows.set(row, (rows.get(row) ?? new Set()).add(column))
  const has = (row: number, column: number) => rows.get(row)?.has(column) === true
  const outline: Outline = new Map()
  for (const { row, column } of cells) {
    let around = 0
    AROUND.forEach(([down, across], bit) => {
      if (has(row + down, column + across)) around |= 1 << bit
    })
    if (around === ALL_AROUND) continue
    const beads = outline.get(row) ?? []
    beads.push({ column, around })
    outline.set(row, beads)
  }
  outlines.set(cells, outline)
  return outline
}

/** A bead's box on screen, in grid px. */
type BeadBox = ReturnType<BoxOf>

/** How close two edges lie to count as one, in grid px: boxes are whole fractions of a bead, never this near by chance. */
const TOUCH_PX = 0.01
/** How far off a line's end the shape is probed for the way its outline turns there, in grid px. */
const PROBE_PX = 0.5

/** The stretches of `from`..`to` that none of `covers` lies over. */
function uncovered(from: number, to: number, covers: readonly (readonly [number, number])[]): [number, number][] {
  const left: [number, number][] = []
  let at = from
  for (const [start, end] of [...covers].sort((a, b) => a[0] - b[0])) {
    if (start - at > TOUCH_PX) left.push([at, Math.min(start, to)])
    at = Math.max(at, end)
  }
  if (to - at > TOUCH_PX) left.push([at, to])
  return left
}

// One bead's share of a shape's outline (ticket 1013): of each side, the stretches no bead of the shape (`beads`: its
// own box and its neighbours') lies against, so on peyote and brick stitch a side half against a neighbour is drawn
// half. The line lies inside the bead; where the outline turns into the shape, the line across runs on to close the corner.
function drawBeadOutline(context: DrawingContext, own: BeadBox, beads: readonly BeadBox[]): void {
  const t = OUTLINE_PX
  const inShape = (x: number, y: number) => beads.some((bead) => x > bead.x && x < bead.x + bead.width && y > bead.y && y < bead.y + bead.height)
  const right = own.x + own.width
  const bottom = own.y + own.height
  /** The free stretches of one of its sides, `from`..`to` along it: clear of each neighbour that `lies` against that
   * side, over the `span` it lies there. */
  const free = (from: number, to: number, lies: (bead: BeadBox) => boolean, span: (bead: BeadBox) => readonly [number, number]) => {
    const against = beads.filter((bead) => bead !== own && lies(bead)).map(span)
    return uncovered(from, to, against.filter(([start, end]) => Math.min(to, end) - Math.max(from, start) > TOUCH_PX))
  }
  const meets = (edge: number, at: number) => Math.abs(edge - at) < TOUCH_PX
  const wide = (bead: BeadBox) => [bead.x, bead.x + bead.width] as const
  const tall = (bead: BeadBox) => [bead.y, bead.y + bead.height] as const
  /** How far a line across runs on past its end at `x`: its thickness where the shape lies on both sides of it there. */
  const reach = (x: number, y: number, way: number) => (inShape(x + way * PROBE_PX, y - PROBE_PX) && inShape(x + way * PROBE_PX, y + PROBE_PX) ? t : 0)

  for (const [from, to] of free(own.x, right, (bead) => meets(bead.y + bead.height, own.y), wide)) {
    const start = from - reach(from, own.y, -1)
    context.fillRect(start, own.y, to + reach(to, own.y, 1) - start, t)
  }
  for (const [from, to] of free(own.x, right, (bead) => meets(bead.y, bottom), wide)) {
    const start = from - reach(from, bottom, -1)
    context.fillRect(start, bottom - t, to + reach(to, bottom, 1) - start, t)
  }
  for (const [from, to] of free(own.y, bottom, (bead) => meets(bead.x + bead.width, own.x), tall)) context.fillRect(own.x, from, t, to - from)
  for (const [from, to] of free(own.y, bottom, (bead) => meets(bead.x, right), tall)) context.fillRect(right - t, from, t, to - from)
}

// A shaped Selection (ticket 547): each stretch of a bead's side that no other bead of the shape lies against is part of
// the outline, so it runs round the outside and round each hole, whole on every Weave (ticket 1013). Only the part in
// view is drawn (ticket 0675); `origin` is the layer's first position on the Canvas, the cells being Canvas positions.
function drawShapeOutline(context: DrawingContext, weave: Weave, cells: readonly GridPosition[], view: VisiblePositions, origin: GridPosition, color: string): void {
  const boxOf = boxesOf(weave)
  context.fillStyle = color
  for (const [canvasRow, beads] of outlineOf(cells)) {
    const row = canvasRow - origin.row
    if (row < view.firstRow || row > view.lastRow) continue
    const { first, last } = view.columnsOf(row)
    for (const bead of beads) {
      const column = bead.column - origin.column
      if (column < first || column > last) continue
      const own = boxOf(row, column)
      const boxes = [own]
      AROUND.forEach(([down, across], bit) => {
        if (bead.around & (1 << bit)) boxes.push(boxOf(row + down, column + across))
      })
      drawBeadOutline(context, own, boxes)
    }
  }
}

/** Every position, for a layer whose view can't be culled by rows and columns (a Custom frame's). */
const EVERYWHERE: VisiblePositions = { firstRow: -Infinity, lastRow: Infinity, columnsOf: () => ({ first: -Infinity, last: Infinity }) }

/** The cells of a paste stamp in view on one layer (ticket 0675), counted from `origin`, the layer's first position on
 * the Canvas: read only where the view reaches, so a big block costs what is on screen. `keeps`, where some cells are
 * another layer's, takes Canvas positions. */
function stampInView(stamp: PasteStamp, view: VisiblePositions, origin: GridPosition, keeps?: (cell: GridPosition) => boolean): PastedCell[] {
  const cells: PastedCell[] = []
  const top = stamp.top - origin.row
  const left = stamp.left - origin.column
  for (let row = Math.max(view.firstRow, top); row <= Math.min(view.lastRow, top + stamp.rows - 1); row++) {
    const colors = stamp.colors[row - top]!
    const { first, last } = view.columnsOf(row)
    for (let column = Math.max(first, left); column <= Math.min(last, left + stamp.columns - 1); column++) {
      const color = colors[column - left]
      if (color && stamp.lands(row + origin.row, column + origin.column) && (!keeps || keeps({ row: row + origin.row, column: column + origin.column }))) cells.push({ row, column, color })
    }
  }
  return cells
}

/** The Frame margin's outline (ticket 276, Frame card): 1px dashed `line-strong` round its outer edge, radius 12,
 * faded by `opacity`. Drawn in grid space, so its widths are divided by the zoom to stay screen px. */
const MARGIN_OUTLINE_DASH_PX = [4, 3]
const MARGIN_OUTLINE_RADIUS_PX = 12

/** Strokes the box round the margin's drawn extent on the Canvas (ticket 372): a staggered Technique adds half a bead across
 * (brick stitch) or down (peyote), so it is not `rows * CELL_SIZE_PX`. */
function drawMarginOutline(context: DrawingContext, weave: Weave, frame: Rect, zoom: number, opacity: number, theme: ProjectTheme, margin: number): void {
  const { x, y, width, height } = gridBox(weave, withMargin(frame, margin))
  context.save()
  context.globalAlpha = opacity
  context.strokeStyle = theme.pieceLine
  context.lineWidth = 1 / zoom
  context.setLineDash(MARGIN_OUTLINE_DASH_PX.map((length) => length / zoom))
  context.beginPath()
  roundedRect(context, x, y, width, height, MARGIN_OUTLINE_RADIUS_PX / zoom)
  context.stroke()
  context.restore()
}

/** An Axis line (ContextBar card's Mirror bar, `--mirror-axis-width` and `--mirror-axis-dash`): 1.25px `mirror`, dash 5 4, in
 * screen px at any zoom. */
const MIRROR_AXIS_WIDTH_PX = 1.25
const MIRROR_AXIS_DASH_PX = [5, 4]

/** Radial's centre ring (ContextBar card's Mirror bar, `--mirror-ring-radius`): 7px radius, 2px `mirror`; the mirror lines after
 * the first at `--mirror-axis-soft`. */
const MIRROR_RING_RADIUS_PX = 7
const MIRROR_RING_WIDTH_PX = 2
const MIRROR_AXIS_SOFT = 0.45

/** Draws Radial about its centre (ticket 0705, ContextBar card's Mirror bar), clipped to a box (the Area's): in
 * Mirror mode the Fold's mirror lines through the centre, 180° over the Fold apart, the first full and the others soft;
 * in Repeat mode the Fold's rays, 360° apart; the first straight up or `startAngle` clockwise of it (0706); the ring. */
function drawRadial(context: DrawingContext, centre: { x: number; y: number }, setting: MirrorSetting, box: Region, zoom: number, theme: ProjectTheme, startAngle = 0): void {
  const mirror = setting.mode === 'mirror'
  const step = (mirror ? Math.PI : 2 * Math.PI) / setting.fold
  // From the centre inside the box, no line to its edge is longer than its diagonal.
  const reach = Math.hypot(box.width, box.height)
  context.save()
  context.beginPath()
  context.rect(box.x, box.y, box.width, box.height)
  context.clip()
  context.strokeStyle = theme.mirror
  context.lineWidth = MIRROR_AXIS_WIDTH_PX / zoom
  context.setLineDash(MIRROR_AXIS_DASH_PX.map((length) => length / zoom))
  for (let turn = 0; turn < setting.fold; turn++) {
    const dx = Math.sin(startAngle + turn * step) * reach
    const dy = -Math.cos(startAngle + turn * step) * reach
    context.globalAlpha = mirror && turn > 0 ? MIRROR_AXIS_SOFT : 1
    context.beginPath()
    // A mirror line runs through the centre from its upward end; a ray runs out from the centre.
    if (mirror) {
      context.moveTo(centre.x + dx, centre.y + dy)
      context.lineTo(centre.x - dx, centre.y - dy)
    } else {
      context.moveTo(centre.x, centre.y)
      context.lineTo(centre.x + dx, centre.y + dy)
    }
    context.stroke()
  }
  context.globalAlpha = 1
  context.setLineDash([])
  context.lineWidth = MIRROR_RING_WIDTH_PX / zoom
  context.beginPath()
  context.arc(centre.x, centre.y, MIRROR_RING_RADIUS_PX / zoom, 0, Math.PI * 2)
  context.stroke()
  context.restore()
}

/** A Canvas Area as the Selection is drawn (ADR 0082), in its own colour (ticket 0806): the `mirror` rectangle round its
 * cells. */
function drawAreaRect(context: DrawingContext, weave: Weave, space: Space, rect: Rect, color: string, view: () => VisiblePositions, origin: GridPosition, theme: ProjectTheme): void {
  drawSelection(context, weave, space, { top: rect.row, left: rect.column, rows: rect.rows, columns: rect.columns }, color, view, origin, theme)
}

/** Draws Mirror's Axis lines across its grid Area (spec 0702), or Radial's ring and lines (ticket 0705), where the Mirror
 * maps by (`mirrorLines`, ticket 0775): in beads from its unshifted lines' corner, so the half bead a shift adds to the
 * box moves none; one the Area does not offer is not drawn. In the layer's own px; widths are divided by the zoom. */
function drawMirrorAxes(context: DrawingContext, weave: Weave, frame: Rect, setting: MirrorSetting, zoom: number, theme: ProjectTheme): void {
  if (!isMirrorOn(setting)) return
  const box = gridBox(weave, frame)
  const cell = cellSizePx(weave.technique, weave.cell)
  const lines = mirrorLines(weave, frame, setting)
  if (lines.radial) {
    drawRadial(context, { x: box.x + lines.radial.centre.x * cell.width, y: box.y + lines.radial.centre.y * cell.height }, { ...setting, fold: lines.radial.fold }, box, zoom, theme)
    return
  }
  if (lines.leftRight.length === 0 && lines.topBottom.length === 0) return
  const { x, y, width, height } = box
  context.save()
  context.strokeStyle = theme.mirror
  context.lineWidth = MIRROR_AXIS_WIDTH_PX / zoom
  context.setLineDash(MIRROR_AXIS_DASH_PX.map((length) => length / zoom))
  context.beginPath()
  for (const offset of lines.leftRight) {
    const at = x + offset * cell.width
    context.moveTo(at, y)
    context.lineTo(at, y + height)
  }
  for (const offset of lines.topBottom) {
    const at = y + offset * cell.height
    context.moveTo(x, at)
    context.lineTo(x + width, at)
  }
  context.stroke()
  context.restore()
}

/** Draws Mirror's lines on a Custom frame (ticket 0706, ContextBar card's Mirror bar) in the Frame's own px, its own
 * Axes (ADR 0082): on a round shape Radial's ring and lines about the layout's centre, the side count as the Fold, the
 * first along the first Seam; else, in Mirror mode, its straight line through the layout's centre across the rectangle. */
function drawLayoutAxes(context: DrawingContext, symmetry: LayoutSymmetry & { centre: LayoutPoint }, box: Region, setting: MirrorSetting, zoom: number, theme: ProjectTheme): void {
  if (!isMirrorOn(setting)) return
  const { leftRight, topBottom, radial } = shapeOwnAxes(symmetry)
  const centre = { x: box.x + symmetry.centre.x * CELL_SIZE_PX, y: box.y + symmetry.centre.y * CELL_SIZE_PX }
  if (radial) {
    drawRadial(context, centre, { ...setting, fold: symmetry.fold }, box, zoom, theme, symmetry.line)
    return
  }
  if (setting.mode !== 'mirror' || !(leftRight || topBottom)) return
  context.save()
  context.strokeStyle = theme.mirror
  context.lineWidth = MIRROR_AXIS_WIDTH_PX / zoom
  context.setLineDash(MIRROR_AXIS_DASH_PX.map((length) => length / zoom))
  context.beginPath()
  if (leftRight) {
    context.moveTo(centre.x, box.y)
    context.lineTo(centre.x, box.y + box.height)
  }
  if (topBottom) {
    context.moveTo(box.x, centre.y)
    context.lineTo(box.x + box.width, centre.y)
  }
  context.stroke()
  context.restore()
}

/** Whether a position of the Canvas is on the Frame (ticket 492): the layer it names, or else whether it lies under what
 * the Frame draws (ADR 0066). */
function onFrame(frame: FrameSheet | undefined, geometry: LayerGeometry | undefined, covered: Rect | undefined, position: GridPosition): boolean {
  if (frame === undefined) return false
  // A Custom frame's positions are named by round and place, which its rectangle does not bound (ticket 0592).
  return position.layer ? position.layer === 'frame' && (!geometry?.grid || frameContains(frame, position)) : covered !== undefined && frameContains(covered, position)
}

/** The Frame's positions counted from its own first (ticket 492): a position of the Canvas that lies on it, or the cell
 * as it is. */
function inFrameTerms<T extends GridPosition>(frame: FrameSheet, cell: T): T {
  return { ...cell, row: cell.row - frame.row, column: cell.column - frame.column }
}

/** Draws the overlay for the part of the Project in the region, clearing what was there first. Transparent wherever
 * nothing is drawn. On the Canvas it goes a layer at a time (ticket 492): the Canvas's in its Weave, then the Frame's
 * in its own from its first position's corner, its items counted from its first position. */
export function renderOverlay(context: DrawingContext, input: OverlayInput): void {
  const { project, region, zoom, pixelRatio = 1, theme = DEFAULT_THEME, frameTheme = theme, space = spaceOf(project, false), preview, selection, marksArea = false, rulers, frameEditing, selectionHandles, marginOutline = 0, margin = MARGIN, pointer, rowMarks, letters, mirror, mirrorArea, areaSheet, rowMotion } = input

  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, region.width * pixelRatio, region.height * pixelRatio)

  const showRows = rowMarks ?? rowProgressOn(project)
  const ruled = space.open && rulers !== undefined && (frameOf(project) !== undefined || Object.keys(beadsOfLayer(project, 'canvas')).length > 0)
  if (!showRows && !preview && !selection && !ruled && !frameEditing && !pointer && !(marginOutline > 0) && !mirror) {
    return
  }

  setGridTransform(context, space.extent, region, zoom, quarterTurnOf(project), pixelRatio)
  // Bitmaps of beads are made at the size they are on the screen, so they are blitted as they are, not resampled.
  context.imageSmoothingEnabled = false

  const frame = space.open ? frameOf(project) : undefined
  const covered = footprintOf(project)
  const canvasWeaveOf = canvasWeave(project)
  const frameSpace = frame ? spaceOf(project, false) : undefined
  const geometry = frame || !space.open ? geometryDrawnAlone(project) : undefined

  // The Canvas's items: all of them when it is the only layer, else those not on the Frame.
  const offFrame = <T extends GridPosition>(cells: readonly T[]): T[] => cells.filter((cell) => !onFrame(frame, geometry, covered, cell))
  const ownLayer: 'canvas' | 'frame' = space.open ? (selection ? selectionLayerOf(project, selection) : 'canvas') : 'frame'
  const canvasSelection = selection && ownLayer === 'canvas' ? selection : undefined
  const canvasView = () => visibleBeadsInSpace(canvasWeaveOf, space, region, zoom, quarterTurnOf(project))
  const offFrameStamp = (stamp: PasteStamp) => stampInView(stamp, canvasView(), { row: 0, column: 0 }, frame && ((cell) => !onFrame(frame, geometry, covered, cell)))
  const canvasCells = preview && space.open ? offFrame(preview.cells) : []
  const canvasStamp = preview?.stamp && space.open ? offFrameStamp(preview.stamp) : []

  if (space.open && marginOutline > 0 && frameOf(project)) {
    drawMarginOutline(context, canvasWeaveOf, covered!, zoom, marginOutline, theme, margin)
  }
  // The Mirror's Area (ADR 0082), drawn while it is on: a Canvas rectangle with its Axes and its handles after, or the
  // whole Frame's Axes.
  const canvasArea = mirror?.place?.layer === 'canvas' ? mirror.place.area : undefined
  const wholeFrame = mirror?.place?.layer === 'frame' ? mirror : undefined
  // The hover preview's beads inside the Area, outlined in `mirror` (ticket 0806): a Canvas Area's, or all the Frame's.
  const inCanvasArea: InArea = canvasArea ? (cell) => frameContains(canvasArea, cell) : NOWHERE
  const selectionColor = marksArea ? theme.mirror : theme.marker

  // From the bottom up, in the order the DOM grid stacked them: a bead faded, the Selection on it, the hover preview
  // over that, and the marker lifted above its row.
  if (space.open) {
    if (canvasSelection) drawSelection(context, canvasWeaveOf, space, canvasSelection, selectionColor, canvasView, { row: 0, column: 0 }, theme)
    if (preview && canvasCells.length) drawPreview(context, canvasWeaveOf, space, canvasCells, preview, theme, inCanvasArea, emptiedColorOf(theme, 'canvas', zoom * pixelRatio))
    if (preview && canvasStamp.length) drawStampPreview(context, canvasWeaveOf, space, canvasStamp, preview, theme, zoom * pixelRatio, inCanvasArea)
    if (canvasArea) {
      drawAreaRect(context, canvasWeaveOf, space, canvasArea, theme.mirror, canvasView, { row: 0, column: 0 }, theme)
      drawMirrorAxes(context, canvasWeaveOf, canvasArea, mirror!, zoom, theme)
    }
  }

  // The Frame's layer, or the Project drawn alone.
  const sheetSpace = space.open ? frameSpace : space
  if (sheetSpace && (frame || !space.open)) {
    const sheetWeave = frameWeave(project)
    const origin = frame ? frameOriginPx(canvasWeaveOf, frame) : { x: 0, y: 0 }
    // The Frame's own px are its Bead's size over the Canvas's (ticket 0665); drawn alone, they are the space's.
    const scale = frame ? frameScale(project) : 1
    const local = <T extends GridPosition>(cell: T): T => (frame ? inFrameTerms(frame, cell) : cell)
    const onSheet = <T extends GridPosition>(cells: readonly T[]): T[] => (frame ? cells.filter((cell) => onFrame(frame, geometry, covered, cell)).map(local) : [...cells])
    // A shape keeps its Canvas positions, counted from the layer's first, so its outline is worked out only once.
    const layerOrigin = frame ? { row: frame.row, column: frame.column } : { row: 0, column: 0 }
    const sheetSelection = selection && ownLayer === 'frame' ? (frame ? { ...selection, top: selection.top - frame.row, left: selection.left - frame.column } : selection) : undefined
    const sheetView = (): VisiblePositions => {
      if (geometry!.grid) return visibleBeadsInSpace(sheetWeave, space, region, zoom, quarterTurnOf(project), origin, scale)
      // A Custom frame's cells are named by round and place: only those its rectangle holds can be on it.
      return covered ? { firstRow: covered.row - layerOrigin.row, lastRow: covered.row + covered.rows - 1 - layerOrigin.row, columnsOf: () => ({ first: covered.column - layerOrigin.column, last: covered.column + covered.columns - 1 - layerOrigin.column }) } : EVERYWHERE
    }
    const onSheetStamp = (stamp: PasteStamp) => stampInView(stamp, sheetView(), layerOrigin, frame && ((cell) => onFrame(frame, geometry, covered, cell)))
    context.save()
    context.translate(origin.x, origin.y)
    if (scale !== 1) context.scale(scale, scale)
    const inPass = showRows ? beadsInPass(project, sheetSpace, geometry!) : []
    // Under the current pass, so on peyote and brick stitch its lifted beads still lie over the one just finished.
    for (const { pass, elapsed } of showRows ? (rowMotion?.glints ?? []) : []) {
      const finished = beadsInPass(project, sheetSpace, geometry!, pass)
      if (elapsed >= glintMs(finished.length)) continue
      if (elapsed < ROW_MOTION.dimDelay) drawLiftedBeads(context, finished, sheetWeave, zoom * scale, pixelRatio, theme, letters, 0)
      drawGlint(context, finished, sheetWeave, elapsed)
    }
    if (showRows) {
      // The pass raised over its neighbours on its one shadow (ticket 1032); its rings come after the Selection.
      drawRaisedShadow(context, inPass, sheetWeave, zoom * scale * pixelRatio, theme)
      drawLiftedBeads(context, inPass, sheetWeave, zoom * scale, pixelRatio, theme, letters, CURRENT_ROW_BRIGHTNESS, RAISE_PX)
    }
    if (sheetSelection) drawSelection(context, sheetWeave, sheetSpace, sheetSelection, selectionColor, sheetView, layerOrigin, theme)
    // The whole-Frame Mirror, in the Frame's own positions from its first, drawn alone too: the Axes across a Frame on a
    // grid; a Custom frame's through its layout's centre (ticket 0706).
    const mirrored = wholeFrame && geometry!.grid ? frameOf(project) : undefined
    if (mirrored) drawMirrorAxes(context, sheetWeave, { row: 0, column: 0, rows: mirrored.rows, columns: mirrored.columns }, wholeFrame!, zoom * scale, theme)
    const symmetry = wholeFrame && !geometry!.grid ? geometry!.symmetry?.() : undefined
    if (symmetry) drawLayoutAxes(context, symmetry, gridBox(sheetWeave, { row: 0, column: 0, rows: sheetSpace.rows, columns: sheetSpace.columns }), wholeFrame!, zoom * scale, theme)
    const sheetCells = preview ? onSheet(preview.cells) : []
    const sheetStamp = preview?.stamp ? onSheetStamp(preview.stamp) : []
    const inFrameArea = wholeFrame ? ALL_IN_AREA : NOWHERE
    if (preview && sheetCells.length + sheetStamp.length > 0) {
      const emptied = emptiedColorOf(frameTheme, 'frame', zoom * scale * pixelRatio)
      if (!geometry!.grid) drawTurnedPreview(context, geometry!, beadRoundness(sheetWeave.technique, sheetWeave.cell), [...sheetCells, ...sheetStamp], preview, theme, inFrameArea, emptied)
      else {
        if (sheetCells.length) drawPreview(context, sheetWeave, sheetSpace, sheetCells, preview, theme, inFrameArea, emptied)
        if (sheetStamp.length) drawStampPreview(context, sheetWeave, sheetSpace, sheetStamp, preview, theme, zoom * scale * pixelRatio, inFrameArea)
      }
    }
    if (inPass.length > 0) {
      drawBeadRings(context, inPass, sheetWeave, theme)
    }
    context.restore()
  }

  // The Area sheets, the Mirror's first so a Selection's lies over it where the two meet (ContextBar card), under the
  // rulers and the hot corners.
  const outset = areaSheet?.outset ?? NO_OUTSET
  const selectionBox = selection && space.open && !selection.cells && areaSheet ? areaSheet.surface.beadBox(selectionFrame(selection), ownLayer) : undefined
  if (areaSheet && space.open && canvasArea) drawAreaSheet(context, areaSheet.surface.beadBox(canvasArea, 'canvas'), outset, theme.mirror, pixelRatio)
  if (areaSheet && selectionBox) drawAreaSheet(context, selectionBox, outset, selectionColor, pixelRatio)

  // The rulers are laid out in the viewport's own px, over everything the grid-space drawing above made.
  if (ruled && rulers) {
    drawRulers(context, {
      project,
      surface: rulers.surface,
      layout: rulers.layout,
      pixelRatio,
      theme,
      rowMarks: showRows,
      glide: rowMotion?.glide,
    })
  }
  if (space.open && rulers && frameEditing && frameOf(project)) {
    drawFrameEditing(context, {
      frame: frameOf(project)!,
      surface: rulers.surface,
      pixelRatio,
      theme,
      touch: frameEditing.touch,
      hot: frameEditing.hot,
      // The Frame's size shows with the Rulers off too: its rulers are always on (ticket 1012).
      tooltip: frameEditing.tooltip,
    })
  }
  // The Area's corners first, so a Selection's lie over them where the two meet (ContextBar card, Mirror bar placement).
  // An Area's or a Selection's size is a number too: the Rulers toggle hides its Tooltip with the rest.
  const sized = (handles: AreaHandles) => (rulers?.layout.numbers === false ? '' : (handles.tooltip ?? ''))
  if (mirrorArea && space.open && canvasArea) {
    drawAreaCorners(context, { ...mirrorArea, box: mirrorArea.surface.beadBox(canvasArea, 'canvas'), outset, pixelRatio, theme, color: theme.mirror, tooltip: sized(mirrorArea) })
  }
  if (selection && selectionHandles && space.open && selectionHasHandles(selection)) {
    drawAreaCorners(context, { ...selectionHandles, box: selectionHandles.surface.beadBox(selectionFrame(selection), ownLayer), outset, pixelRatio, theme, color: selectionColor, tooltip: sized(selectionHandles) })
  }
  if (pointer) {
    const pointerWeave = pointer.layer === 'frame' ? frameWeave(project) : canvasWeaveOf
    // On the Canvas, a Frame's bead is its Bead's size (ticket 0665).
    const scaled = pointer.layer === 'frame' && space.open ? frameScale(project) : 1
    drawPointer(context, pointerWeave.technique, pointerWeave.cell, zoom * scaled, pixelRatio, pointer, theme)
  }
}
