import { type GridPosition, type PreviewCell } from '../domain/grid'
import { describeWeave, type Technique, type Weave } from '../domain/weave'
import { footprintOf } from '../domain/footprint'
import { MARGIN, withMargin } from '../domain/margin'
import { beadRoundness, type BeadCell } from '../domain/weave'
import { rowOrderOf } from '../domain/frameShape'
import type { LayerGeometry } from '../domain/layerGeometry'
import { colorAt, frameContains, type Rect, type FrameSheet } from '../domain/canvas'
import { canvasWeave, frameScale, frameWeave } from '../domain/layerWeave'
import { currentPass, rowProgressOf, rowProgressOn } from '../domain/rowProgress'
import { selectionFrame, selectionHasHandles, selectionLayer as selectionLayerOf, type PastedCell, type PasteStamp, type Selection } from '../domain/selection'
import type { VisiblePositions } from '../domain/weaveGeometry'
import { brighten, CURRENT_ROW_BRIGHTNESS, DEFAULT_THEME, drawBeadLetter, drawFlatBead, type DrawingContext, type ProjectTheme } from './beadLook'
import { beadInSpace, inSpace, geometryDrawnAlone, spaceOf, type Space } from './space'
import { drawBoxHandles, drawFrameEditing, drawRulers } from './rulerRenderer'
import type { HandleId } from './frameHandles'
import { visibleBeadsInSpace, type DrawnProject } from './projectRenderer'
import type { RulerLayout } from './rulers'
import { CELL_SIZE_PX, cellSizePx } from './cellSize'
import { frameOriginPx, gridBox, inGridPx, positionBoxPx, positionsBoxPx, setGridTransform, type Region, type SurfaceView } from './surfaceView'
import { BEAD_GAP_PX } from './beadLook'
import { drawDraftBeads } from './draftRenderer'
import { beadsOfLayer, frameOf, quarterTurnOf } from '../domain/layerRecord'
import { axisOffsets, isMirrorOn, type MirrorSetting } from '../domain/mirror'

// The overlay layer of a Drawing surface (CONTEXT.md, ADR 0018): everything that comes and goes with the pointer or a
// tool, drawn over the cells so it changes without redrawing them. Coordinates are the base layer's (see
// projectRenderer): a Project's own px through the same transform, so an overlay lands on its bead at every zoom.

/** The Row progress marker's thickness: the ring round a bead in the current pass (tickets 375, 376, BeadBoard
 * card). */
const MARKER_RING_PX = 2

/** What a hover preview shows a bead in (BeadHover card): the chosen color at 60%, over whatever the bead holds. */
const PREVIEW_OPACITY = 0.6

/** How thick the hover preview's outline is when there is no color to show (BeadHover card): the pointer's marker
 * shares it. */
const PREVIEW_OUTLINE_PX = 2

/** The hover preview (ticket 23): where paint would land, or a pasted block under the cursor. */
export interface HoverPreview {
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
  /** The hover preview to draw over the beads. */
  preview?: HoverPreview
  /** The marker that stands for the pointer over the beads (ticket 353), with the OS pointer hidden. */
  pointer?: BeadPointer
  /** The rectangle the Select, Piece or Select all marked out (tickets 31, 414): drawn as its outer border. */
  selection?: Selection
  /** Where the Selection's eight handles stand (ticket 414): the view the box is measured in, and `touch` for four
   * larger ones. Without it the Selection has no handles. */
  selectionHandles?: { surface: SurfaceView; touch: boolean }
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
  /** The Mirror setting while the mode is not Off (ticket 0703, MirrorPopover card): its Axis lines are drawn across the
   * Frame, with every tool, whatever the Rulers toggle says. Never given by an export. */
  mirror?: MirrorSetting
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

/** The beads the current pass weaves, in order along the line (on peyote's later lines only half the line is); none
 * when the Frame has no such pass. */
function beadsInPass(project: DrawnProject, space: Space, geometry: LayerGeometry): PassBead[] {
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
    return order.positionsOf(currentPass(rowProgressOf(project))).flatMap((position) => {
      const color = colorAt(beads, position.row, position.column)
      const place = geometry.place(position)
      if (color === null || !place) return []
      const { x, y, width, height } = inGridPx(place.box)
      const radius = beadRoundness(weave.technique, weave.cell) * width
      return [{ x: -width / 2, y: -height / 2, width, height, color, turned: { centre: { x: x + width / 2, y: y + height / 2 }, angle: place.angle, radius } }]
    })
  }
  return order.positionsOf(currentPass(rowProgressOf(project))).flatMap((position) => {
    const row = space.origin.row + position.row
    const column = space.origin.column + position.column
    // Only a cell that holds a bead is marked: an empty one gets no ring or lift (ticket 411).
    const color = beadInSpace(project, space, row, column)
    return color === null ? [] : [{ ...positionBoxPx(weave, row, column), color }]
  })
}

// The beads of the current pass lifted above their neighbours (ticket 375): drawn again over the cells so on peyote and
// brick stitch, where the next row nests into the gaps, their corners aren't covered.
/** A bead's width and height, where they aren't a square of the drawn size (a Real cell, ADR 0068). */
function sizedLike(box: { width: number; height: number }): { width?: number; height?: number } {
  return box.width === CELL_SIZE_PX && box.height === CELL_SIZE_PX ? {} : { width: box.width, height: box.height }
}

function drawLiftedBeads(context: DrawingContext, beads: readonly PassBead[], weave: Weave, zoom: number, pixelRatio: number, theme: ProjectTheme, letters?: Readonly<Record<string, string>>): void {
  const cornerRadius = beadRoundness(weave.technique, weave.cell) * CELL_SIZE_PX
  for (const bead of beads) {
    const size = bead.turned ? { size: bead.width, width: bead.width, height: bead.height } : { size: CELL_SIZE_PX, ...sizedLike(bead) }
    const radius = bead.turned?.radius ?? cornerRadius
    inPlace(context, bead, () => {
      drawFlatBead(context, { x: bead.x, y: bead.y, ...size, cornerRadius: radius, color: brighten(bead.color, CURRENT_ROW_BRIGHTNESS), dimmed: false, deviceScale: zoom * pixelRatio, theme })
      const letter = letters?.[bead.color]
      if (letter) {
        drawBeadLetter(context, { x: bead.x, y: bead.y, ...size, color: brighten(bead.color, CURRENT_ROW_BRIGHTNESS), letter, dimmed: false, theme })
      }
    })
  }
}

// The Row progress marker (tickets 352, 375, 376): a ring, MARKER_RING_PX thick, round each bead in the current pass,
// inside its cell so it never reaches a neighbour and two rings side by side stay two. No line joins them; one path,
// one stroke.
function drawBeadRings(context: DrawingContext, beads: readonly PassBead[], weave: Weave, theme: ProjectTheme): void {
  const corner = beadRoundness(weave.technique, weave.cell) * CELL_SIZE_PX
  const half = MARKER_RING_PX / 2
  context.strokeStyle = theme.marker
  context.lineWidth = MARKER_RING_PX
  context.beginPath()
  for (const bead of beads.filter(({ turned }) => !turned)) {
    roundedRect(context, bead.x + half, bead.y + half, bead.width - MARKER_RING_PX, bead.height - MARKER_RING_PX, Math.max(0, corner - half))
  }
  context.stroke()
  // A Custom frame's beads each lie at their panel's angle (ticket 0594): a ring apiece, turned with it.
  for (const bead of beads.filter(({ turned }) => turned)) {
    inPlace(context, bead, () => {
      context.beginPath()
      roundedRect(context, bead.x + half, bead.y + half, bead.width - MARKER_RING_PX, bead.height - MARKER_RING_PX, Math.max(0, bead.turned!.radius - half))
      context.stroke()
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
// pasted block in each bead's own colors), or with no color a 2px dark-ink outline. A color fills the bead's own shape,
// less what the next row's beads lie over: a row at a time, so a big block takes one clip a row (ticket 0675).
function drawPreview(context: DrawingContext, weave: Weave, space: Space, cells: readonly PreviewCell[], preview: HoverPreview, theme: ProjectTheme): void {
  const { technique } = weave
  const inset = BEAD_GAP_PX / 2
  const roundness = beadRoundness(technique, weave.cell) * CELL_SIZE_PX - inset
  const boxOf = boxesOf(weave)
  const rows = new Map<number, PreviewRow>()

  for (const cell of cells) {
    if (!inSpace(space, cell.row, cell.column)) {
      continue
    }
    const box = boxOf(cell.row, cell.column)
    const x = box.x + inset
    const y = box.y + inset
    const width = box.width - BEAD_GAP_PX
    const height = box.height - BEAD_GAP_PX
    const color = cell.color ?? preview.color

    if (color) {
      const row: PreviewRow = rows.get(cell.row) ?? { beads: [], first: cell.column, last: cell.column }
      rows.set(cell.row, row)
      row.beads.push({ column: cell.column, bead: { x, y, width, height, radius: Math.max(0, roundness) }, color })
      row.first = Math.min(row.first, cell.column)
      row.last = Math.max(row.last, cell.column)
    } else {
      outlineBead(context, { x, y, width, height, radius: roundness }, theme)
    }
  }
  for (const [row, { beads, first, last }] of rows) {
    fillRowFaintly(context, beads, nextRowBeads(boxOf, space, row, first, last, beads[0]!))
  }
}

/** A row of the hover preview's colored beads, and the first and last columns they reach. */
interface PreviewRow {
  beads: { column: number; bead: BeadRect; color: string }[]
  first: number
  last: number
}

/** One row's beads of the hover preview at its faint opacity, leaving out the next row's beads lying over them: one
 * clip for the row and one path for each color, as the beads of a row never overlap one another. */
function fillRowFaintly(context: DrawingContext, beads: PreviewRow['beads'], coveredBy: readonly BeadRect[]): void {
  if (coveredBy.length === 0) {
    for (const { bead, color } of beads) fillFaintly(context, bead, color)
    return
  }
  const left = Math.min(...beads.map(({ bead }) => bead.x))
  const top = Math.min(...beads.map(({ bead }) => bead.y))
  const right = Math.max(...beads.map(({ bead }) => bead.x + bead.width))
  const bottom = Math.max(...beads.map(({ bead }) => bead.y + bead.height))
  context.globalAlpha = PREVIEW_OPACITY
  context.save()
  context.beginPath()
  // The even-odd clip needs an outer rectangle bigger than the beads; the covering beads are holes in it.
  context.rect(left - CELL_SIZE_PX, top - CELL_SIZE_PX, right - left + 2 * CELL_SIZE_PX, bottom - top + 2 * CELL_SIZE_PX)
  for (const over of coveredBy) {
    roundedRect(context, over.x, over.y, over.width, over.height, over.radius)
  }
  context.clip('evenodd')
  for (const color of new Set(beads.map((entry) => entry.color))) {
    context.fillStyle = color
    context.beginPath()
    for (const { bead } of beads.filter((entry) => entry.color === color)) {
      roundedRect(context, bead.x, bead.y, bead.width, bead.height, bead.radius)
    }
    context.fill()
  }
  context.restore()
  context.globalAlpha = 1
}

/** How small a bead is on the screen, in device px, below which a pasted block's preview is drawn in the draft look
 * (ticket 0675): there its gap and rounding are about a pixel, and the whole block is in view, a fill a bead. */
const DRAFT_PREVIEW_BEAD_PX = 10

/** A pasted block's preview on a layer laid on a grid: as beads, or zoomed out as one draft image at the preview's
 * opacity. */
function drawStampPreview(context: DrawingContext, weave: Weave, space: Space, cells: readonly PastedCell[], preview: HoverPreview, theme: ProjectTheme, deviceScale: number): void {
  if (CELL_SIZE_PX * deviceScale >= DRAFT_PREVIEW_BEAD_PX) {
    drawPreview(context, weave, space, cells, preview, theme)
    return
  }
  context.globalAlpha = PREVIEW_OPACITY
  drawDraftBeads(context, weave, space.open ? cells : cells.filter(({ row, column }) => inSpace(space, row, column)))
  context.globalAlpha = 1
}

/** The hover preview on beads that lie at their panels' angles (ticket 0592): the same look, each bead turned to its
 * angle at the place the Layer geometry gives it. */
function drawTurnedPreview(context: DrawingContext, geometry: LayerGeometry, roundness: number, cells: readonly PreviewCell[], preview: HoverPreview, theme: ProjectTheme): void {
  for (const cell of cells) {
    const place = geometry.place(cell)
    if (!place) {
      continue
    }
    const box = inGridPx(place.box)
    const bead = { x: -box.width / 2 + BEAD_GAP_PX / 2, y: -box.height / 2 + BEAD_GAP_PX / 2, width: box.width - BEAD_GAP_PX, height: box.height - BEAD_GAP_PX, radius: Math.max(0, roundness * box.width - BEAD_GAP_PX / 2) }
    const color = cell.color ?? preview.color
    context.save()
    context.translate(box.x + box.width / 2, box.y + box.height / 2)
    context.rotate(place.angle)
    if (color) {
      fillFaintly(context, bead, color)
    } else {
      outlineBead(context, bead, theme)
    }
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

// The beads of the next row that lie over a row's beads from `first` to `last` as drawn (peyote's rows nest): none where
// rows stack. Each is drawn in as far from its box as `sample`, one of the row's beads, is. One that lies over none of
// the row's beads is a hole where nothing is drawn, so the row is asked about once, not bead by bead.
function nextRowBeads(boxOf: BoxOf, space: Space, row: number, first: number, last: number, sample: { column: number; bead: BeadRect }): BeadRect[] {
  const own = boxOf(row, first)
  const end = boxOf(row, last)
  const { bead } = sample
  const inset = { x: bead.x - boxOf(row, sample.column).x, y: bead.y - boxOf(row, sample.column).y }
  const below = boxOf(row + 1, first)
  if (below.y >= own.y + own.height || below.y + below.height <= own.y) return []
  const beads: BeadRect[] = []
  for (let column = first - 1; column <= last + 1; column++) {
    const next = boxOf(row + 1, column)
    // One the Project does not have is not drawn, so it covers nothing.
    if (next.x < end.x + end.width && next.x + next.width > own.x && inSpace(space, row + 1, column)) {
      beads.push({ ...bead, x: next.x + inset.x, y: next.y + inset.y })
    }
  }
  return beads
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

/** The hover preview's neutral look: a ring in the dark ink, as thick as PREVIEW_OUTLINE_PX, inside the bead's
 * rounded corners. */
function outlineBead(context: DrawingContext, { x, y, width, height, radius }: BeadRect, theme: ProjectTheme): void {
  const inset = PREVIEW_OUTLINE_PX
  context.fillStyle = theme.outline
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
    outlineBead(context, { x, y, width: size, height: size, radius }, theme)
  }
}

/** How thick, in the Project's own px, the Selection's border is, inside the edge of the rectangle. */
const OUTLINE_PX = 2

// The Selection (ticket 414): the rectangle's outer border in the Selection colour, no wash. One rectangle round the
// beads, so on peyote and brick stitch (alternate rows half a bead over) it spans the furthest any row reaches. Handles
// are drawn later in the viewport's px.
function drawSelection(context: DrawingContext, weave: Weave, space: Space, selection: Selection, theme: ProjectTheme, view: () => VisiblePositions, origin: GridPosition): void {
  if (selection.cells) {
    drawShapeOutline(context, weave, selection.cells, view(), origin, theme)
    return
  }
  const bottom = space.open ? selection.top + selection.rows - 1 : Math.min(selection.top + selection.rows - 1, space.rows - 1)
  const right = space.open ? selection.left + selection.columns - 1 : Math.min(selection.left + selection.columns - 1, space.columns - 1)
  const { x, y, width, height } = positionsBoxPx(weave, selection.top, selection.left, bottom - selection.top + 1, right - selection.left + 1)

  context.fillStyle = theme.marker
  context.fillRect(x, y, width, OUTLINE_PX)
  context.fillRect(x, y + height - OUTLINE_PX, width, OUTLINE_PX)
  context.fillRect(x, y, OUTLINE_PX, height)
  context.fillRect(x + width - OUTLINE_PX, y, OUTLINE_PX, height)
}

/** The sides of a bead on a shape's outline, as bits. */
const TOP = 1
const BOTTOM = 2
const LEFT = 4
const RIGHT = 8

/** A shape's outline by row: each bead with a side no other bead of the shape lies across, and which sides. */
type Outline = Map<number, { column: number; sides: number }[]>

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
    const sides = (has(row - 1, column) ? 0 : TOP) | (has(row + 1, column) ? 0 : BOTTOM) | (has(row, column - 1) ? 0 : LEFT) | (has(row, column + 1) ? 0 : RIGHT)
    if (sides === 0) continue
    const beads = outline.get(row) ?? []
    beads.push({ column, sides })
    outline.set(row, beads)
  }
  outlines.set(cells, outline)
  return outline
}

// A shaped Selection (ticket 547): each cell's side that no other cell of the shape lies across is part of the outline,
// so it runs round the outside and round each hole. Only the part in view is drawn (ticket 0675); `origin` is the layer's
// first position on the Canvas, the cells being Canvas positions.
function drawShapeOutline(context: DrawingContext, weave: Weave, cells: readonly GridPosition[], view: VisiblePositions, origin: GridPosition, theme: ProjectTheme): void {
  const boxOf = boxesOf(weave)
  context.fillStyle = theme.marker
  for (const [canvasRow, beads] of outlineOf(cells)) {
    const row = canvasRow - origin.row
    if (row < view.firstRow || row > view.lastRow) continue
    const { first, last } = view.columnsOf(row)
    for (const bead of beads) {
      const column = bead.column - origin.column
      if (column < first || column > last) continue
      const { x, y, width, height } = boxOf(row, column)
      if (bead.sides & TOP) context.fillRect(x, y, width, OUTLINE_PX)
      if (bead.sides & BOTTOM) context.fillRect(x, y + height - OUTLINE_PX, width, OUTLINE_PX)
      if (bead.sides & LEFT) context.fillRect(x, y, OUTLINE_PX, height)
      if (bead.sides & RIGHT) context.fillRect(x + width - OUTLINE_PX, y, OUTLINE_PX, height)
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

/** Strokes the box round the margin's drawn extent on the Canvas (ticket 372): peyote rows nest closer than a bead is
 * tall, and offset techniques add half a bead across, so it is not `rows * CELL_SIZE_PX`. */
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

/** An Axis line (MirrorPopover card, `--mirror-axis-width` and `--mirror-axis-dash`): 1.25px `marker`, dash 5 4, in
 * screen px at any zoom. */
const MIRROR_AXIS_WIDTH_PX = 1.25
const MIRROR_AXIS_DASH_PX = [5, 4]

/** Draws Mirror's Axis lines across a Frame on a grid (spec 0702): N axes cut it into N + 1 equal strips, the lines at
 * the strip boundaries of the box round its beads, in the Frame's own px, so they move with it. Drawn in grid space, so
 * the widths are divided by the zoom to stay screen px. */
function drawMirrorAxes(context: DrawingContext, weave: Weave, frame: Rect, setting: MirrorSetting, zoom: number, theme: ProjectTheme): void {
  if (!isMirrorOn(setting) || !(setting.axes.leftRight || setting.axes.topBottom)) return
  const { x, y, width, height } = gridBox(weave, frame)
  context.save()
  context.strokeStyle = theme.marker
  context.lineWidth = MIRROR_AXIS_WIDTH_PX / zoom
  context.setLineDash(MIRROR_AXIS_DASH_PX.map((length) => length / zoom))
  context.beginPath()
  if (setting.axes.leftRight) {
    for (const offset of axisOffsets(frame.columns, setting.counts.leftRight)) {
      const at = x + (width * offset) / frame.columns
      context.moveTo(at, y)
      context.lineTo(at, y + height)
    }
  }
  if (setting.axes.topBottom) {
    for (const offset of axisOffsets(frame.rows, setting.counts.topBottom)) {
      const at = y + (height * offset) / frame.rows
      context.moveTo(x, at)
      context.lineTo(x + width, at)
    }
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
  const { project, region, zoom, pixelRatio = 1, theme = DEFAULT_THEME, space = spaceOf(project, false), preview, selection, rulers, frameEditing, selectionHandles, marginOutline = 0, margin = MARGIN, pointer, rowMarks, letters, mirror } = input

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

  // From the bottom up, in the order the DOM grid stacked them: a bead faded, the Selection on it, the hover preview
  // over that, and the marker lifted above its row.
  if (space.open) {
    if (canvasSelection) drawSelection(context, canvasWeaveOf, space, canvasSelection, theme, canvasView, { row: 0, column: 0 })
    if (preview && canvasCells.length) drawPreview(context, canvasWeaveOf, space, canvasCells, preview, theme)
    if (preview && canvasStamp.length) drawStampPreview(context, canvasWeaveOf, space, canvasStamp, preview, theme, zoom * pixelRatio)
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
    if (showRows) {
      drawLiftedBeads(context, inPass, sheetWeave, zoom * scale, pixelRatio, theme, letters)
    }
    if (sheetSelection) drawSelection(context, sheetWeave, sheetSpace, sheetSelection, theme, sheetView, layerOrigin)
    // A Frame on a grid (a Custom frame's Axes are ticket 0706's), in its own positions from its first.
    if (mirror && frameOf(project) && geometry!.grid) drawMirrorAxes(context, sheetWeave, { row: 0, column: 0, rows: frameOf(project)!.rows, columns: frameOf(project)!.columns }, mirror, zoom * scale, theme)
    const sheetCells = preview ? onSheet(preview.cells) : []
    const sheetStamp = preview?.stamp ? onSheetStamp(preview.stamp) : []
    if (preview && sheetCells.length + sheetStamp.length > 0) {
      if (!geometry!.grid) drawTurnedPreview(context, geometry!, beadRoundness(sheetWeave.technique, sheetWeave.cell), [...sheetCells, ...sheetStamp], preview, theme)
      else {
        if (sheetCells.length) drawPreview(context, sheetWeave, sheetSpace, sheetCells, preview, theme)
        if (sheetStamp.length) drawStampPreview(context, sheetWeave, sheetSpace, sheetStamp, preview, theme, zoom * scale * pixelRatio)
      }
    }
    if (inPass.length > 0) {
      drawBeadRings(context, inPass, sheetWeave, theme)
    }
    context.restore()
  }

  // The rulers are laid out in the viewport's own px, over everything the grid-space drawing above made.
  if (ruled && rulers) {
    drawRulers(context, {
      project,
      surface: rulers.surface,
      layout: rulers.layout,
      pixelRatio,
      theme,
      rowMarks: showRows,
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
      // A size is a number too: the Rulers toggle hides it with the rest.
      tooltip: rulers.layout.numbers ? frameEditing.tooltip : '',
    })
  }
  if (selection && selectionHandles && space.open && selectionHasHandles(selection)) {
    drawBoxHandles(context, selectionHandles.surface.beadBox(selectionFrame(selection), ownLayer), pixelRatio, theme, selectionHandles.touch)
  }
  if (pointer) {
    const pointerWeave = pointer.layer === 'frame' ? frameWeave(project) : canvasWeaveOf
    // On the Canvas, a Frame's bead is its Bead's size (ticket 0665).
    const scaled = pointer.layer === 'frame' && space.open ? frameScale(project) : 1
    drawPointer(context, pointerWeave.technique, pointerWeave.cell, zoom * scaled, pixelRatio, pointer, theme)
  }
}
