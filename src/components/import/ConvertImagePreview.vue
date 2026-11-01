<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watchPostEffect } from 'vue'
import { useConvertImageWizardState } from '../../composables/import/useConvertImageWizard'
import { controlAction } from '../../composables/shell/controlRegistry'
import { useActionKeys } from '../../composables/shell/useActionKeys'
import { useElementSize } from '../../composables/ui/useElementSize'
import { HOLD_DELAY_MS } from '../../composables/ui/useHoldRepeat'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { clamp } from '../../domain/clamp'
import { CROP_HANDLES, partDrawn, partMoved, partShifted, type CropHandle, type PixelCrop } from '../../domain/convertSize'
import { fillBlanks } from '../../domain/fillBlanks'
import { beadCell } from '../../domain/weave'
import { plural } from '../../i18n/plural'
import { useI18n } from '../../i18n/useI18n'
import { LIGHT_THEME } from '../../rendering/beadLook'
import { renderDraft, usesDraftLook } from '../../rendering/draftRenderer'
import { renderProject } from '../../rendering/projectRenderer'
import { spaceOf } from '../../rendering/space'
import { surfaceView } from '../../rendering/surfaceView'
import { EYEDROPPER_CURSOR } from '../canvas/eyedropperCursor'
import AppIcon from '../ui/AppIcon.vue'
import IconButton from '../ui/IconButton.vue'

// The Convert image wizard's preview (ConvertImage card, Preview pane): the picture as beads, the Frame over the part to
// weave, the part drawn, moved and pulled like a Selection (tickets 0747, 0757); its zoom, Treat as empty's eyedropper,
// Cut out's taps (0769) and Hold to compare with its Compare toggle (0770). Empty, the drop zone.

const { t, locale } = useI18n()
const wizard = useConvertImageWizardState()
const words = computed(() => t.value.convertImage.wizard)
const touch = useMediaQuery('(pointer: coarse)')
const actions = {
  zoomOut: controlAction('zoom-out'),
  zoomIn: controlAction('zoom-in'),
  zoomFit: controlAction('zoom-fit'),
  compare: controlAction('convert-compare'),
}
const cropName = (handle: CropHandle) => controlAction(`crop-${handle}`).name(t.value)

const paneEl = ref<HTMLElement>()
const viewportEl = ref<HTMLElement>()
const { width: viewportWidth, height: viewportHeight } = useElementSize(viewportEl)

/** Room kept round the beads inside the pane, in px. */
const PAD_PX = 16
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
  const width = Math.max(1, viewportWidth.value - PAD_PX * 2)
  const height = Math.max(1, viewportHeight.value - PAD_PX * 2)
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
  width: `${Math.max(viewportWidth.value, displayed.value.width + PAD_PX * 2)}px`,
  height: `${Math.max(viewportHeight.value, displayed.value.height + PAD_PX * 2)}px`,
}))

/** The Frame's beads in the box, in px: the line goes round them and everything else is dimmed. */
const frameBox = computed(() => {
  const at = lattice.value
  const size = grid.value
  if (!view.value || !at || !size) return undefined
  return view.value.beadBox({ row: at.frameRow, column: at.frameColumn, rows: size.rows, columns: size.columns })
})
/** The Schema's beads in the box: the Frame, grown round it by the Outline while it is on (ticket 0766). The line,
 * the dimming and the size tag go round it; the part's handles stay on the Frame. */
const schemaBox = computed(() => {
  const at = lattice.value
  const size = grid.value
  const pad = wizard.outlinePad.value
  if (!pad) return frameBox.value
  if (!view.value || !at || !size) return undefined
  return view.value.beadBox({
    row: at.frameRow - pad.top,
    column: at.frameColumn - pad.left,
    rows: size.rows + pad.top + pad.bottom,
    columns: size.columns + pad.left + pad.right,
  })
})
const frameStyle = computed(() => {
  const box = schemaBox.value
  return box ? { left: `${box.x}px`, top: `${box.y}px`, width: `${box.width}px`, height: `${box.height}px` } : undefined
})
/** The Schema's size the tag and the pane's name read, the Outline's ring included. */
const schemaSize = computed(() => {
  const size = grid.value
  const pad = wizard.outlinePad.value
  return size && pad ? { columns: size.columns + pad.left + pad.right, rows: size.rows + pad.top + pad.bottom } : size
})

const colorsText = computed(() => plural(locale.value, wizard.usedColorCount.value, words.value.colorsCount))
const previewName = computed(() => {
  const size = schemaSize.value
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
    return
  }
  // The board look in light whatever the app's theme (ticket 150), as the Project will print.
  renderProject(context, { project: drawn, space: at, region: { x: 0, y: 0, width, height }, zoom: scale.value, pixelRatio, theme: LIGHT_THEME, rowMarks: false })
})

// --- Drawing, moving and pulling the part ------------------------------------------------------------------------------

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

/** How far the pointer goes before a press on the beads draws, moves the part or stops a hold, so a tap draws nothing. */
const DRAW_AFTER_PX = 3

/** What a gesture on the part does (ConvertImage card): a handle pulls an edge or corner, a press inside moves the
 * part, a drag outside draws a new one from the pixel it began on. */
type Gesture = { kind: 'handle'; handle: CropHandle } | { kind: 'move' } | { kind: 'draw'; anchor: { x: number; y: number } }

/** `per` is the picture pixels a screen pixel covers, taken when the drag began: the picture holds still on screen
 * whatever the part is, so the pointer keeps its place on it. A press on the beads is `live` once it has moved, so a
 * press held still shows the picture instead (Hold to compare, ticket 0770); a handle's is live at once. */
type Drag = { pointerId: number; x: number; y: number; part: PixelCrop; per: { x: number; y: number }; live: boolean } & Gesture
const drag = ref<Drag | null>(null)

function onDragMove(event: PointerEvent) {
  const started = drag.value
  const image = wizard.image.value
  if (!started || !image || event.pointerId !== started.pointerId) return
  const moved = { x: event.clientX - started.x, y: event.clientY - started.y }
  if (!started.live) {
    if (held.value || Math.hypot(moved.x, moved.y) < DRAW_AFTER_PX) return
    started.live = true
  }
  const dx = moved.x * started.per.x
  const dy = moved.y * started.per.y
  if (started.kind === 'handle') movePart(started.part, started.handle, dx, dy)
  else if (started.kind === 'move') wizard.setPart(partShifted(started.part, dx, dy, image))
  else wizard.setPart(partDrawn(started.anchor, { x: started.anchor.x + dx, y: started.anchor.y + dy }, image))
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
  drag.value = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, part, per: pixelsPerScreenPixel(part), live: gesture.kind === 'handle', ...gesture }
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

/** A press on the beads: held still, it shows the picture (Hold to compare); otherwise the eyedropper's tap while Treat
 * as empty is on, or Cut out's tap while tap add or remove is on, each made as it lets go; or the part's gesture. */
function onBoxDown(event: PointerEvent) {
  if (pinch.value || press.value) return
  if (event.pointerType === 'mouse' && event.button !== 0) return
  startPress(event, eyedropper.value ? beadIndexAt(event) : undefined, tapping.value ? pixelAt(event) : undefined)
  if (eyedropper.value || tapping.value) event.preventDefault()
  else if (wizard.weave.value === 'part') startPartDrag(event)
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
    endPress()
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

// --- Treat as empty ---------------------------------------------------------------------------------------------------

/** Treat as empty is a toggle in the Colors step (ticket 0758): here it only gives the pointer and takes the taps. */
const eyedropper = wizard.treatAsEmpty
const hovered = ref<number>()
// Escape ends it first; a press elsewhere (the toggle in the step) goes through and leaves it as it is.
useOverlayLayer({ isOpen: () => eyedropper.value, root: () => paneEl.value, close: () => (eyedropper.value = false), keepsPress: () => true })

function beadIndexAt(event: PointerEvent): number | undefined {
  const box = (event.currentTarget as HTMLElement | null)?.getBoundingClientRect()
  const at = lattice.value
  if (!box || !view.value || !at) return undefined
  const { row, column } = view.value.pointToCell({ x: event.clientX - box.left, y: event.clientY - box.top })
  return row >= 0 && row < at.rows && column >= 0 && column < at.columns ? row * at.columns + column : undefined
}

function onBoxHover(event: PointerEvent) {
  hovered.value = eyedropper.value ? beadIndexAt(event) : undefined
}

const ringStyle = computed(() => {
  const at = lattice.value
  const index = hovered.value
  if (!eyedropper.value || comparing.value || index === undefined || !at || !view.value) return undefined
  const box = view.value.beadBox({ row: Math.floor(index / at.columns), column: index % at.columns, rows: 1, columns: 1 })
  return { left: `${box.x}px`, top: `${box.y}px`, width: `${box.width}px`, height: `${box.height}px` }
})

// --- Cut out's taps (ticket 0769) --------------------------------------------------------------------------------------

/** Tap add or tap remove is on, in the Picture step where its chips are: a tap on the beads is a tap, never A part's. */
const tapping = computed(() => !!wizard.cutOutTapMode.value && wizard.cutOutTapsShown.value && wizard.step.value === 'picture')

/** The picture pixel under the pointer, the whole picture counting (it is drawn round the part); none off the picture. */
function pixelAt(event: PointerEvent): { x: number; y: number } | undefined {
  const box = (event.currentTarget as HTMLElement | null)?.getBoundingClientRect()
  const frame = frameBox.value
  const picture = wizard.image.value
  const size = grid.value
  const per = wizard.sizing.value.pixelsPerBead
  if (!box || !frame || !picture || !size || frame.width === 0 || frame.height === 0) return undefined
  const part = wizard.part.value
  const x = Math.floor(part.x + ((event.clientX - box.left - frame.x) * size.columns * per.x) / frame.width)
  const y = Math.floor(part.y + ((event.clientY - box.top - frame.y) * size.rows * per.y) / frame.height)
  return x >= 0 && x < picture.width && y >= 0 && y < picture.height ? { x, y } : undefined
}

// --- Hold to compare (ticket 0770) -------------------------------------------------------------------------------------

/** The Compare toggle beside the preview: on, the picture shows until it is pressed again. */
const compareOn = ref(false)
/** A press on the beads not yet let go: where it began, the bead an eyedropper's tap takes or the picture pixel Cut
 * out's tap takes, and whether it was held still past the delay (the picture showing) or moved first (today's gestures). */
type Press = { pointerId: number; x: number; y: number; tap?: number; pixel?: { x: number; y: number }; moved: boolean }
const press = ref<Press | null>(null)
const held = ref(false)
let holdTimer: ReturnType<typeof setTimeout> | undefined
const comparing = computed(() => compareOn.value || held.value)

function startPress(event: PointerEvent, tap: number | undefined, pixel: { x: number; y: number } | undefined) {
  press.value = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, tap, pixel, moved: false }
  holdTimer = setTimeout(() => (held.value = !!press.value && !press.value.moved && !drag.value?.live), HOLD_DELAY_MS)
  window.addEventListener('pointermove', onPressMove)
  window.addEventListener('pointerup', onPressUp)
  window.addEventListener('pointercancel', endPress)
}

function onPressMove(event: PointerEvent) {
  const started = press.value
  if (!started || event.pointerId !== started.pointerId || held.value) return
  if (Math.hypot(event.clientX - started.x, event.clientY - started.y) < DRAW_AFTER_PX) return
  started.moved = true
  clearTimeout(holdTimer)
}

/** Letting go: the beads again after a hold, else the eyedropper's tap on the bead the press began on, or Cut out's
 * tap on the pixel it began on when it never moved. */
function onPressUp(event: PointerEvent) {
  const started = press.value
  if (!started || event.pointerId !== started.pointerId) return
  const tap = held.value ? undefined : started.tap
  const pixel = held.value || started.moved ? undefined : started.pixel
  endPress()
  if (tap !== undefined) wizard.emptyAtBead(tap)
  if (pixel) wizard.tapCutOut(pixel)
}

function endPress(event?: PointerEvent) {
  if (event && press.value && event.pointerId !== press.value.pointerId) return
  clearTimeout(holdTimer)
  press.value = null
  held.value = false
  window.removeEventListener('pointermove', onPressMove)
  window.removeEventListener('pointerup', onPressUp)
  window.removeEventListener('pointercancel', endPress)
}

/** A long press is the compare, not the touch browser's own menu over the picture. */
function onBoxContextMenu(event: Event) {
  if (press.value) event.preventDefault()
}

/** Where the picture's own pixels sit in the box: the part laid on the Frame's beads, the rest round it, so the picture
 * shows in the beads' place. Its bitmap is drawn while it shows. */
const originalEl = ref<HTMLCanvasElement>()
const originalStyle = computed(() => {
  const box = frameBox.value
  const picture = wizard.image.value
  const size = grid.value
  const per = wizard.sizing.value.pixelsPerBead
  if (!box || !picture || !size) return undefined
  const part = wizard.part.value
  const scale = { x: box.width / (size.columns * per.x), y: box.height / (size.rows * per.y) }
  return {
    left: `${box.x - part.x * scale.x}px`,
    top: `${box.y - part.y * scale.y}px`,
    width: `${picture.width * scale.x}px`,
    height: `${picture.height * scale.y}px`,
    imageRendering: scale.x >= 1 ? ('pixelated' as const) : undefined,
  }
})

watchPostEffect(() => {
  const canvas = originalEl.value
  const picture = wizard.image.value
  const context = canvas?.getContext('2d')
  if (!canvas || !picture || !context || typeof ImageData === 'undefined') return
  canvas.width = picture.width
  canvas.height = picture.height
  const pixels = picture.data instanceof Uint8ClampedArray ? picture.data : Uint8ClampedArray.from(picture.data)
  context.putImageData(new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, picture.width, picture.height), 0, 0)
})

onBeforeUnmount(() => {
  endDrag()
  endPress()
})
</script>

<template>
  <div
    ref="paneEl"
    class="convert-preview"
    :class="{ 'convert-preview--eyedropper': eyedropper, 'convert-preview--tapping': tapping, 'convert-preview--part': wizard.weave.value === 'part' }"
    data-testid="convert-preview"
  >
    <div v-if="!wizard.hasPicture.value" class="convert-preview__empty" data-testid="convert-drop-zone">
      <AppIcon name="image" :size="34" />
      <span class="convert-preview__empty-title">{{ words.dropHere }}</span>
      <span class="convert-preview__empty-line">{{ touch ? words.dropOrChoose : words.dropOrPaste }}</span>
    </div>

    <template v-else>
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
          <div
            class="convert-preview__box"
            :style="eyedropper ? { ...boxStyle, cursor: EYEDROPPER_CURSOR } : boxStyle"
            :data-comparing="comparing || undefined"
            data-testid="convert-image-box"
            @pointerdown="onBoxDown"
            @pointermove="onBoxHover"
            @pointerleave="hovered = undefined"
            @contextmenu="onBoxContextMenu"
          >
            <!-- The beads and the Frame's dimming are clipped to the box; the size tag and handles may stand past it. -->
            <div class="convert-preview__clip">
              <canvas
                ref="canvasEl"
                class="convert-preview__canvas"
                role="img"
                :aria-label="previewName"
                :style="boxStyle"
                :data-columns="lattice?.columns"
                :data-rows="lattice?.rows"
                data-testid="convert-image-canvas"
              />
              <canvas v-if="comparing && originalStyle" ref="originalEl" class="convert-preview__original" :style="originalStyle" aria-hidden="true" data-testid="convert-original" />
              <div v-if="wizard.aiCutOut.value.kind === 'thinking'" class="convert-preview__shimmer" aria-hidden="true" data-testid="convert-ai-shimmer" />
              <div v-if="frameStyle" class="convert-preview__frame" :style="frameStyle" data-testid="convert-image-frame-outline" />
            </div>
            <span v-if="frameStyle && schemaSize" class="convert-preview__tag" :style="{ left: frameStyle.left, top: frameStyle.top }" aria-hidden="true">
              {{ schemaSize.columns }}×{{ schemaSize.rows }}
            </span>
            <template v-if="wizard.weave.value === 'part' && !eyedropper && !tapping">
              <button
                v-for="handle in CROP_HANDLES"
                :key="handle"
                type="button"
                class="convert-preview__handle"
                :class="`convert-preview__handle--${handle.length > 6 ? 'corner' : handle === 'left' || handle === 'right' ? 'side' : 'edge'}`"
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

      <div class="convert-preview__zoom" data-testid="convert-preview-zoom">
        <IconButton variant="plain" :icon-size="16" :action="actions.compare" :pressed="compareOn" data-testid="convert-compare" @click="compareOn = !compareOn" />
        <span class="convert-preview__divider" aria-hidden="true" />
        <IconButton
          variant="plain"
          :icon-size="16"
          :action="actions.zoomOut"
          :disabled="viewZoom <= VIEW_ZOOMS[0]!"
          :disabled-body="t.tooltips.zoomOutLimit"
          data-testid="convert-zoom-out"
          @click="zoomOut"
        />
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
      </div>
    </template>
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

.convert-preview__empty {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-8);
  margin: var(--space-24);
  color: var(--muted);
  text-align: center;
  border: 1.5px dashed var(--line-strong);
  border-radius: var(--radius-lg);
}

.convert-preview__empty-title {
  font: var(--type-control);
  color: var(--ink);
}

.convert-preview__empty-line {
  font: var(--type-meta);
}

.convert-preview__viewport {
  flex: 1;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}

.convert-preview__stage {
  display: grid;
  place-items: center;
}

/* A press held on the beads is the compare (ticket 0770): no text selection or touch callout gets in its way. */
.convert-preview__box {
  position: relative;
  user-select: none;
  -webkit-touch-callout: none;
}

.convert-preview__clip {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: var(--radius-sm);
}

.convert-preview--part .convert-preview__box,
.convert-preview--tapping .convert-preview__box {
  cursor: crosshair;
}

/* A part is drawn by a drag, so a touch on the beads does not scroll the view. */
.convert-preview--part:not(.convert-preview--eyedropper, .convert-preview--tapping) .convert-preview__box {
  touch-action: none;
}

.convert-preview__canvas {
  display: block;
}

/* The picture's own pixels over the beads while comparing, under the Frame's line and dimming. */
.convert-preview__original {
  position: absolute;
  pointer-events: none;
}

/* While the cut-out model works (Loading card, AI variant): a soft `ai` band sweeping left to right over the beads, under
   the Frame, the handles and the zoom; nothing for the first `loading-delay`, and none with reduced motion. */
.convert-preview__shimmer {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.convert-preview__shimmer::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: var(--ai-shimmer-band);
  content: '';
  background: linear-gradient(90deg, transparent, var(--ai-shimmer-fill), transparent);
  animation: convert-preview-shimmer var(--ai-shimmer) linear var(--loading-delay) infinite backwards;
}

@keyframes convert-preview-shimmer {
  from {
    left: 0;
    transform: translateX(-100%);
  }

  to {
    left: 100%;
    transform: translateX(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .convert-preview__shimmer {
    display: none;
  }
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

/* With A part the Frame is the part's body: a press inside moves it (not while a tap is a tap). */
.convert-preview--part:not(.convert-preview--eyedropper, .convert-preview--tapping) .convert-preview__frame {
  pointer-events: auto;
  cursor: move;
}

.convert-preview__tag {
  position: absolute;
  z-index: 1;
  transform: translateY(calc(-100% - var(--space-4)));
  padding: 0 var(--space-4);
  font: var(--type-meta-small);
  color: var(--canvas);
  white-space: nowrap;
  background: var(--ink);
  border-radius: var(--radius-sm);
}

.convert-preview__handle {
  position: absolute;
  z-index: 2;
  box-sizing: border-box;
  padding: 0;
  background: var(--canvas);
  border: 2px solid var(--ink);
  border-radius: var(--crop-handle-radius);
  transform: translate(-50%, -50%);
  touch-action: none;
  cursor: move;
}

.convert-preview__handle--corner {
  width: var(--crop-handle);
  height: var(--crop-handle);
}

.convert-preview__handle--edge {
  width: var(--crop-bar-length);
  height: var(--crop-bar-width);
  cursor: ns-resize;
}

.convert-preview__handle--side {
  width: var(--crop-bar-width);
  height: var(--crop-bar-length);
  cursor: ew-resize;
}

.convert-preview__handle:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

.convert-preview__ring {
  position: absolute;
  z-index: 2;
  pointer-events: none;
  box-shadow:
    inset 0 0 0 2px var(--ink),
    0 0 0 2px var(--canvas);
}

.convert-preview__zoom {
  position: absolute;
  right: var(--space-12);
  bottom: var(--space-12);
  z-index: 3;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  background: var(--overlay-fill);
  border-radius: var(--radius-md);
  box-shadow: var(--elevation-3);
}

.convert-preview__divider {
  align-self: stretch;
  width: 1px;
  margin: var(--space-4) var(--space-2);
  background: var(--line);
}

.convert-preview__level {
  min-width: var(--space-32);
  font: var(--type-meta);
  color: var(--ink);
  text-align: center;
  font-variant-numeric: tabular-nums;
}

/* On a phone (PhoneForms card) the controls sit in a row above the picture, so nothing covers a bead. */
@media (max-width: 63.99rem), (orientation: portrait) {
  .convert-preview__zoom {
    top: var(--space-8);
    right: var(--space-8);
    bottom: auto;
    box-shadow: none;
  }
}
</style>
