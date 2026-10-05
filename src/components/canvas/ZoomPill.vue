<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import { clampOffset, nearestCorner, type Box, type ZoomPillCorner } from '../../domain/zoomPillCorner'
import AppTooltip from '../ui/AppTooltip.vue'
import IconButton from '../ui/IconButton.vue'

/**
 * The design system's ZoomPill (ticket 79; ZoomPill card): the phone's zoom control, floating in the Project's
 * bottom-right corner (rulers · undo · redo · progress bar · out · level · in · fit; ticket 296) -- pinch zooms and two fingers pan, so this is for a fit or an exact
 * step. Same zoom (useProjectZoom) as the reference tier's CanvasStrip zoom cluster (ZoomControls.vue): a `canvas`
 * pill instead of the strip's plain buttons.
 *
 * Its drag handle (ticket 297) moves it anywhere inside its positioned parent, the canvas box's drawing area, and on
 * release it snaps to the nearest corner, which the parent keeps (`move`). The parent places the pill in `corner`; this
 * component only owns the drag's own offset and the glide into the corner.
 */
defineProps<{ corner?: ZoomPillCorner; zoomPercent: number; rulers?: boolean; progressBar?: boolean; canUndo?: boolean; canRedo?: boolean }>()
const emit = defineEmits<{
  'zoom-in': []
  'zoom-out': []
  reset: []
  'toggle-rulers': []
  'toggle-progress-bar': []
  undo: []
  redo: []
  move: [corner: ZoomPillCorner]
}>()
const { t } = useI18n()

const pill = ref<HTMLElement>()
const offset = ref<{ x: number; y: number }>()
const dragging = ref(false)
const gliding = ref(false)
let drag: { pointerId: number; startX: number; startY: number; pill: Box; area: Box } | undefined

const toBox = (rect: DOMRect): Box => ({ left: rect.left, top: rect.top, width: rect.width, height: rect.height })

function onHandleDown(event: PointerEvent): void {
  const element = pill.value
  const area = element?.offsetParent
  if (!element || !area || (event.pointerType === 'mouse' && event.button !== 0)) return
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, pill: toBox(element.getBoundingClientRect()), area: toBox(area.getBoundingClientRect()) }
  gliding.value = false
  dragging.value = true
  offset.value = { x: 0, y: 0 }
}

function onHandleMove(event: PointerEvent): void {
  if (!drag || event.pointerId !== drag.pointerId) return
  offset.value = clampOffset(drag.pill, drag.area, event.clientX - drag.startX, event.clientY - drag.startY)
}

async function onHandleUp(event: PointerEvent): Promise<void> {
  if (!drag || event.pointerId !== drag.pointerId) return
  const { pill: start, area } = drag
  const at = offset.value ?? { x: 0, y: 0 }
  drag = undefined
  dragging.value = false
  const dropped = { ...start, left: start.left + at.x, top: start.top + at.y }
  emit('move', nearestCorner(dropped, area))
  await settleInto(dropped)
}

/** The pill now sits in its new corner: start it where it was dropped and let it glide across (not at all with reduced motion). */
async function settleInto(dropped: Box): Promise<void> {
  await nextTick()
  const element = pill.value
  if (!element) return
  const now = element.getBoundingClientRect()
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced || (now.left === dropped.left && now.top === dropped.top)) {
    offset.value = undefined
    return
  }
  offset.value = { x: dropped.left - now.left, y: dropped.top - now.top }
  await nextTick()
  void element.offsetWidth
  gliding.value = true
  offset.value = { x: 0, y: 0 }
}

function onGlideEnd(): void {
  gliding.value = false
  offset.value = undefined
}

const NEXT_CORNER: Record<string, Partial<Record<ZoomPillCorner, ZoomPillCorner>>> = {
  ArrowLeft: { 'top-right': 'top-left', 'bottom-right': 'bottom-left' },
  ArrowRight: { 'top-left': 'top-right', 'bottom-left': 'bottom-right' },
  ArrowUp: { 'bottom-left': 'top-left', 'bottom-right': 'top-right' },
  ArrowDown: { 'top-left': 'bottom-left', 'top-right': 'bottom-right' },
}

/** The handle's keyboard move: an arrow key sends the pill to the corner next to it. */
function onHandleKey(event: KeyboardEvent, current: ZoomPillCorner): void {
  const next = NEXT_CORNER[event.key]?.[current]
  if (!next) return
  event.preventDefault()
  emit('move', next)
}
</script>

<template>
  <div
    ref="pill"
    class="zoom-pill"
    :class="{ 'zoom-pill--dragging': dragging, 'zoom-pill--gliding': gliding }"
    :style="offset ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : undefined"
    data-testid="zoom-pill"
    @transitionend.self="onGlideEnd"
  >
    <AppTooltip :text="t.canvas.zoomPillMoveLabel" :announce="false">
      <button
        class="ui-control zoom-pill__handle"
        type="button"
        :aria-label="t.canvas.zoomPillMoveLabel"
        data-testid="zoom-pill-handle"
        @pointerdown="onHandleDown"
        @pointermove="onHandleMove"
        @pointerup="onHandleUp"
        @pointercancel="onHandleUp"
        @keydown="onHandleKey($event, corner ?? 'bottom-right')"
      />
    </AppTooltip>
    <IconButton
      v-if="rulers !== undefined"
      icon="ruler"
      variant="plain"
      :icon-size="18"
      :label="t.canvas.rulersLabel"
      :selected="rulers"
      data-testid="zoom-pill-rulers"
      @click="emit('toggle-rulers')"
    />
    <IconButton icon="undo" variant="plain" :icon-size="18" shortcut="Ctrl/Cmd+Z" :label="t.palette.undoButton" :disabled="!canUndo" data-testid="zoom-pill-undo" data-tour="undo" @click="emit('undo')" />
    <IconButton icon="redo" variant="plain" :icon-size="18" shortcut="Ctrl/Cmd+Shift+Z" :label="t.palette.redoButton" :disabled="!canRedo" data-testid="zoom-pill-redo" @click="emit('redo')" />
    <IconButton
      v-if="progressBar !== undefined"
      icon="check"
      variant="plain"
      :icon-size="18"
      :label="t.canvas.progressBarLabel"
      :selected="progressBar"
      data-testid="zoom-pill-progress"
      @click="emit('toggle-progress-bar')"
    />
    <IconButton icon="zoom-out" variant="plain" :icon-size="18" :label="t.canvas.zoomOutLabel" data-testid="zoom-pill-out" @click="emit('zoom-out')" />
    <span class="zoom-pill__level" data-testid="zoom-pill-level">{{ zoomPercent }}%</span>
    <IconButton icon="zoom-in" variant="plain" :icon-size="18" :label="t.canvas.zoomInLabel" data-testid="zoom-pill-in" @click="emit('zoom-in')" />
    <IconButton icon="fit" variant="plain" :icon-size="18" :label="t.canvas.zoomResetLabel" data-testid="zoom-pill-fit" @click="emit('reset')" />
  </div>
</template>

<style scoped>
.zoom-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--canvas);
  border: 1px solid var(--line);
  border-radius: var(--radius-full);
  box-shadow: var(--elevation-1);
}

/* The card's own 36px, bigger than the reference tier's 30px zoom cluster buttons (control-height-plain). */
.zoom-pill :deep(.icon-btn--plain) {
  width: var(--zoom-pill-button);
  height: var(--zoom-pill-button);
}

/* The drag handle (ZoomPill card): six dots in a grip, at the pill's left end. A finger or a mouse can drag it without drawing or panning. */
.zoom-pill__handle {
  flex: none;
  width: var(--space-16);
  height: var(--zoom-pill-button);
  padding: 0;
  color: var(--muted);
  cursor: grab;
  touch-action: none;
  user-select: none;
  background: radial-gradient(circle, currentColor 1.25px, transparent 1.5px) center / 6px 6px;
  background-clip: content-box;
  border: 0;
  border-radius: var(--radius-full);
}

.zoom-pill--dragging,
.zoom-pill--dragging .zoom-pill__handle {
  cursor: grabbing;
}

/* Dragged: lifted off the canvas by a deeper shadow, and it follows the pointer without easing. */
.zoom-pill--dragging {
  box-shadow: var(--elevation-2);
  transition: none;
}

.zoom-pill--gliding {
  transition: transform var(--duration-base) var(--ease-out);
}

.zoom-pill__level {
  min-width: var(--zoom-level-width);
  font: var(--type-meta);
  color: var(--body);
  text-align: center;
}

:root[data-theme='contrast'] .zoom-pill {
  border-width: 2px;
  box-shadow: none;
}
</style>
