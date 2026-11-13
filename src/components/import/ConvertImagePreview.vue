<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watchPostEffect } from 'vue'
import { useConvertImageWizardState, type ConvertTool } from '../../composables/import/useConvertImageWizard'
import { controlAction } from '../../composables/shell/controlRegistry'
import { useActionKeys } from '../../composables/shell/useActionKeys'
import { useElementSize } from '../../composables/ui/useElementSize'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { clamp } from '../../domain/clamp'
import { foundRuns } from '../../domain/convertBackground'
import { keptDrawn, keptMoved, type KeptPart } from '../../domain/convertKeep'
import { CROP_HANDLES, partDrawn, partMoved, partShifted, type CropHandle, type PixelCrop } from '../../domain/convertSize'
import { fillBlanks } from '../../domain/fillBlanks'
import { beadCell, beadRoundness } from '../../domain/weave'
import { plural } from '../../i18n/plural'
import { useI18n } from '../../i18n/useI18n'
import { BEAD_GAP_PX, LIGHT_THEME } from '../../rendering/beadLook'
import { drawCleanedRings } from '../../rendering/cleanedRings'
import type { HandleId } from '../../rendering/frameHandles'
import { reachLimit } from '../../rendering/handleSizes'
import { renderDraft, usesDraftLook } from '../../rendering/draftRenderer'
import { renderProject } from '../../rendering/projectRenderer'
import { spaceOf } from '../../rendering/space'
import { surfaceView } from '../../rendering/surfaceView'
import { EYEDROPPER_CURSOR } from '../canvas/eyedropperCursor'
import AppButton from '../ui/AppButton.vue'
import AppHandle from '../ui/AppHandle.vue'
import IconButton from '../ui/IconButton.vue'
import ConvertDropZone from './ConvertDropZone.vue'

// Convert image's preview (ConvertImage card DS-1, tickets 0747, 0780, 0787, 0896): the beads with what was found hatched,
// a chip while a tool or Compare shows something, and the floating bar: Background (popover and tool in one press), Make
// empty and Compare, a zoom chip joining it only while zoomed in past Fit. With no picture yet, the drop zone.
const emit = defineEmits<{ paste: [] }>()

const { t, locale } = useI18n()
const wizard = useConvertImageWizardState()
const words = computed(() => t.value.convertImage.wizard)
const actions = {
  zoomOut: controlAction('zoom-out'),
  zoomIn: controlAction('zoom-in'),
  zoomFit: controlAction('zoom-fit'),
  makeEmpty: controlAction('make-empty'),
  background: controlAction('convert-background'),
  compare: controlAction('convert-compare'),
}
const cropName = (handle: CropHandle) => controlAction(`crop-${handle}`).name(t.value)

const paneEl = ref<HTMLElement>()
const viewportEl = ref<HTMLElement>()
const { width: viewportWidth, height: viewportHeight } = useElementSize(viewportEl)

/** Room kept round the beads at Fit, in px (ConvertImage card DS-1): 72 above, 40 at the sides and 90 below (96 on a
 * coarse pointer), so the floating bar never covers them; read from the design's values, these where none is loaded. */
const coarse = useMediaQuery('(pointer: coarse)')
const ROOM = computed(() => {
  const style = paneEl.value && typeof getComputedStyle === 'function' ? getComputedStyle(paneEl.value) : undefined
  const px = (name: string, fallback: number) => {
    const read = Number.parseFloat(style?.getPropertyValue(name) ?? '')
    return Number.isFinite(read) ? read : fallback
  }
  return {
    top: px('--convert-fit-top', 72),
    side: px('--convert-fit-side', 40),
    bottom: coarse.value ? px('--convert-fit-bottom-touch', 96) : px('--convert-fit-bottom', 90),
  }
})
/** The view's own zoom steps, a multiple of the fit. */
const VIEW_ZOOMS = [1, 1.5, 2, 3, 4, 6, 8]
const viewZoom = ref(1)

const project = computed(() => wizard.drawnProject.value)
const lattice = computed(() => wizard.lattice.value)
const grid = computed(() => wizard.previewGrid.value)
const cell = computed(() => beadCell(wizard.bead.value, wizard.technique.value))
const space = computed(() => project.value && spaceOf(project.value, false))

/** The scale at which the whole lattice fits the pane: only the drawing scales. */
const fitScale = computed(() => {
  const extent = space.value?.extent
  if (!extent || extent.width === 0 || extent.height === 0) return 1
  const width = Math.max(1, viewportWidth.value - ROOM.value.side * 2)
  const height = Math.max(1, viewportHeight.value - ROOM.value.top - ROOM.value.bottom)
  return Math.min(width / extent.width, height / extent.height)
})
const scale = computed(() => fitScale.value * viewZoom.value)

const view = computed(() =>
  space.value
    ? surfaceView({ space: space.value, technique: wizard.technique.value, techniqueSettings: wizard.techniqueSettings.value, cell: cell.value, rotation: 0, zoom: scale.value })
    : undefined,
)

const displayed = computed(() => {
  const extent = space.value?.extent ?? { width: 0, height: 0 }
  return { width: extent.width * scale.value, height: extent.height * scale.value }
})
const boxStyle = computed(() => ({ width: `${displayed.value.width}px`, height: `${displayed.value.height}px` }))
const stageStyle = computed(() => ({
  width: `${Math.max(viewportWidth.value, displayed.value.width + ROOM.value.side * 2)}px`,
  height: `${Math.max(viewportHeight.value, displayed.value.height + ROOM.value.top + ROOM.value.bottom)}px`,
  padding: `${ROOM.value.top}px ${ROOM.value.side}px ${ROOM.value.bottom}px`,
}))

/** The Frame's beads in the box, in px: the line goes round them and everything else is dimmed. */
const frameBox = computed(() => {
  const at = lattice.value
  const size = grid.value
  if (!view.value || !at || !size) return undefined
  return view.value.beadBox({ row: at.frameRow, column: at.frameColumn, rows: size.rows, columns: size.columns })
})
const boxPlace = (box: { x: number; y: number; width: number; height: number }) => ({ left: `${box.x}px`, top: `${box.y}px`, width: `${box.width}px`, height: `${box.height}px` })
const frameStyle = computed(() => (frameBox.value ? boxPlace(frameBox.value) : undefined))

/** The kept part of the beads (Whole picture with Select), drawn as the editor draws a Selection. */
const keptStyle = computed(() => {
  const part = wizard.kept.value
  const at = lattice.value
  if (!part || !at || !view.value) return undefined
  return boxPlace(view.value.beadBox({ row: at.frameRow + part.row, column: at.frameColumn + part.column, rows: part.rows, columns: part.columns }))
})

const colorsText = computed(() => plural(locale.value, wizard.usedColorCount.value, words.value.colorsCount))
const previewName = computed(() => {
  const size = grid.value
  return wizard.hasPicture.value && size
    ? fillBlanks(words.value.previewName, { size: fillBlanks(words.value.resultGrid, { columns: size.columns, rows: size.rows }), colors: colorsText.value })
    : words.value.previewEmpty
})

// --- Drawing ----------------------------------------------------------------------------------------------------------

/** The largest bitmap side the preview draws, so a zoomed view stays within what a canvas holds. */
const MAX_BITMAP_PX = 8192
const canvasEl = ref<HTMLCanvasElement>()

watchPostEffect(() => {
  const canvas = canvasEl.value
  const drawn = project.value
  const at = space.value
  const context = canvas?.getContext('2d')
  if (!canvas || !drawn || !at || !context || !lattice.value) return
  const { width, height } = displayed.value
  const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_BITMAP_PX / Math.max(1, width, height))
  const bitmapWidth = Math.max(1, Math.round(width * pixelRatio))
  const bitmapHeight = Math.max(1, Math.round(height * pixelRatio))
  if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
    canvas.width = bitmapWidth
    canvas.height = bitmapHeight
  }
  // While a handle moves the part, a block too big to draw bead by bead is drawn coarsely (draftRenderer).
  const { columns, rows } = lattice.value
  if (wizard.approximate.value && usesDraftLook(wizard.technique.value, columns * rows)) {
    renderDraft(context, {
      technique: wizard.technique.value,
      techniqueSettings: wizard.techniqueSettings.value,
      columns,
      rows,
      colors: wizard.beadColors.value,
      theme: LIGHT_THEME,
      bitmapWidth,
      bitmapHeight,
    })
    if (wizard.background.value === 'find') drawFound(context, pixelRatio)
    return
  }
  if (wizard.comparing.value) return drawOriginal(context, pixelRatio)
  // The board look in light whatever the app's theme (ticket 150), as the Project will print.
  renderProject(context, { project: drawn, space: at, region: { x: 0, y: 0, width, height }, zoom: scale.value, pixelRatio, theme: LIGHT_THEME, rowMarks: false })
  if (wizard.background.value === 'find') drawFound(context, pixelRatio)
  if (wizard.popover.value === 'clean-up') drawRings(context, pixelRatio)
})

/** Clean up's popover open (ticket 0906): every bead it changed ringed in `marker`, a bead's step apart read off the view. */
function drawRings(context: CanvasRenderingContext2D, pixelRatio: number) {
  const changed = wizard.cleanUp.changedBeads.value
  const at = lattice.value
  const size = grid.value
  const shown = view.value
  if (!changed || !at || !size || !shown || !paneEl.value) return
  const centre = (row: number, column: number) => shown.beadToPoint({ row: at.frameRow + row, column: at.frameColumn + column })
  const gap = BEAD_GAP_PX * scale.value
  const step = { width: Math.abs(centre(0, 1).x - centre(0, 0).x), height: Math.abs(centre(1, 0).y - centre(0, 0).y) }
  const style = getComputedStyle(paneEl.value)
  // The ring is as thick as it stands off the bead (DS-3: 2px, 2 outside).
  const ring = parseFloat(style.getPropertyValue('--convert-cleaned-ring'))
  drawCleanedRings(context, {
    changed,
    columns: size.columns,
    centre: ({ row, column }) => centre(row, column),
    bead: { width: step.width - gap, height: step.height - gap, roundness: beadRoundness(wizard.technique.value, cell.value) },
    ring,
    gap: ring,
    color: style.getPropertyValue('--marker').trim(),
    pixelRatio,
  })
}

/** The picture's own pixels as a canvas, made once per picture: what Compare shows in the beads' place. */
const original = computed(() => {
  const image = wizard.image.value
  if (!image || typeof document === 'undefined' || typeof ImageData === 'undefined') return undefined
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  canvas.getContext('2d')?.putImageData(new ImageData(Uint8ClampedArray.from(image.data), image.width, image.height), 0, 0)
  return canvas
})

/** Compare (ConvertImage card): the original picture, smoothed, laid so the part woven covers the Frame's beads. */
function drawOriginal(context: CanvasRenderingContext2D, pixelRatio: number) {
  const picture = original.value
  const frame = frameBox.value
  const part = wizard.part.value
  context.clearRect(0, 0, context.canvas.width, context.canvas.height)
  if (!picture || !frame) return
  const scaleX = frame.width / part.width
  const scaleY = frame.height / part.height
  context.imageSmoothingEnabled = true
  context.drawImage(
    picture,
    (frame.x - part.x * scaleX) * pixelRatio,
    (frame.y - part.y * scaleY) * pixelRatio,
    picture.width * scaleX * pixelRatio,
    picture.height * scaleY * pixelRatio,
  )
}

/** Background found (1 Find): every bead it takes hatched over its own color with `--found-hatch`'s lines. */
function drawFound(context: CanvasRenderingContext2D, pixelRatio: number) {
  const found = wizard.backgroundFound.value?.found
  const at = lattice.value
  const size = grid.value
  if (!found || !at || !size || !view.value || !paneEl.value) return
  // The Project renderer leaves its grid transform on the context (ticket 0787): the boxes are in CSS px, so draw plain.
  context.setTransform(1, 0, 0, 1, 0, 0)
  // The canvas draws `--found-hatch` from its parts, so the preview and the step's swatch are one look.
  const style = getComputedStyle(paneEl.value)
  const value = (name: string) => style.getPropertyValue(name).trim()
  const step = parseFloat(value('--found-hatch-step')) * pixelRatio
  const tile = document.createElement('canvas')
  tile.width = step
  tile.height = step
  const pen = tile.getContext('2d')
  if (!pen || !step) return
  pen.fillStyle = value('--found-hatch-wash')
  pen.fillRect(0, 0, tile.width, tile.height)
  pen.strokeStyle = value('--found-hatch-ink')
  pen.lineWidth = parseFloat(value('--found-hatch-line')) * pixelRatio
  pen.beginPath()
  for (const shift of [-tile.width, 0, tile.width]) {
    pen.moveTo(shift, tile.height)
    pen.lineTo(shift + tile.width, 0)
  }
  pen.stroke()
  const hatch = context.createPattern(tile, 'repeat')
  if (!hatch) return
  // The found beads' runs as one path, filled once (ticket 0785): a fill per bead stalls Safari for seconds.
  const path = new Path2D()
  for (const run of foundRuns({ found, ...size })) {
    const box = view.value.beadBox({ row: at.frameRow + run.row, column: at.frameColumn + run.column, rows: 1, columns: run.columns })
    path.rect(box.x * pixelRatio, box.y * pixelRatio, box.width * pixelRatio, box.height * pixelRatio)
  }
  // Faded first (ticket 0787), then hatched: the background reads as gone whatever the bead's color.
  context.fillStyle = value('--found-dim')
  context.fill(path)
  context.fillStyle = hatch
  context.fill(path)
}

// --- Drawing, moving and pulling the part ------------------------------------------------------------------------------

/** Each crop handle as the shared handle's corner or edge (Handle card, ticket 0867). */
const HANDLE_PLACES: Record<CropHandle, HandleId> = {
  topLeft: 'top-left',
  top: 'top',
  topRight: 'top-right',
  right: 'right',
  bottomRight: 'bottom-right',
  bottom: 'bottom',
  bottomLeft: 'bottom-left',
  left: 'left',
}

/** A handle's reach on the part as it is on screen (Handle card). */
const handleLimit = computed(() => (frameBox.value ? reachLimit(frameBox.value) : undefined))

function handleStyle(handle: CropHandle) {
  const box = frameBox.value
  if (!box) return undefined
  const x = handle.toLowerCase().includes('left') ? box.x : handle.toLowerCase().includes('right') ? box.x + box.width : box.x + box.width / 2
  const y = handle.startsWith('top') ? box.y : handle.startsWith('bottom') ? box.y + box.height : box.y + box.height / 2
  return { left: `${x}px`, top: `${y}px` }
}

/** The part with a handle's edges moved by picture pixels, through the domain's rule (never under 8 px a side). */
function movePart(from: PixelCrop, handle: CropHandle, dx: number, dy: number) {
  const image = wizard.image.value
  if (image) wizard.setPart(partMoved(from, handle, dx, dy, image))
}

/** How far the pointer goes before a press outside the part draws a new one, so a plain tap draws nothing. */
const DRAW_AFTER_PX = 3

/** What a gesture on the part does (ConvertImage card): a handle pulls an edge or corner, a press inside moves the
 * part, a drag outside draws a new one from the pixel it began on. */
type Gesture = { kind: 'handle'; handle: CropHandle } | { kind: 'move' } | { kind: 'draw'; anchor: { x: number; y: number } }

/** `per` is the picture pixels a screen pixel covers, taken when the drag began: the picture holds still on screen
 * whatever the part is, so the pointer keeps its place on it. */
type Drag = { pointerId: number; x: number; y: number; part: PixelCrop; per: { x: number; y: number } } & Gesture
const drag = ref<Drag | null>(null)

function onDragMove(event: PointerEvent) {
  const started = drag.value
  const image = wizard.image.value
  if (!started || !image || event.pointerId !== started.pointerId) return
  const moved = { x: event.clientX - started.x, y: event.clientY - started.y }
  const dx = moved.x * started.per.x
  const dy = moved.y * started.per.y
  if (started.kind === 'handle') movePart(started.part, started.handle, dx, dy)
  else if (started.kind === 'move') wizard.setPart(partShifted(started.part, dx, dy, image))
  else if (Math.hypot(moved.x, moved.y) >= DRAW_AFTER_PX) wizard.setPart(partDrawn(started.anchor, { x: started.anchor.x + dx, y: started.anchor.y + dy }, image))
}

function endDrag(event?: PointerEvent) {
  if (event && drag.value && event.pointerId !== drag.value.pointerId) return
  drag.value = null
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', endDrag)
  window.removeEventListener('pointercancel', endDrag)
  if (wizard.moving.value) wizard.endMove()
}

/** The picture pixels one screen pixel covers over the Frame's box. */
function pixelsPerScreenPixel(part: PixelCrop) {
  const frame = frameBox.value
  return frame && frame.width > 0 && frame.height > 0 ? { x: part.width / frame.width, y: part.height / frame.height } : { x: 1, y: 1 }
}

function beginDrag(event: PointerEvent, gesture: Gesture, part: PixelCrop) {
  event.preventDefault()
  event.stopPropagation()
  ;(event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId)
  drag.value = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, part, per: pixelsPerScreenPixel(part), ...gesture }
  wizard.beginMove()
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', endDrag)
  window.addEventListener('pointercancel', endDrag)
}

function startDrag(event: PointerEvent, handle: CropHandle) {
  if (drag.value) return endDrag()
  if (event.pointerType === 'mouse' && event.button !== 0) return
  beginDrag(event, { kind: 'handle', handle }, { ...wizard.part.value })
}

/** A press on the beads while weave is A part: inside the part it moves it, outside a drag draws a new one. */
function startPartDrag(event: PointerEvent) {
  const frame = frameBox.value
  const box = (event.currentTarget as HTMLElement | null)?.getBoundingClientRect()
  if (!frame || !box || drag.value) return
  if (event.pointerType === 'mouse' && event.button !== 0) return
  const part = { ...wizard.part.value }
  const at = { x: event.clientX - box.left, y: event.clientY - box.top }
  const inside = at.x >= frame.x && at.x <= frame.x + frame.width && at.y >= frame.y && at.y <= frame.y + frame.height
  if (inside) return beginDrag(event, { kind: 'move' }, part)
  const per = pixelsPerScreenPixel(part)
  beginDrag(event, { kind: 'draw', anchor: { x: part.x + (at.x - frame.x) * per.x, y: part.y + (at.y - frame.y) * per.y } }, part)
}

// --- Keeping a part of the beads (Whole picture with Select) ----------------------------------------------------------

/** A drag on the beads with Select and Whole picture: inside the kept part it moves it, outside it draws a new one from
 * the bead it began on; a plain tap draws nothing. Snapped to whole beads, on whole cycles of the stagger. */
type KeepDrag = { pointerId: number; x: number; y: number; from: { row: number; column: number }; moves?: KeptPart; drawn: boolean }
let keepDrag: KeepDrag | undefined
const boxEl = ref<HTMLElement>()

/** The Frame's bead under a point on screen, held to the Frame. */
function frameBeadAt(clientX: number, clientY: number) {
  const box = boxEl.value?.getBoundingClientRect()
  const at = lattice.value
  if (!box || !view.value || !at) return undefined
  const { row, column } = view.value.pointToCell({ x: clientX - box.left, y: clientY - box.top })
  return { row: row - at.frameRow, column: column - at.frameColumn }
}

function onKeepMove(event: PointerEvent) {
  const started = keepDrag
  const size = grid.value
  if (!started || event.pointerId !== started.pointerId || !size) return
  const now = frameBeadAt(event.clientX, event.clientY)
  if (!now) return
  if (started.moves) {
    wizard.setKept(keptMoved(started.moves, now.column - started.from.column, now.row - started.from.row, size, wizard.cycles.value))
  } else if (started.drawn || Math.hypot(event.clientX - started.x, event.clientY - started.y) >= DRAW_AFTER_PX) {
    started.drawn = true
    wizard.setKept(keptDrawn(started.from, now, size, wizard.cycles.value))
  }
}

function endKeep(event?: PointerEvent) {
  if (event && keepDrag && event.pointerId !== keepDrag.pointerId) return
  keepDrag = undefined
  window.removeEventListener('pointermove', onKeepMove)
  window.removeEventListener('pointerup', endKeep)
  window.removeEventListener('pointercancel', endKeep)
}

function startKeep(event: PointerEvent) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  const from = frameBeadAt(event.clientX, event.clientY)
  const size = grid.value
  if (!from || !size || from.row < 0 || from.column < 0 || from.row >= size.rows || from.column >= size.columns) return
  event.preventDefault()
  const part = wizard.kept.value
  const inside = part && from.row >= part.row && from.row < part.row + part.rows && from.column >= part.column && from.column < part.column + part.columns
  keepDrag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, from, moves: inside ? { ...part } : undefined, drawn: false }
  window.addEventListener('pointermove', onKeepMove)
  window.addEventListener('pointerup', endKeep)
  window.addEventListener('pointercancel', endKeep)
}

/** A press on the beads: Make empty's tap, the Background tool's mark, or Select's drag (the crop with A part of the
 * picture, a kept part with Whole picture). Select has no button since ticket 0896: the crop on the picture takes its
 * place (ticket 0898). With no tool on a press does nothing; the crop's handles still pull. */
function onBoxDown(event: PointerEvent) {
  if (pinch.value) return
  if (tool.value === 'make-empty') {
    event.preventDefault()
    emptyAt(event)
  } else if (tool.value === 'background') {
    startMark(event)
  } else if (tool.value === 'select') {
    if (wizard.weave.value === 'part') startPartDrag(event)
    else startKeep(event)
  }
}

/** A focused handle moves one pixel per arrow, ten with Shift (ConvertImage card). */
function onHandleKey(event: KeyboardEvent, handle: CropHandle) {
  const by = event.shiftKey ? 10 : 1
  const dx = event.key === 'ArrowLeft' ? -by : event.key === 'ArrowRight' ? by : 0
  const dy = event.key === 'ArrowUp' ? -by : event.key === 'ArrowDown' ? by : 0
  if (dx === 0 && dy === 0) return
  event.preventDefault()
  movePart(wizard.part.value, handle, dx, dy)
}

// --- The view's zoom: buttons, Ctrl or ⌘ + wheel, and a pinch --------------------------------------------------------

function zoomTo(next: number) {
  viewZoom.value = clamp(next, VIEW_ZOOMS[0]!, VIEW_ZOOMS.at(-1)!)
}
const zoomIn = () => zoomTo(VIEW_ZOOMS.find((level) => level > viewZoom.value + 1e-6) ?? viewZoom.value)
const zoomOut = () => zoomTo([...VIEW_ZOOMS].reverse().find((level) => level < viewZoom.value - 1e-6) ?? viewZoom.value)
function fit() {
  viewZoom.value = 1
  viewportEl.value?.scrollTo?.({ left: 0, top: 0 })
}
const zoomLevel = computed(() => fillBlanks(words.value.zoomLevel, { percent: Math.round(viewZoom.value * 100) }))
/** The zoom chip joins the bar only while zoomed in past Fit (DS-1): at rest zoom is pinch, wheel and the keys. */
const zoomed = computed(() => viewZoom.value > VIEW_ZOOMS[0]! + 1e-6)
useActionKeys({ 'zoom-in': zoomIn, 'zoom-out': zoomOut, 'zoom-fit': fit }, () => wizard.hasPicture.value)

function onWheel(event: WheelEvent) {
  if (!event.ctrlKey && !event.metaKey) return
  event.preventDefault()
  zoomTo(viewZoom.value * (event.deltaY < 0 ? 1.1 : 1 / 1.1))
}

const touches = new Map<number, { x: number; y: number }>()
const pinch = ref<{ distance: number; zoom: number } | null>(null)
const distance = () => {
  const [a, b] = [...touches.values()]
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
}
function onViewportDown(event: PointerEvent) {
  if (event.pointerType !== 'touch') return
  touches.set(event.pointerId, { x: event.clientX, y: event.clientY })
  if (touches.size === 2) {
    endDrag()
    pinch.value = { distance: distance(), zoom: viewZoom.value }
  }
}
function onViewportMove(event: PointerEvent) {
  if (!touches.has(event.pointerId)) return
  touches.set(event.pointerId, { x: event.clientX, y: event.clientY })
  if (pinch.value && pinch.value.distance > 0) zoomTo(pinch.value.zoom * (distance() / pinch.value.distance))
}
function onViewportUp(event: PointerEvent) {
  touches.delete(event.pointerId)
  if (touches.size < 2) pinch.value = null
}

// --- The tools and Compare --------------------------------------------------------------------------------------------

const tool = wizard.tool
const eyedropper = computed(() => tool.value === 'make-empty')
/** The tools that ring the bead under the pointer: Make empty and Background (ticket 0787). */
const ringed = computed(() => tool.value === 'make-empty' || tool.value === 'background')
const hovered = ref<number>()
// Escape turns a tool off first; a press elsewhere (a step's control) goes through and leaves it as it is.
useOverlayLayer({ isOpen: () => tool.value !== undefined, root: () => paneEl.value, close: () => wizard.setTool(undefined), keepsPress: () => true })

const pickTool = (next: ConvertTool) => wizard.setTool(next)

/** Compare is held (ConvertImage card): by a pointer until it lets go, or by Space or Enter until the key is up. */
function compareOn(event?: KeyboardEvent) {
  if (event) {
    if ((event.key !== ' ' && event.key !== 'Enter') || event.repeat) return
    event.preventDefault()
  }
  wizard.comparing.value = true
}
function compareOff(event?: KeyboardEvent) {
  if (event && event.key !== ' ' && event.key !== 'Enter') return
  wizard.comparing.value = false
}

/** The lattice bead under a point on screen, none off the beads. */
function beadIndexAt(clientX: number, clientY: number): number | undefined {
  const box = boxEl.value?.getBoundingClientRect()
  const at = lattice.value
  if (!box || !view.value || !at) return undefined
  const { row, column } = view.value.pointToCell({ x: clientX - box.left, y: clientY - box.top })
  return row >= 0 && row < at.rows && column >= 0 && column < at.columns ? row * at.columns + column : undefined
}

function emptyAt(event: PointerEvent) {
  const index = beadIndexAt(event.clientX, event.clientY)
  if (index !== undefined) wizard.toggleEmptyAtBead(index)
}

function onBoxHover(event: PointerEvent) {
  hovered.value = ringed.value ? beadIndexAt(event.clientX, event.clientY) : undefined
}

// --- The Background tool's tap and drag (ticket 0787) -----------------------------------------------------------------

/** A press begins a step on the bead under it, the drag extends it bead by bead, and letting go ends it. */
let markPointer: number | undefined
function onMarkMove(event: PointerEvent) {
  if (event.pointerId !== markPointer) return
  const index = beadIndexAt(event.clientX, event.clientY)
  if (index !== undefined) wizard.extendMark(index)
}
function endMark(event?: PointerEvent) {
  if (markPointer === undefined || (event && event.pointerId !== markPointer)) return
  markPointer = undefined
  wizard.endMark()
  window.removeEventListener('pointermove', onMarkMove)
  window.removeEventListener('pointerup', endMark)
  window.removeEventListener('pointercancel', endMark)
}
function startMark(event: PointerEvent) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  const index = beadIndexAt(event.clientX, event.clientY)
  if (index === undefined || markPointer !== undefined) return
  event.preventDefault()
  markPointer = event.pointerId
  wizard.beginMark(index)
  window.addEventListener('pointermove', onMarkMove)
  window.addEventListener('pointerup', endMark)
  window.addEventListener('pointercancel', endMark)
}

const ringStyle = computed(() => {
  const at = lattice.value
  const index = hovered.value
  if (!ringed.value || index === undefined || !at || !view.value) return undefined
  const box = view.value.beadBox({ row: Math.floor(index / at.columns), column: index % at.columns, rows: 1, columns: 1 })
  return { left: `${box.x}px`, top: `${box.y}px`, width: `${box.width}px`, height: `${box.height}px` }
})

/** What the preview shows now, as a chip over it (DS-1): Make empty's tap, or the original picture while Compare is held. */
const chip = computed(() => (wizard.comparing.value ? words.value.bandCompare : tool.value === 'make-empty' ? words.value.bandMakeEmpty : undefined))

onBeforeUnmount(() => {
  endDrag()
  endKeep()
  endMark()
  wizard.comparing.value = false
})
</script>

<template>
  <div ref="paneEl" class="convert-preview" :class="{ 'convert-preview--eyedropper': eyedropper, 'convert-preview--select': tool === 'select', 'convert-preview--background': tool === 'background', 'convert-preview--part': wizard.weave.value === 'part' }" data-testid="convert-preview">
    <ConvertDropZone v-if="!wizard.hasPicture.value" @paste="emit('paste')" />

    <div v-else class="convert-preview__room">
      <div
        ref="viewportEl"
        class="convert-preview__viewport"
        @wheel="onWheel"
        @pointerdown.capture="onViewportDown"
        @pointermove="onViewportMove"
        @pointerup="onViewportUp"
        @pointercancel="onViewportUp"
      >
        <div class="convert-preview__stage" :style="stageStyle">
          <div ref="boxEl" class="convert-preview__box" :style="eyedropper ? { ...boxStyle, cursor: EYEDROPPER_CURSOR } : boxStyle" data-testid="convert-image-box" @pointerdown="onBoxDown" @pointermove="onBoxHover" @pointerleave="hovered = undefined">
            <!-- The beads, the Frame's dimming and a kept part's are clipped to the box; the handles may stand past it. -->
            <div class="convert-preview__clip">
              <canvas
                ref="canvasEl"
                class="convert-preview__canvas"
                role="img"
                :aria-label="previewName"
                :style="boxStyle"
                :data-columns="lattice?.columns"
                :data-rows="lattice?.rows"
                :data-comparing="wizard.comparing.value || undefined"
                data-testid="convert-image-canvas"
              />
              <div v-if="frameStyle && wizard.weave.value === 'part'" class="convert-preview__frame" :style="frameStyle" data-testid="convert-image-frame-outline" />
              <div v-if="keptStyle && !wizard.comparing.value" class="convert-preview__kept" :style="keptStyle" data-testid="convert-kept" />
            </div>
            <template v-if="wizard.weave.value === 'part' && !ringed && !wizard.comparing.value">
              <AppHandle
                v-for="handle in CROP_HANDLES"
                :key="handle"
                :place="HANDLE_PLACES[handle]"
                :hot="drag?.kind === 'handle' && drag.handle === handle"
                :limit="handleLimit"
                class="convert-preview__handle"
                :class="{ 'convert-preview__handle--corner': HANDLE_PLACES[handle].includes('-') }"
                :style="handleStyle(handle)"
                :aria-label="cropName(handle)"
                :data-testid="`convert-crop-${handle}`"
                @pointerdown="startDrag($event, handle)"
                @keydown="onHandleKey($event, handle)"
              />
            </template>
            <span v-if="ringStyle" class="convert-preview__ring" :style="ringStyle" aria-hidden="true" />
          </div>
        </div>
      </div>

      <span v-if="chip" class="convert-preview__chip" data-testid="convert-chip">{{ chip }}</span>

      <div class="convert-preview__tools" data-testid="convert-preview-tools">
        <AppButton
          variant="text"
          :action="actions.background"
          :selected="wizard.popover.value === 'background'"
          aria-haspopup="dialog"
          :aria-expanded="wizard.popover.value === 'background'"
          data-testid="convert-tool-background"
          @click="wizard.togglePopover('background')"
        />
        <AppButton variant="text" :action="actions.makeEmpty" :selected="tool === 'make-empty'" data-testid="convert-tool-make-empty" @click="pickTool('make-empty')" />
        <span class="convert-preview__divider" aria-hidden="true" />
        <AppButton
          variant="text"
          :action="actions.compare"
          :selected="wizard.comparing.value"
          data-testid="convert-compare"
          @pointerdown="compareOn()"
          @pointerup="compareOff()"
          @pointercancel="compareOff()"
          @pointerleave="compareOff()"
          @keydown="compareOn($event)"
          @keyup="compareOff($event)"
          @blur="compareOff()"
        />
        <template v-if="zoomed">
          <span class="convert-preview__divider" aria-hidden="true" />
          <span class="convert-preview__zoom" data-testid="convert-zoom-chip">
            <IconButton variant="plain" :icon-size="16" :action="actions.zoomOut" data-testid="convert-zoom-out" @click="zoomOut" />
            <span class="convert-preview__level" data-testid="convert-zoom-level">{{ zoomLevel }}</span>
            <IconButton
              variant="plain"
              :icon-size="16"
              :action="actions.zoomIn"
              :disabled="viewZoom >= VIEW_ZOOMS.at(-1)!"
              :disabled-body="t.tooltips.zoomInLimit"
              data-testid="convert-zoom-in"
              @click="zoomIn"
            />
            <IconButton variant="plain" :icon-size="16" :action="actions.zoomFit" data-testid="convert-zoom-fit" @click="fit" />
          </span>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.convert-preview {
  position: relative;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--box);
}

.convert-preview__room {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.convert-preview__viewport {
  flex: 1;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}

.convert-preview__stage {
  display: grid;
  box-sizing: border-box;
  place-items: center;
}

.convert-preview__box {
  position: relative;
}

.convert-preview__clip {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: var(--radius-sm);
}

.convert-preview--select .convert-preview__box,
.convert-preview--background .convert-preview__box {
  cursor: crosshair;
}

/* Select and Background draw by a drag, so a touch on the beads does not scroll the view. */
.convert-preview--select .convert-preview__box,
.convert-preview--background .convert-preview__box {
  touch-action: none;
}

.convert-preview__canvas {
  display: block;
}

/* The Frame: an ink line with a canvas halo, so it reads over any picture; its outward shadow dims everything else. */
.convert-preview__frame {
  position: absolute;
  pointer-events: none;
  outline: 1.5px solid var(--ink);
  box-shadow:
    0 0 0 3px var(--canvas),
    0 0 0 9999px var(--framing-dim);
}

/* With Select on, the crop is the part's body: a press inside moves it. */
.convert-preview--select .convert-preview__frame {
  pointer-events: auto;
  cursor: move;
}

/* A kept part of the beads, as the editor draws a Selection: a marker line round them, the beads outside dimmed. */
.convert-preview__kept {
  position: absolute;
  pointer-events: none;
  outline: 1.5px solid var(--marker);
  box-shadow: 0 0 0 9999px var(--found-dim);
}

.convert-preview--select .convert-preview__kept {
  pointer-events: auto;
  cursor: move;
}

/* The crop's handles are the shared handle (Handle card), over the clipped picture; a corner wins where it and an
   edge's reach meet, as on the Canvas. */
.convert-preview__handle {
  z-index: 2;
}

.convert-preview__handle--corner {
  z-index: 3;
}

.convert-preview__ring {
  position: absolute;
  z-index: 2;
  pointer-events: none;
  box-shadow:
    inset 0 0 0 2px var(--ink),
    0 0 0 2px var(--canvas);
}

/* The floating bar (ConvertImage card): centred 18 above the preview's bottom edge, its groups split by dividers. Too
 * narrow a preview (a phone, until ticket 0911's bar) wraps it rather than cutting a tool. */
.convert-preview__tools {
  position: absolute;
  right: var(--space-8);
  bottom: var(--convert-tools-lift);
  left: var(--space-8);
  z-index: 3;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: fit-content;
  margin-inline: auto;
  padding: var(--space-4);
  background: var(--elevated);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-3);
}

.convert-preview__tools :deep(.app-button) {
  gap: var(--space-6);
  padding: 0 var(--space-12) 0 var(--space-10);
  font: var(--type-tab);
}

:root[data-theme='dark'] .convert-preview__tools {
  border-color: var(--line-strong);
}

.convert-preview__divider {
  flex: none;
  width: 1px;
  height: var(--space-20);
  margin: 0 var(--space-4);
  background: var(--line);
}

.convert-preview__level {
  min-width: var(--space-32);
  font: var(--type-meta);
  color: var(--ink);
  text-align: center;
  font-variant-numeric: tabular-nums;
}

/* A chip while a tool or Compare shows something, centred 14 below the preview's top (DS-1). */
.convert-preview__chip {
  position: absolute;
  top: var(--space-14);
  left: 50%;
  z-index: 3;
  max-width: calc(100% - var(--space-32));
  padding: var(--space-4) var(--space-12);
  font: var(--type-meta);
  color: var(--ink);
  text-align: center;
  pointer-events: none;
  background: var(--elevated);
  border: 1px solid var(--line);
  border-radius: var(--radius-full);
  transform: translateX(-50%);
}

.convert-preview__zoom {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

@media (prefers-reduced-motion: reduce) {
  .convert-preview__tools :deep(.app-button) {
    transition: none;
  }
}
</style>
