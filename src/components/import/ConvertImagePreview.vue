<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watchPostEffect } from 'vue'
import { NARROW_CONVERTER, useConvertCompare, type CompareView } from '../../composables/import/useConvertCompare'
import { useConvertImageWizardState, type ConvertTool } from '../../composables/import/useConvertImageWizard'
import { useConvertResult } from '../../composables/import/useConvertResult'
import { controlAction } from '../../composables/shell/controlRegistry'
import { useActionKeys } from '../../composables/shell/useActionKeys'
import { useElementSize } from '../../composables/ui/useElementSize'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { clamp } from '../../domain/clamp'
import { foundRuns } from '../../domain/convertBackground'
import { CROP_HANDLES, type CropHandle } from '../../domain/convertSize'
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
import SegmentedControl from '../ui/form/SegmentedControl.vue'
import ConvertDropZone from './ConvertDropZone.vue'

// Convert image's preview (ConvertImage card DS-1, DS-3; tickets 0747, 0780, 0787, 0896, 0898, 0909): the beads with
// the crop's handles, what was found hatched, a chip while a tool or Compare shows something, the floating bar, and with
// Compare on the picture beside the beads in two halves at one scale. With no picture yet, the drop zone.
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

// --- Compare (ticket 0909): the picture beside the beads from 1024 px wide in landscape, Beads | Picture under it ----

const narrow = useMediaQuery(NARROW_CONVERTER)
const compare = useConvertCompare({ narrow })
const sideBySide = compare.sideBySide
/** The preview's halves: the picture's and the beads' while Compare is on, wide; else the beads' alone. */
type Half = CompareView
const halves = computed<Half[]>(() => (sideBySide.value ? ['picture', 'beads'] : ['beads']))
/** Where the crop's handles stand: on the picture's half while it has one, else on the beads. */
const cropHalf = computed<Half>(() => (sideBySide.value ? 'picture' : 'beads'))

// Each half's viewport (it scrolls), box and canvas; the beads' half is the one measured and always on.
const viewportEl = ref<HTMLElement>()
const boxEl = ref<HTMLElement>()
const canvasEl = ref<HTMLCanvasElement>()
const pictureViewportEl = ref<HTMLElement>()
const pictureCanvasEl = ref<HTMLCanvasElement>()
const elements = {
  beads: { viewport: viewportEl, box: boxEl, canvas: canvasEl },
  picture: { viewport: pictureViewportEl, canvas: pictureCanvasEl },
}
/** A template ref of a half's element (the picture's half keeps no box: nothing measures it). */
function place(half: Half, part: 'viewport' | 'box' | 'canvas', element: unknown) {
  const slot = (elements[half] as Partial<Record<typeof part, { value: unknown }>>)[part]
  if (!slot || slot.value === (element ?? undefined)) return
  slot.value = element ?? undefined
  // A picture's half that opens while zoomed starts where the beads' half stands.
  if (half === 'picture' && part === 'viewport') void nextTick(() => onScroll('beads'))
}
const { width: viewportWidth, height: viewportHeight } = useElementSize(viewportEl)

/** Room kept round the beads at Fit, in px (ConvertImage card DS-1, DS-3): 72 above, 40 at the sides (24 in each half
 * of Compare) and 90 below (96 on a coarse pointer), so the bar never covers them; these where no design value loads. */
const coarse = useMediaQuery('(pointer: coarse)')
const ROOM = computed(() => {
  const style = paneEl.value && typeof getComputedStyle === 'function' ? getComputedStyle(paneEl.value) : undefined
  const px = (name: string, fallback: number) => {
    const read = Number.parseFloat(style?.getPropertyValue(name) ?? '')
    return Number.isFinite(read) ? read : fallback
  }
  return {
    top: px('--convert-fit-top', 72),
    side: sideBySide.value ? px('--convert-compare-side', 24) : px('--convert-fit-side', 40),
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

const colorsText = computed(() => plural(locale.value, wizard.usedColorCount.value, words.value.colorsCount))
/** The beads' canvas's name: the beads, the two side by side, or the picture shown in their place (ticket 0909). */
const previewName = computed(() => {
  const size = grid.value
  if (!wizard.hasPicture.value || !size) return words.value.previewEmpty
  if (compare.pictureAlone.value) return words.value.comparePictureName
  if (sideBySide.value) return fillBlanks(words.value.compareSideBySideName, { grid: `${size.columns}×${size.rows}`, colors: colorsText.value })
  return fillBlanks(words.value.previewName, { size: fillBlanks(words.value.resultGrid, { columns: size.columns, rows: size.rows }), colors: colorsText.value })
})

// --- Drawing ----------------------------------------------------------------------------------------------------------

/** The largest bitmap side the preview draws, so a zoomed view stays within what a canvas holds. */
const MAX_BITMAP_PX = 8192

/** Sizes a canvas's bitmap to the box at the screen's pixel ratio, kept within what a canvas holds; returns the ratio. */
function fitBitmap(canvas: HTMLCanvasElement) {
  const { width, height } = displayed.value
  const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_BITMAP_PX / Math.max(1, width, height))
  const bitmapWidth = Math.max(1, Math.round(width * pixelRatio))
  const bitmapHeight = Math.max(1, Math.round(height * pixelRatio))
  if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
    canvas.width = bitmapWidth
    canvas.height = bitmapHeight
  }
  return { pixelRatio, bitmapWidth, bitmapHeight }
}

watchPostEffect(() => {
  const canvas = canvasEl.value
  const drawn = project.value
  const at = space.value
  const context = canvas?.getContext('2d')
  if (!canvas || !drawn || !at || !context || !lattice.value) return
  const { width, height } = displayed.value
  const { pixelRatio, bitmapWidth, bitmapHeight } = fitBitmap(canvas)
  if (compare.pictureAlone.value) return drawPicture(context, pixelRatio)
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

/** The picture's half (ticket 0909): the same box as the beads', so both stand at one scale and in the same place. */
watchPostEffect(() => {
  const canvas = pictureCanvasEl.value
  const context = canvas?.getContext('2d')
  if (!canvas || !context || !sideBySide.value || !lattice.value) return
  drawPicture(context, fitBitmap(canvas).pixelRatio)
})

/** The picture's own pixels as a canvas, made once per picture (a turn or a flip is a new one): what Compare shows. */
const original = computed(() => {
  const image = wizard.image.value
  if (!image || typeof document === 'undefined' || typeof ImageData === 'undefined') return undefined
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  canvas.getContext('2d')?.putImageData(new ImageData(Uint8ClampedArray.from(image.data), image.width, image.height), 0, 0)
  return canvas
})

/** Compare (ConvertImage card DS-3): the picture as it becomes beads, smoothed, laid so the part woven covers the Frame's
 * beads, a removed background left empty so the `box` ground shows through it. */
function drawPicture(context: CanvasRenderingContext2D, pixelRatio: number) {
  const picture = original.value
  const frame = frameBox.value
  const part = wizard.part.value
  context.setTransform(1, 0, 0, 1, 0, 0)
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
  const removed = wizard.background.value === 'removed' ? foundPath(pixelRatio) : undefined
  if (!removed) return
  context.globalCompositeOperation = 'destination-out'
  context.fill(removed)
  context.globalCompositeOperation = 'source-over'
}

/** The found background's beads as one path in bitmap px, run by run (ticket 0785): a fill per bead stalls Safari. */
function foundPath(pixelRatio: number) {
  const found = wizard.backgroundFound.value?.found
  const at = lattice.value
  const size = grid.value
  if (!found || !at || !size || !view.value) return undefined
  const path = new Path2D()
  for (const run of foundRuns({ found, ...size })) {
    const box = view.value.beadBox({ row: at.frameRow + run.row, column: at.frameColumn + run.column, rows: 1, columns: run.columns })
    path.rect(box.x * pixelRatio, box.y * pixelRatio, box.width * pixelRatio, box.height * pixelRatio)
  }
  return path
}

/** Background found (1 Find): every bead it takes hatched over its own color with `--found-hatch`'s lines. */
function drawFound(context: CanvasRenderingContext2D, pixelRatio: number) {
  const path = foundPath(pixelRatio)
  if (!path || !paneEl.value) return
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
  // Faded first (ticket 0787), then hatched: the background reads as gone whatever the bead's color.
  context.fillStyle = value('--found-dim')
  context.fill(path)
  context.fillStyle = hatch
  context.fill(path)
}

// --- The crop on the picture (ticket 0898) ----------------------------------------------------------------------------

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

const crop = computed(() => wizard.crop.value)
/** The crop in the box, in px: round the whole picture until something is cropped. */
const cropBox = computed(() => (crop.value && view.value ? view.value.beadBox(crop.value.rect) : undefined))
const cropStyle = computed(() => (cropBox.value ? boxPlace(cropBox.value) : undefined))
/** A handle's reach on the crop as it is on screen (Handle card). */
const handleLimit = computed(() => (cropBox.value ? reachLimit(cropBox.value) : undefined))

/** Where a handle stands on the crop's box: its corner or the middle of its edge. */
function handlePoint(handle: CropHandle) {
  const box = cropBox.value
  if (!box) return undefined
  const lower = handle.toLowerCase()
  const x = lower.includes('left') ? box.x : lower.includes('right') ? box.x + box.width : box.x + box.width / 2
  const y = handle.startsWith('top') ? box.y : handle.startsWith('bottom') ? box.y + box.height : box.y + box.height / 2
  return { x, y }
}
function handleStyle(handle: CropHandle) {
  const at = handlePoint(handle)
  return at && { left: `${at.x}px`, top: `${at.y}px` }
}

/** What a drag on the crop does: a handle pulls an edge or corner, a press inside moves it whole. `per` is the screen
 * px of one bead each way when it began, so it moves by whole beads at the size on show. */
type Drag = { pointerId: number; x: number; y: number; per: { x: number; y: number } } & ({ kind: 'handle'; handle: CropHandle } | { kind: 'move' })
const drag = ref<Drag | null>(null)

function beadPx() {
  const at = lattice.value
  const whole = at && view.value?.beadBox({ row: 0, column: 0, rows: at.rows, columns: at.columns })
  return whole && at ? { x: whole.width / at.columns, y: whole.height / at.rows } : { x: 1, y: 1 }
}

function onDragMove(event: PointerEvent) {
  const started = drag.value
  if (!started || event.pointerId !== started.pointerId) return
  const columns = Math.round((event.clientX - started.x) / started.per.x)
  const rows = Math.round((event.clientY - started.y) / started.per.y)
  if (started.kind === 'handle') wizard.pullCrop(started.handle, columns, rows)
  else wizard.shiftCrop(columns, rows)
}

function endDrag(event?: PointerEvent) {
  if (event && drag.value && event.pointerId !== drag.value.pointerId) return
  const was = drag.value
  drag.value = null
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', endDrag)
  window.removeEventListener('pointercancel', endDrag)
  if (was) wizard.endCrop()
}

function beginDrag(event: PointerEvent, gesture: { kind: 'handle'; handle: CropHandle } | { kind: 'move' }) {
  if (drag.value || (event.pointerType === 'mouse' && event.button !== 0)) return
  event.preventDefault()
  event.stopPropagation()
  ;(event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId)
  drag.value = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, per: beadPx(), ...gesture }
  wizard.beginCrop()
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', endDrag)
  window.addEventListener('pointercancel', endDrag)
}

/** A press inside a crop moves it whole (the `move` pointer over it); with nothing cropped there is nothing to move.
 * Returns whether it took the press. */
function startMoveDrag(event: PointerEvent) {
  const box = (event.currentTarget as HTMLElement | null)?.getBoundingClientRect()
  const at = cropBox.value
  if (!crop.value?.cropped || !box || !at) return false
  const x = event.clientX - box.left
  const y = event.clientY - box.top
  if (x < at.x || x > at.x + at.width || y < at.y || y > at.y + at.height) return false
  beginDrag(event, { kind: 'move' })
  return true
}

/** A focused handle moves one bead per arrow, ten with Shift (ConvertImage card DS-1). */
function onHandleKey(event: KeyboardEvent, handle: CropHandle) {
  const by = event.shiftKey ? 10 : 1
  const columns = event.key === 'ArrowLeft' ? -by : event.key === 'ArrowRight' ? by : 0
  const rows = event.key === 'ArrowUp' ? -by : event.key === 'ArrowDown' ? by : 0
  if (columns === 0 && rows === 0) return
  event.preventDefault()
  wizard.nudgeCrop(handle, columns, rows)
}

/** A press on a half: on the beads Make empty's tap or the Background tool's mark; where the crop stands, inside it,
 * its move; else, zoomed in, a mouse's drag pans both halves (ticket 0909). */
function onBoxDown(event: PointerEvent, half: Half) {
  if (pinch.value) return
  if (half === 'beads' && tool.value === 'make-empty') {
    event.preventDefault()
    emptyAt(event)
  } else if (half === 'beads' && tool.value === 'background') {
    startMark(event)
  } else if (!(half === cropHalf.value && showCrop.value && startMoveDrag(event))) {
    startPan(event)
  }
}

/** The handles, the line and the kept chip stand where the crop is shown: not while a hold shows the picture, nor on the
 * beads while a tool rings them. */
const showCrop = computed(() => !!cropBox.value && !compare.held.value && (cropHalf.value === 'picture' || !ringed.value))
const cropOn = (half: Half) => showCrop.value && half === cropHalf.value

const result = useConvertResult(wizard)
/** The kept chip on the crop's top edge ("keeping 34×38", Keep all). */
const keptChip = computed(() => {
  const at = crop.value
  const box = cropBox.value
  if (!at?.cropped || !box || drag.value?.kind === 'handle') return undefined
  return { text: fillBlanks(words.value.keeping, { columns: at.rect.columns, rows: at.rect.rows }), style: { left: `${box.x + box.width / 2}px`, top: `${box.y}px` } }
})
/** The size chip beside the handle held, live: "34×38 beads" over "≈ 4.4 × 6.1 cm". */
const sizeChip = computed(() => {
  const held = drag.value
  const at = crop.value
  const shown = result.value?.kept ?? result.value
  const point = held?.kind === 'handle' ? handlePoint(held.handle) : undefined
  if (!at || !point || !shown) return undefined
  return {
    grid: fillBlanks(words.value.resultGrid, { columns: at.rect.columns, rows: at.rect.rows }),
    measure: fillBlanks(words.value.cropMeasure, { measure: shown.measured }),
    style: { left: `${point.x}px`, top: `${point.y}px` },
  }
})

// --- The view's zoom: buttons, Ctrl or ⌘ + wheel, and a pinch --------------------------------------------------------

function zoomTo(next: number) {
  viewZoom.value = clamp(next, VIEW_ZOOMS[0]!, VIEW_ZOOMS.at(-1)!)
}
const zoomIn = () => zoomTo(VIEW_ZOOMS.find((level) => level > viewZoom.value + 1e-6) ?? viewZoom.value)
const zoomOut = () => zoomTo([...VIEW_ZOOMS].reverse().find((level) => level < viewZoom.value - 1e-6) ?? viewZoom.value)
function fit() {
  viewZoom.value = 1
  for (const half of halves.value) elements[half].viewport.value?.scrollTo?.({ left: 0, top: 0 })
}

/** Panning either half pans both (ticket 0909): the same part of the picture is in the middle of each. */
function onScroll(half: Half) {
  const from = elements[half].viewport.value
  const to = elements[half === 'beads' ? 'picture' : 'beads'].viewport.value
  if (!from || !to || (to.scrollLeft === from.scrollLeft && to.scrollTop === from.scrollTop)) return
  to.scrollLeft = from.scrollLeft
  to.scrollTop = from.scrollTop
}

/** A mouse's drag pans the zoomed view; a finger scrolls it natively. */
let pan: { pointerId: number; x: number; y: number; left: number; top: number } | undefined
function onPanMove(event: PointerEvent) {
  const viewport = viewportEl.value
  if (!pan || event.pointerId !== pan.pointerId || !viewport) return
  viewport.scrollLeft = pan.left - (event.clientX - pan.x)
  viewport.scrollTop = pan.top - (event.clientY - pan.y)
}
function endPan() {
  pan = undefined
  window.removeEventListener('pointermove', onPanMove)
  window.removeEventListener('pointerup', endPan)
  window.removeEventListener('pointercancel', endPan)
}
function startPan(event: PointerEvent) {
  const viewport = viewportEl.value
  if (pan || !zoomed.value || !viewport || event.pointerType === 'touch' || event.button !== 0) return
  event.preventDefault()
  pan = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop }
  window.addEventListener('pointermove', onPanMove)
  window.addEventListener('pointerup', endPan)
  window.addEventListener('pointercancel', endPan)
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

/** Where a finger holds Compare or Picture, in the preview's px: a disc stands under it while the hold shows the
 * picture (DS-3). */
const pressedAt = ref<{ x: number; y: number }>()
/** A press of Compare, or of Picture under 1024 px: the one action's hold begins (useConvertCompare). */
function onComparePress(event: PointerEvent) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  const pane = paneEl.value?.getBoundingClientRect()
  pressedAt.value = event.pointerType === 'touch' && pane ? { x: event.clientX - pane.left, y: event.clientY - pane.top } : undefined
  compare.pressStart()
}
/** Beads | Picture: a press of Picture may be a hold; the click a hold ends with is its own, not a choice. */
function onChoicePress(event: PointerEvent) {
  if ((event.target as Element | null)?.closest('[data-value="picture"]')) onComparePress(event)
}
function onChoiceClick(event: MouseEvent) {
  if (!compare.isOwnClick()) return
  event.preventDefault()
  event.stopPropagation()
}
const shownView = computed({ get: () => compare.shown.value, set: (view: CompareView) => compare.choose(view) })
const showOptions = computed(() => [
  { value: 'beads' as const, label: words.value.compareBeads, icon: 'bead' as const },
  { value: 'picture' as const, label: words.value.comparePicture, icon: 'image' as const },
])

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

/** What a half shows now, as a chip over it (DS-1, DS-3): the picture held in the beads' place, the halves' names, the
 * picture chosen under 1024 px, or Make empty's tap. */
function chipFor(half: Half) {
  if (compare.held.value) return words.value.bandCompare
  if (half === 'picture' || compare.pictureAlone.value) return words.value.compareChipPicture
  if (tool.value === 'make-empty') return words.value.bandMakeEmpty
  return sideBySide.value ? words.value.compareChipBeads : undefined
}

onBeforeUnmount(() => {
  endDrag()
  endMark()
  endPan()
})
</script>

<template>
  <div ref="paneEl" class="convert-preview" :class="{ 'convert-preview--eyedropper': eyedropper, 'convert-preview--background': tool === 'background' }" data-testid="convert-preview">
    <ConvertDropZone v-if="!wizard.hasPicture.value" @paste="emit('paste')" />

    <div v-else class="convert-preview__room" :class="{ 'convert-preview__room--split': sideBySide }">
      <div class="convert-preview__halves">
        <div v-for="half in halves" :key="half" class="convert-preview__half" :class="`convert-preview__half--${half}`" :data-testid="`convert-half-${half}`">
          <div
            :ref="(element) => place(half, 'viewport', element)"
            class="convert-preview__viewport"
            @wheel="onWheel"
            @scroll="onScroll(half)"
            @pointerdown.capture="onViewportDown"
            @pointermove="onViewportMove"
            @pointerup="onViewportUp"
            @pointercancel="onViewportUp"
          >
            <div class="convert-preview__stage" :style="stageStyle">
              <div
                :ref="(element) => place(half, 'box', element)"
                class="convert-preview__box"
                :style="half === 'beads' && eyedropper ? { ...boxStyle, cursor: EYEDROPPER_CURSOR } : boxStyle"
                :data-testid="half === 'beads' ? 'convert-image-box' : 'convert-picture-box'"
                @pointerdown="onBoxDown($event, half)"
                @pointermove="half === 'beads' && onBoxHover($event)"
                @pointerleave="hovered = undefined"
              >
                <!-- The beads and the crop's dimming are clipped to the box; the handles and the chips may stand past it. -->
                <div class="convert-preview__clip">
                  <canvas
                    v-if="half === 'beads'"
                    :ref="(element) => place(half, 'canvas', element)"
                    class="convert-preview__canvas"
                    role="img"
                    :aria-label="previewName"
                    :style="boxStyle"
                    :data-columns="lattice?.columns"
                    :data-rows="lattice?.rows"
                    :data-comparing="compare.pictureAlone.value || undefined"
                    data-testid="convert-image-canvas"
                  />
                  <!-- The picture's half is named with the beads' canvas ("side by side"), so a reader hears it once. -->
                  <canvas v-else :ref="(element) => place(half, 'canvas', element)" class="convert-preview__canvas" aria-hidden="true" :style="boxStyle" data-testid="convert-picture-canvas" />
                  <div v-if="cropOn(half) && crop?.cropped" class="convert-preview__crop" :style="cropStyle" data-testid="convert-crop-line" />
                  <!-- Beside the picture the beads show only what is kept. -->
                  <div v-if="half === 'beads' && sideBySide && crop?.cropped" class="convert-preview__kept-only" :style="cropStyle" aria-hidden="true" />
                </div>
                <template v-if="cropOn(half)">
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
                    @pointerdown="beginDrag($event, { kind: 'handle', handle })"
                    @keydown="onHandleKey($event, handle)"
                  />
                  <div v-if="keptChip" class="convert-preview__kept-chip" :style="keptChip.style" data-testid="convert-kept">
                    <span>{{ keptChip.text }}</span>
                    <AppButton size="sm" class="convert-preview__keep-all" data-testid="convert-keep-all" @click="wizard.keepAll">{{ words.keepAll }}</AppButton>
                  </div>
                  <div v-if="sizeChip" class="convert-preview__size-chip" :style="sizeChip.style" role="status" data-testid="convert-crop-size">
                    <span class="convert-preview__size-grid">{{ sizeChip.grid }}</span>
                    <span class="convert-preview__size-measure">{{ sizeChip.measure }}</span>
                  </div>
                </template>
                <span v-if="half === 'beads' && ringStyle" class="convert-preview__ring" :style="ringStyle" aria-hidden="true" />
              </div>
            </div>
          </div>
          <span
            v-if="chipFor(half)"
            class="convert-preview__chip"
            :class="{ 'convert-preview__chip--compare': chipFor(half) !== words.bandMakeEmpty }"
            :data-half="half" data-testid="convert-chip">{{ chipFor(half) }}</span>
        </div>
      </div>

      <span v-if="compare.held.value && pressedAt" class="convert-preview__press" :style="{ left: `${pressedAt.x}px`, top: `${pressedAt.y}px` }" aria-hidden="true" />

      <div class="convert-preview__tools" :class="{ 'convert-preview__tools--narrow': narrow }" data-testid="convert-preview-tools">
        <template v-if="narrow">
          <IconButton
            variant="plain"
            :icon-size="16"
            :action="actions.background"
            :selected="wizard.popover.value === 'background'"
            aria-haspopup="dialog"
            :aria-expanded="wizard.popover.value === 'background'"
            data-testid="convert-tool-background"
            @click="wizard.togglePopover('background')"
          />
          <IconButton variant="plain" :icon-size="16" :action="actions.makeEmpty" :selected="tool === 'make-empty'" data-testid="convert-tool-make-empty" @click="pickTool('make-empty')" />
        </template>
        <template v-else>
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
        </template>
        <span class="convert-preview__divider" aria-hidden="true" />
        <SegmentedControl
          v-if="narrow"
          v-model="shownView"
          :options="showOptions"
          class="convert-preview__show"
          :aria-label="words.compareShow"
          data-testid="convert-show"
          @pointerdown="onChoicePress"
          @pointerup="compare.pressEnd()"
          @pointercancel="compare.pressEnd()"
          @pointerleave="compare.pressEnd()"
          @click.capture="onChoiceClick"
        />
        <AppButton
          v-else
          variant="text"
          :action="actions.compare"
          :selected="compare.on.value"
          data-testid="convert-compare"
          @pointerdown="onComparePress"
          @pointerup="compare.pressEnd()"
          @pointercancel="compare.pressEnd()"
          @pointerleave="compare.pressEnd()"
          @keydown="compare.keyDown"
          @keyup="compare.keyUp"
          @blur="compare.pressEnd()"
          @click="compare.clicked()"
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

.convert-preview__halves {
  display: flex;
  flex: 1;
  min-height: 0;
}

/* Compare on (DS-3): two equal halves, the picture's left and the beads' right, a 1px line between them full height. */
.convert-preview__half {
  position: relative;
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.convert-preview__room--split .convert-preview__halves {
  gap: 1px;
  background: var(--line);
}

.convert-preview__room--split .convert-preview__half {
  background: var(--box);
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

.convert-preview--background .convert-preview__half--beads .convert-preview__box {
  cursor: crosshair;
}

/* Background draws by a drag, so a touch on the beads does not scroll the view. */
.convert-preview--background .convert-preview__half--beads .convert-preview__box {
  touch-action: none;
}

.convert-preview__canvas {
  display: block;
}

/* The crop (DS-1): a 1.5px ink line with a 4px canvas halo at 75%, and the beads outside dimmed as `--found-dim`; a
   press inside moves it, so a touch on it never scrolls. */
.convert-preview__crop {
  position: absolute;
  cursor: move;
  touch-action: none;
  outline: var(--convert-crop-line) solid var(--ink);
  box-shadow:
    0 0 0 calc(var(--convert-crop-line) + var(--convert-crop-halo)) var(--convert-crop-halo-color),
    0 0 0 9999px var(--found-dim);
}

.convert-preview--eyedropper .convert-preview__half--beads .convert-preview__crop,
.convert-preview--background .convert-preview__half--beads .convert-preview__crop {
  pointer-events: none;
}

/* Beside the picture, the beads outside the crop are not shown: the `box` ground stands in for them. */
.convert-preview__kept-only {
  position: absolute;
  pointer-events: none;
  box-shadow: 0 0 0 9999px var(--box);
}

/* The crop's handles are the shared handle (Handle card), over the clipped picture; a corner wins where it and an
   edge's reach meet, as on the Canvas. */
.convert-preview__handle {
  z-index: 2;
}

.convert-preview__handle--corner {
  z-index: 3;
}

/* Under a finger the held corner's disc is 44 across (DS-1). */
@media (pointer: coarse) {
  .convert-preview__handle {
    --handle-hot-disc: var(--handle-reach-touch);
  }
}

/* The kept chip, centred on the crop's top edge with its bottom 14 above it (DS-1). */
.convert-preview__kept-chip {
  position: absolute;
  z-index: 4;
  display: flex;
  align-items: center;
  gap: var(--space-8);
  box-sizing: border-box;
  height: var(--convert-kept-chip-height);
  padding: 0 var(--space-4) 0 var(--space-12);
  font: var(--type-meta);
  color: var(--ink);
  white-space: nowrap;
  background: var(--canvas);
  border: 1px solid var(--line);
  border-radius: var(--radius-full);
  box-shadow: var(--elevation-3);
  transform: translate(-50%, calc(-100% - var(--space-14)));
}

:root[data-theme='dark'] .convert-preview__kept-chip {
  border-color: var(--line-strong);
}

@media (pointer: coarse) {
  .convert-preview__kept-chip {
    height: var(--convert-kept-chip-height-touch);
  }
}

.convert-preview__keep-all {
  height: var(--convert-keep-all-height);
  min-height: 0;
  font: var(--type-tab);
  border-radius: var(--radius-full);
}

/* The size chip, 26 right of the handle held, in the Tooltip's look (DS-1). */
.convert-preview__size-chip {
  position: absolute;
  z-index: 4;
  display: flex;
  flex-direction: column;
  padding: var(--space-6) var(--space-10);
  white-space: nowrap;
  pointer-events: none;
  background: var(--tooltip-fill);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-md);
  box-shadow: var(--elevation-3);
  transform: translate(var(--convert-size-chip-gap), -50%);
  backdrop-filter: blur(var(--tooltip-blur));
}

.convert-preview__size-grid {
  font: var(--type-small);
  color: var(--ink);
}

.convert-preview__size-measure {
  font: var(--type-meta-small);
  color: var(--muted);
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

/* A chip while a tool or Compare shows something, centred 14 below its half's top (DS-1, DS-3); Compare's never wrap,
   Make empty's line may on a phone. */
.convert-preview__chip {
  position: absolute;
  top: var(--space-14);
  left: 50%;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  max-width: calc(100% - var(--space-32));
  min-height: var(--convert-chip-height);
  padding: var(--space-4) var(--space-12);
  font: var(--type-meta);
  color: var(--ink);
  text-align: center;
  pointer-events: none;
  background: var(--canvas);
  border: 1px solid var(--line);
  border-radius: var(--radius-full);
  box-shadow: var(--elevation-3);
  transform: translateX(-50%);
}

:root[data-theme='dark'] .convert-preview__chip {
  border-color: var(--line-strong);
  box-shadow: none;
}

.convert-preview__chip--compare {
  max-width: none;
  white-space: nowrap;
}

@media (pointer: coarse) {
  .convert-preview__chip {
    min-height: var(--convert-chip-height-touch);
  }
}

/* Under a finger that holds Compare or Picture, a 44 disc in accent at 18% (DS-3). */
.convert-preview__press {
  position: absolute;
  z-index: 4;
  width: calc(var(--handle-reach-touch) * 2);
  height: calc(var(--handle-reach-touch) * 2);
  pointer-events: none;
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  border-radius: var(--radius-full);
  transform: translate(-50%, -50%);
}

/* Under 1024 px (DS-3): Background and Make empty icon only, 40 × --ctl, then Beads | Picture ("Show"). */
.convert-preview__tools--narrow :deep(.icon-btn) {
  width: var(--convert-narrow-tool-width);
  height: var(--control-height);
}

.convert-preview__tools .convert-preview__show {
  flex-wrap: nowrap;
  padding: var(--space-2);
  background: var(--surface);
  border-color: var(--line);
}

.convert-preview__show :deep(.segmented__option) {
  min-height: calc(var(--control-height) - var(--space-6));
  padding: 0 var(--space-12) 0 var(--space-10);
  font: var(--type-tab);
  white-space: nowrap;
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
