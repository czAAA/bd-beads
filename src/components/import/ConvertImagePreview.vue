<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch, watchPostEffect } from 'vue'
import { useConvertImageWizardState } from '../../composables/import/useConvertImageWizard'
import { controlAction } from '../../composables/shell/controlRegistry'
import { useActionKeys } from '../../composables/shell/useActionKeys'
import { useElementSize } from '../../composables/ui/useElementSize'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { clamp } from '../../domain/clamp'
import { CROP_HANDLES, pixelsPerBead, type CropHandle, type PixelCrop } from '../../domain/convertSize'
import { fillBlanks } from '../../domain/fillBlanks'
import { coverScaleMm } from '../../domain/imageFraming'
import { beadCell, describeWeave } from '../../domain/weave'
import { plural } from '../../i18n/plural'
import { useI18n } from '../../i18n/useI18n'
import { LIGHT_THEME } from '../../rendering/beadLook'
import { renderDraft, usesDraftLook } from '../../rendering/draftRenderer'
import { renderProject } from '../../rendering/projectRenderer'
import { spaceOf } from '../../rendering/space'
import { surfaceView } from '../../rendering/surfaceView'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import IconButton from '../ui/IconButton.vue'
import KeyChip from '../ui/KeyChip.vue'

// The Convert image wizard's preview (ConvertImage card, Preview pane): the picture as beads in the Frame's space, the
// Frame over it, the rest dimmed; crop handles By Pixel to bead ratio, a drag under the Frame By size; its own zoom (the
// view only, on the Canvas's zoom keys while it is open), and Treat as empty's eyedropper. Empty, it is the drop zone.
defineProps<{
  /** The phone preview scrolled small (PhoneForms card): no size tag, crop handles or zoom cluster. */
  shrunk?: boolean
}>()

const { t, locale } = useI18n()
const wizard = useConvertImageWizardState()
const words = computed(() => t.value.convertImage.wizard)
const touch = useMediaQuery('(pointer: coarse)')
const actions = {
  treatAsEmpty: controlAction('treat-as-empty'),
  zoomOut: controlAction('zoom-out'),
  zoomIn: controlAction('zoom-in'),
  zoomFit: controlAction('zoom-fit'),
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
const frameStyle = computed(() => {
  const box = frameBox.value
  return box ? { left: `${box.x}px`, top: `${box.y}px`, width: `${box.width}px`, height: `${box.height}px` } : undefined
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
  // While the picture or the crop moves, a block too big to draw bead by bead is drawn coarsely (draftRenderer).
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

// --- Moving the picture (By size) and the crop (By Pixel to bead ratio) -----------------------------------------------

/** Screen px of one bead step across and down at this scale, and the millimetres or pixels each is. */
const step = computed(() => {
  const beadStep = view.value?.beadStep()
  return beadStep ? { x: beadStep.column.x, y: beadStep.row.y } : { x: 1, y: 1 }
})
const stepMm = computed(() => describeWeave({ technique: wizard.technique.value, techniqueSettings: wizard.techniqueSettings.value }).stepMm(wizard.bead.value))

/** How far the picture can still move under the Frame, in mm: zero when it covers the Frame exactly. */
function panRangeMm() {
  const image = wizard.image.value
  if (!image) return { x: 0, y: 0 }
  const frame = wizard.frameMm.value
  const coverMm = coverScaleMm(image, frame) * wizard.zoom.value
  return { x: Math.max(0, image.width * coverMm - frame.widthMm), y: Math.max(0, image.height * coverMm - frame.heightMm) }
}

/** The pan after moving the picture by mm on screen: right shows more of its left side, a smaller fraction. */
function panBy(start: { x: number; y: number }, movedXMm: number, movedYMm: number) {
  const range = panRangeMm()
  wizard.setPan({
    x: range.x === 0 ? start.x : clamp(start.x - movedXMm / range.x, 0, 1),
    y: range.y === 0 ? start.y : clamp(start.y - movedYMm / range.y, 0, 1),
  })
}

const moves = (handle: CropHandle) => ({
  left: handle === 'left' || handle === 'topLeft' || handle === 'bottomLeft',
  right: handle === 'right' || handle === 'topRight' || handle === 'bottomRight',
  top: handle === 'top' || handle === 'topLeft' || handle === 'topRight',
  bottom: handle === 'bottom' || handle === 'bottomLeft' || handle === 'bottomRight',
})

/** The crop with a handle's edges moved by picture pixels, never past each other. */
function cropMoved(start: PixelCrop, handle: CropHandle, dx: number, dy: number): PixelCrop {
  const edges = moves(handle)
  let left = start.x
  let right = start.x + start.width
  let top = start.y
  let bottom = start.y + start.height
  if (edges.left) left = Math.min(left + dx, right - 1)
  if (edges.right) right = Math.max(right + dx, left + 1)
  if (edges.top) top = Math.min(top + dy, bottom - 1)
  if (edges.bottom) bottom = Math.max(bottom + dy, top + 1)
  return { x: left, y: top, width: right - left, height: bottom - top }
}

function handleStyle(handle: CropHandle) {
  const box = frameBox.value
  if (!box) return undefined
  const x = handle.toLowerCase().includes('left') ? box.x : handle.toLowerCase().includes('right') ? box.x + box.width : box.x + box.width / 2
  const y = handle.startsWith('top') ? box.y : handle.startsWith('bottom') ? box.y + box.height : box.y + box.height / 2
  return { left: `${x}px`, top: `${y}px` }
}

type Drag = { pointerId: number; x: number; y: number; handle?: CropHandle; crop: PixelCrop; pan: { x: number; y: number } }
const drag = ref<Drag | null>(null)
const dragged = ref(false)

function onDragMove(event: PointerEvent) {
  const started = drag.value
  if (!started || event.pointerId !== started.pointerId) return
  const beadsX = (event.clientX - started.x) / step.value.x
  const beadsY = (event.clientY - started.y) / step.value.y
  if (started.handle) {
    const per = pixelsPerBead(wizard.ratio.value)
    wizard.setCrop(cropMoved(started.crop, started.handle, beadsX * per, beadsY * per))
  } else {
    panBy(started.pan, beadsX * stepMm.value.across, beadsY * stepMm.value.down)
  }
}

function endDrag(event?: PointerEvent) {
  if (event && drag.value && event.pointerId !== drag.value.pointerId) return
  drag.value = null
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', endDrag)
  window.removeEventListener('pointercancel', endDrag)
  if (wizard.moving.value) wizard.endMove()
}

function startDrag(event: PointerEvent, handle?: CropHandle) {
  if (drag.value) return endDrag()
  if (event.pointerType === 'mouse' && event.button !== 0) return
  event.preventDefault()
  event.stopPropagation()
  ;(event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId)
  drag.value = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, handle, crop: { ...wizard.crop.value }, pan: { ...wizard.pan.value } }
  dragged.value = true
  wizard.beginMove()
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', endDrag)
  window.addEventListener('pointercancel', endDrag)
}

/** A press on the beads: the eyedropper's tap while Treat as empty is on, else a pan By size. */
function onBoxDown(event: PointerEvent) {
  if (pinch.value) return
  if (eyedropper.value) {
    event.preventDefault()
    emptyAt(event)
    return
  }
  if (wizard.mode.value === 'size') startDrag(event)
}

/** A focused handle moves one block per arrow (ConvertImage card). */
function onHandleKey(event: KeyboardEvent, handle: CropHandle) {
  const block = Math.max(1, pixelsPerBead(wizard.ratio.value))
  const edges = moves(handle)
  const dx = event.key === 'ArrowLeft' ? -block : event.key === 'ArrowRight' ? block : 0
  const dy = event.key === 'ArrowUp' ? -block : event.key === 'ArrowDown' ? block : 0
  if ((dx === 0 || !(edges.left || edges.right)) && (dy === 0 || !(edges.top || edges.bottom))) return
  event.preventDefault()
  wizard.setCrop(cropMoved(wizard.crop.value, handle, edges.left || edges.right ? dx : 0, edges.top || edges.bottom ? dy : 0))
}

/** Arrows pan the picture by one bead, Shift + arrows by ten (ConvertImage card). */
function onBoxKey(event: KeyboardEvent) {
  if (wizard.mode.value !== 'size') return
  const by = event.shiftKey ? 10 : 1
  const x = event.key === 'ArrowLeft' ? -by : event.key === 'ArrowRight' ? by : 0
  const y = event.key === 'ArrowUp' ? -by : event.key === 'ArrowDown' ? by : 0
  if (x === 0 && y === 0) return
  event.preventDefault()
  dragged.value = true
  // An arrow moves the Frame's view over the picture: the picture goes the other way.
  panBy(wizard.pan.value, -x * stepMm.value.across, -y * stepMm.value.down)
}

// A new picture, a turn or a flip starts the pan over, and the hint with it.
watch(wizard.image, () => (dragged.value = false))

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

const eyedropper = ref(false)
const hovered = ref<number>()
useOverlayLayer({ isOpen: () => eyedropper.value, root: () => paneEl.value, close: () => (eyedropper.value = false) })
watch(() => wizard.hasPicture.value, (has) => !has && (eyedropper.value = false))

function beadIndexAt(event: PointerEvent): number | undefined {
  const box = (event.currentTarget as HTMLElement | null)?.getBoundingClientRect()
  const at = lattice.value
  if (!box || !view.value || !at) return undefined
  const { row, column } = view.value.pointToCell({ x: event.clientX - box.left, y: event.clientY - box.top })
  return row >= 0 && row < at.rows && column >= 0 && column < at.columns ? row * at.columns + column : undefined
}

function emptyAt(event: PointerEvent) {
  const index = beadIndexAt(event)
  if (index !== undefined) wizard.emptyAtBead(index)
}

function onBoxHover(event: PointerEvent) {
  hovered.value = eyedropper.value ? beadIndexAt(event) : undefined
}

const ringStyle = computed(() => {
  const at = lattice.value
  const index = hovered.value
  if (!eyedropper.value || index === undefined || !at || !view.value) return undefined
  const box = view.value.beadBox({ row: Math.floor(index / at.columns), column: index % at.columns, rows: 1, columns: 1 })
  return { left: `${box.x}px`, top: `${box.y}px`, width: `${box.width}px`, height: `${box.height}px` }
})

onBeforeUnmount(() => endDrag())
</script>

<template>
  <div ref="paneEl" class="convert-preview" :class="{ 'convert-preview--shrunk': shrunk, 'convert-preview--eyedropper': eyedropper }" data-testid="convert-preview">
    <div v-if="!wizard.hasPicture.value" class="convert-preview__empty" data-testid="convert-drop-zone">
      <AppIcon name="image" :size="34" />
      <span class="convert-preview__empty-title">{{ words.dropHere }}</span>
      <span class="convert-preview__empty-line">{{ touch ? words.dropOrChoose : words.dropOrPaste }}</span>
    </div>

    <template v-else>
      <div class="convert-preview__top">
        <IconButton
          v-if="touch || shrunk"
          variant="box"
          :action="actions.treatAsEmpty"
          :pressed="eyedropper"
          class="convert-preview__eyedropper"
          data-testid="convert-treat-as-empty"
          @click="eyedropper = !eyedropper"
        />
        <AppButton
          v-else
          variant="box"
          :action="actions.treatAsEmpty"
          :aria-pressed="eyedropper"
          class="convert-preview__eyedropper"
          data-testid="convert-treat-as-empty"
          @click="eyedropper = !eyedropper"
        />
      </div>

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
            :class="{ 'convert-preview__box--pan': wizard.mode.value === 'size' && !eyedropper }"
            :style="boxStyle"
            :tabindex="wizard.mode.value === 'size' ? 0 : undefined"
            :aria-label="wizard.mode.value === 'size' ? t.convertImage.panHint : undefined"
            :role="wizard.mode.value === 'size' ? 'group' : undefined"
            data-testid="convert-image-box"
            @pointerdown="onBoxDown"
            @pointermove="onBoxHover"
            @pointerleave="hovered = undefined"
            @keydown="onBoxKey"
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
              <div v-if="frameStyle" class="convert-preview__frame" :style="frameStyle" data-testid="convert-image-frame-outline" />
            </div>
            <span v-if="frameStyle && !shrunk && grid" class="convert-preview__tag" :style="{ left: frameStyle.left, top: frameStyle.top }" aria-hidden="true">
              {{ grid.columns }}×{{ grid.rows }}
            </span>
            <template v-if="wizard.mode.value === 'ratio' && !shrunk && !eyedropper">
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

      <p v-if="wizard.mode.value === 'size' && !dragged && !eyedropper && !shrunk" class="convert-preview__hint" data-testid="convert-pan-hint">
        <AppIcon name="hand" :size="14" />
        <span>{{ t.convertImage.panHint }}</span>
      </p>
      <p v-if="eyedropper" class="convert-preview__banner" role="status" data-testid="convert-eyedropper-banner">
        <span>{{ words.treatAsEmptyBanner }}</span>
        <KeyChip v-if="!touch">esc</KeyChip>
      </p>

      <div v-if="!shrunk" class="convert-preview__zoom" data-testid="convert-preview-zoom">
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

.convert-preview__top {
  position: absolute;
  top: var(--space-12);
  left: var(--space-12);
  z-index: 3;
}

.convert-preview :deep(.convert-preview__eyedropper[aria-pressed='true']) {
  color: var(--accent-strong);
  box-shadow: inset 0 0 0 2px var(--accent-strong);
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

.convert-preview__box {
  position: relative;
}

.convert-preview__clip {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: var(--radius-sm);
}

.convert-preview__box--pan {
  cursor: grab;
  /* A touch or pen drag moves the picture; it must not scroll the popup. */
  touch-action: none;
}

.convert-preview__box--pan:active {
  cursor: grabbing;
}

.convert-preview--eyedropper .convert-preview__box {
  cursor: crosshair;
}

.convert-preview__box:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
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

.convert-preview__hint,
.convert-preview__banner {
  position: absolute;
  bottom: var(--space-12);
  left: var(--space-12);
  z-index: 3;
  display: flex;
  align-items: center;
  gap: var(--space-6);
  max-width: calc(100% - var(--space-24));
  margin: 0;
  padding: var(--space-4) var(--space-8);
  font: var(--type-small);
  border-radius: var(--radius-sm);
  pointer-events: none;
}

.convert-preview__hint {
  color: var(--ink);
  background: var(--overlay-fill);
}

.convert-preview__banner {
  color: var(--canvas);
  background: var(--ink);
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

.convert-preview__level {
  min-width: var(--space-32);
  font: var(--type-meta);
  color: var(--ink);
  text-align: center;
  font-variant-numeric: tabular-nums;
}

/* On a phone (PhoneForms card) the controls sit in a row above the picture, so nothing covers a bead. */
@media (max-width: 63.99rem), (orientation: portrait) {
  .convert-preview__top {
    position: static;
    padding: var(--space-8) var(--space-8) 0;
  }

  .convert-preview__zoom {
    top: var(--space-8);
    right: var(--space-8);
    bottom: auto;
    box-shadow: none;
  }
}
</style>
