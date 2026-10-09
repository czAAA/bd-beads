<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import { MAX_ZOOM_PERCENT, MIN_ZOOM_PERCENT } from '../../domain/grid'
import { DEFAULT_ZOOM_PILL_PLACEMENT, ZOOM_PILL_NUDGE_PX, clampOffset, nudgedPlacement, placementOf, type Box, type ZoomPillPlacement } from '../../domain/zoomPillPlacement'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import type { Project } from '../../domain/project'
import IconButton from '../ui/IconButton.vue'

/**
 * The design system's ZoomPill (ticket 79; ZoomPill card): the phone's zoom control, floating over the Project
 * (rulers · undo · redo · Row progress · out · level · in · fit; ticket 296) -- pinch zooms and two fingers pan, so this is for a fit or an exact
 * step. Same zoom (useProjectZoom) as the reference tier's CanvasStrip zoom cluster (ZoomControls.vue): a `canvas`
 * pill instead of the strip's plain buttons.
 *
 * Dragging it from anywhere (ticket 297; 302 took the handle away) moves it anywhere inside its positioned parent, the
 * canvas box's drawing area, once the pointer is past DRAG_THRESHOLD_PX, and on release it stays where it was dropped
 * (ticket 321), which the parent keeps (`move`). Alt + an arrow key nudges it from the keyboard. The parent places the
 * pill from `placement` (CSS `--zoom-pill-x` / `--zoom-pill-y`); this component only owns the drag's own offset.
 */
const props = defineProps<{ placement?: ZoomPillPlacement; zoomPercent: number; rulers?: boolean; project?: Project; canUndo?: boolean; canRedo?: boolean }>()
const emit = defineEmits<{
  'zoom-in': []
  'zoom-out': []
  reset: []
  'toggle-rulers': []
  /** The Progress bar's switch too (`P`): one Row progress action, so turning it on shows the bar and off hides it. */
  'toggle-row-progress': [enabled: boolean]
  undo: []
  redo: []
  move: [placement: ZoomPillPlacement]
}>()
const { t } = useI18n()

/** Every button is a registry action, so its name, Tooltip, key and disabled reason come from there (ADR 0035). */
const actions = {
  rulers: controlAction('rulers'),
  undo: controlAction('undo'),
  redo: controlAction('redo'),
  rowProgress: controlAction('row-progress'),
  zoomOut: controlAction('zoom-out'),
  zoomIn: controlAction('zoom-in'),
  zoomFit: controlAction('zoom-fit'),
}
const deps = computed(() => controlDeps({ activeProject: () => props.project, canUndo: () => !!props.canUndo, canRedo: () => !!props.canRedo }))

const pill = ref<HTMLElement>()
const offset = ref<{ x: number; y: number }>()
const dragging = ref(false)
const announcement = ref('')
/** The pointer is down on the pill; `moved` once it has gone past DRAG_THRESHOLD_PX and the pill follows it. */
let drag: { pointerId: number; startX: number; startY: number; pill: Box; area: Box; moved: boolean } | undefined
/** Set by a drag's release, so the click the browser may still send to the button under the pointer is dropped. */
let swallowClick = false

/** How far a press travels before it is a drag, not a tap (ticket 302). */
const DRAG_THRESHOLD_PX = 6

const toBox = (rect: DOMRect): Box => ({ left: rect.left, top: rect.top, width: rect.width, height: rect.height })

function onPointerDown(event: PointerEvent): void {
  const element = pill.value
  const area = element?.offsetParent
  if (!element || !area || drag || (event.pointerType === 'mouse' && event.button !== 0)) return
  drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, pill: toBox(element.getBoundingClientRect()), area: toBox(area.getBoundingClientRect()), moved: false }
  swallowClick = false
}

function onPointerMove(event: PointerEvent): void {
  if (!drag || event.pointerId !== drag.pointerId) return
  const dx = event.clientX - drag.startX
  const dy = event.clientY - drag.startY
  if (!drag.moved) {
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
    // Captured only now, so a tap still reaches the button under it.
    pill.value?.setPointerCapture?.(event.pointerId)
    drag.moved = true
    dragging.value = true
  }
  offset.value = clampOffset(drag.pill, drag.area, dx, dy)
}

async function onPointerUp(event: PointerEvent): Promise<void> {
  if (!drag || event.pointerId !== drag.pointerId) return
  const { pill: start, area, moved } = drag
  drag = undefined
  if (!moved) return
  const at = offset.value ?? { x: 0, y: 0 }
  dragging.value = false
  swallowClick = true
  setTimeout(() => (swallowClick = false))
  emit('move', placementOf({ ...start, left: start.left + at.x, top: start.top + at.y }, area))
  // The parent now places the pill where it was dropped, so the drag's offset is done with.
  await nextTick()
  offset.value = undefined
}

/** A drag that began on a button never presses it. */
function onClickCapture(event: MouseEvent): void {
  if (!swallowClick) return
  swallowClick = false
  event.stopPropagation()
  event.preventDefault()
}

const NUDGES: Record<string, [number, number]> = {
  ArrowLeft: [-ZOOM_PILL_NUDGE_PX, 0],
  ArrowRight: [ZOOM_PILL_NUDGE_PX, 0],
  ArrowUp: [0, -ZOOM_PILL_NUDGE_PX],
  ArrowDown: [0, ZOOM_PILL_NUDGE_PX],
}

/** The keyboard move: Alt + an arrow key, with focus anywhere in the pill, nudges it a step, never out of the canvas box. */
function onKeydown(event: KeyboardEvent): void {
  const element = pill.value
  const area = element?.offsetParent
  const nudge = NUDGES[event.key]
  if (!event.altKey || !nudge || !element || !area) return
  event.preventDefault()
  announcement.value = ''
  void nextTick(() => (announcement.value = t.value.canvas.zoomPillMovedAnnouncement))
  emit('move', nudgedPlacement(toBox(element.getBoundingClientRect()), toBox(area.getBoundingClientRect()), nudge[0], nudge[1]))
}
</script>

<template>
  <div
    ref="pill"
    class="zoom-pill"
    :class="{ 'zoom-pill--dragging': dragging }"
    :style="{ '--zoom-pill-x': (placement ?? DEFAULT_ZOOM_PILL_PLACEMENT).x, '--zoom-pill-y': (placement ?? DEFAULT_ZOOM_PILL_PLACEMENT).y, transform: offset ? `translate(${offset.x}px, ${offset.y}px)` : undefined }"
    data-testid="zoom-pill"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @click.capture="onClickCapture"
    @keydown="onKeydown"
  >
    <span class="zoom-pill__announcer" role="status" aria-live="polite" data-testid="zoom-pill-announcer">{{ announcement }}</span>
    <IconButton v-if="rulers !== undefined" variant="plain" :icon-size="18" :action="actions.rulers" :deps="deps" :selected="rulers" data-testid="zoom-pill-rulers" @click="emit('toggle-rulers')" />
    <IconButton variant="plain" :icon-size="18" :action="actions.undo" :deps="deps" data-testid="zoom-pill-undo" data-tour="undo" @click="emit('undo')" />
    <IconButton variant="plain" :icon-size="18" :action="actions.redo" :deps="deps" data-testid="zoom-pill-redo" @click="emit('redo')" />
    <IconButton
      v-if="project"
      variant="plain"
      :icon-size="18"
      :action="actions.rowProgress"
      :deps="deps"
      :selected="project.rowProgress.enabled"
      data-testid="zoom-pill-progress"
      @click="emit('toggle-row-progress', !project.rowProgress.enabled)"
    />
    <IconButton variant="plain" :icon-size="18" :action="actions.zoomOut" :disabled="props.zoomPercent <= MIN_ZOOM_PERCENT" :disabled-body="t.tooltips.zoomOutLimit" data-testid="zoom-pill-out" @click="emit('zoom-out')" />
    <span class="zoom-pill__level" data-testid="zoom-pill-level">{{ zoomPercent }}%</span>
    <IconButton variant="plain" :icon-size="18" :action="actions.zoomIn" :disabled="props.zoomPercent >= MAX_ZOOM_PERCENT" :disabled-body="t.tooltips.zoomInLimit" data-testid="zoom-pill-in" @click="emit('zoom-in')" />
    <IconButton variant="plain" :icon-size="18" :action="actions.zoomFit" data-testid="zoom-pill-fit" @click="emit('reset')" />
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

/* A finger, the Pencil or a mouse can drag it from anywhere without drawing, panning or selecting text. */
.zoom-pill {
  touch-action: none;
  user-select: none;
}

.zoom-pill__announcer {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.zoom-pill--dragging,
.zoom-pill--dragging :deep(button) {
  cursor: grabbing;
}

/* No Tooltip over the button under a dragged pill. */
.zoom-pill--dragging :deep(.app-tooltip__bubble) {
  display: none !important;
}

/* Dragged: lifted off the canvas by a deeper shadow. */
.zoom-pill--dragging {
  box-shadow: var(--elevation-2);
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
