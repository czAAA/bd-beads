<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { fillBlanks } from '../../domain/fillBlanks'
import {
  FINE_TURN_STEP,
  movedBy,
  radians,
  REFERENCE_CORNERS,
  resizedFromCorner,
  scaledBy,
  turnedBy,
  turnedToward,
  type OpacityStep,
  type ReferenceCorner,
  type ReferencePlace,
  type WidthLimits,
} from '../../domain/referenceImage'
import { useI18n } from '../../i18n/useI18n'
import { placeOnScreen, REFERENCE_TURN_OFFSET_PX, screenToGrid, type ReferenceView } from '../../rendering/referenceImage'
import AppIcon from '../ui/AppIcon.vue'

// The reference image's handles (ReferenceImage card, tickets 0790, 0799), in screen px: whenever it is shown a corner
// resizes it and the Turn handle turns it, any tool in hand; the picture itself takes no press. In Adjust the outline
// joins them: a drag inside moves it, the keys work, and Escape or a press outside ends it, as an overlay layer does.
const props = defineProps<{
  place: ReferencePlace
  /** The picture's height over its width. */
  aspect: number
  limits: WidthLimits
  opacity: OpacityStep
  /** The surface's view, which the picture's grid px are drawn through. */
  view: ReferenceView & { viewport: { width: number; height: number } }
  /** One bead across, in grid px: what an arrow key moves it. */
  bead: number
  /** Adjust is on: the outline, the move, the keys, and Escape or a press outside to end it. */
  adjusting: boolean
}>()
const emit = defineEmits<{
  /** A drag as it goes, drawn but not saved. */
  preview: [place: ReferencePlace]
  /** A change to save, and what to announce of it. */
  commit: [place: ReferencePlace, announcement: string]
  done: []
}>()

const { t } = useI18n()
const words = computed(() => t.value.referenceImage)
const rootEl = ref<HTMLElement>()
const groupEl = ref<HTMLElement>()

/** The press under way: what it works, where it started and the place it started from. */
const press = ref<{ kind: 'move' | 'turn' | ReferenceCorner; pointer: number; start: { x: number; y: number }; from: ReferencePlace; place: ReferencePlace }>()
const shown = computed(() => press.value?.place ?? props.place)
const onScreen = computed(() => placeOnScreen(props.view, shown.value, shown.value.width * props.aspect))

/** The Turn handle stands above the picture's top edge, or below its bottom edge where there is no room above. */
const turnBelow = computed(() => {
  const { centre, height, angle } = onScreen.value
  const reach = height / 2 + REFERENCE_TURN_OFFSET_PX
  const turn = radians(angle)
  const above = { x: centre.x + Math.sin(turn) * reach, y: centre.y - Math.cos(turn) * reach }
  const { width, height: tall } = props.view.viewport
  return above.x < 0 || above.y < 0 || above.x > width || above.y > tall
})

const pictureStyle = computed(() => {
  const { centre, width, height, angle } = onScreen.value
  return { left: `${centre.x}px`, top: `${centre.y}px`, width: `${width}px`, height: `${height}px`, transform: `translate(-50%, -50%) rotate(${angle}deg)` }
})

/** The diagonal resize cursor of a corner, as it points on screen once the picture is turned. */
const CORNER_DEGREES: Record<ReferenceCorner, number> = { 'top-left': 225, 'top-right': 315, 'bottom-right': 45, 'bottom-left': 135 }
const CURSORS = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize']
const cursorOf = (corner: ReferenceCorner) => CURSORS[Math.round((((CORNER_DEGREES[corner] + onScreen.value.angle) % 180) + 180) / 45) % 4]

const angleText = computed(() => `${Math.round(shown.value.angle)}°`)
const groupName = computed(() => fillBlanks(words.value.groupName, { opacity: props.opacity, angle: Math.round(props.place.angle) }))

/** A pointer's place on the drawing area, in its px. */
function local(event: PointerEvent): { x: number; y: number } {
  const box = rootEl.value?.getBoundingClientRect()
  return { x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0) }
}

function begin(event: PointerEvent, kind: 'move' | 'turn' | ReferenceCorner) {
  if (event.button !== 0 || (kind === 'move' && !props.adjusting)) return
  // A second finger is a pinch, which moves the view: the drag gives way and the picture goes back.
  if (press.value) {
    if (event.pointerId !== press.value.pointer) cancel()
    return
  }
  event.stopPropagation()
  ;(event.currentTarget as Element).setPointerCapture?.(event.pointerId)
  press.value = { kind, pointer: event.pointerId, start: local(event), from: props.place, place: props.place }
}

function drag(event: PointerEvent) {
  const pressed = press.value
  if (!pressed || event.pointerId !== pressed.pointer) return
  const point = screenToGrid(props.view, local(event))
  let place: ReferencePlace
  if (pressed.kind === 'move') {
    const start = screenToGrid(props.view, pressed.start)
    place = movedBy(pressed.from, point.x - start.x, point.y - start.y)
  } else if (pressed.kind === 'turn') {
    place = turnedToward(pressed.from, point, { below: turnBelow.value, fine: event.shiftKey })
  } else {
    place = resizedFromCorner(pressed.from, props.aspect, pressed.kind, point, props.limits)
  }
  press.value = { ...pressed, place }
  emit('preview', place)
}

function end(event: PointerEvent) {
  const pressed = press.value
  if (!pressed || event.pointerId !== pressed.pointer) return
  press.value = undefined
  if (pressed.place === pressed.from) return
  emit('commit', pressed.place, announcementOf(pressed.kind === 'move' ? 'move' : pressed.kind === 'turn' ? 'turn' : 'resize', pressed.place))
}

function cancel() {
  const pressed = press.value
  press.value = undefined
  if (pressed) emit('preview', pressed.from)
}

function announcementOf(change: 'move' | 'resize' | 'turn', place: ReferencePlace): string {
  if (change === 'turn') return fillBlanks(words.value.turned, { angle: Math.round(place.angle) })
  return change === 'move' ? words.value.moved : words.value.resized
}

/** An arrow moves the picture a bead the way it points on screen (Shift: ten); `+`/`−` resize it by a tenth, `[`/`]`
 * turn it 15°. */
function onKeydown(event: KeyboardEvent) {
  if (!props.adjusting) return
  const steps: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
  const step = steps[event.key]
  let change: { place: ReferencePlace; kind: 'move' | 'resize' | 'turn' } | undefined
  if (step) {
    const origin = props.view.gridToPoint(0, 0)
    const along = props.view.gridToPoint(1, 0)
    const reach = props.bead * (event.shiftKey ? 10 : 1) * Math.hypot(along.x - origin.x, along.y - origin.y)
    const moved = screenToGrid(props.view, { x: origin.x + step[0] * reach, y: origin.y + step[1] * reach })
    change = { place: movedBy(props.place, moved.x, moved.y), kind: 'move' }
  } else if (event.key === '+' || event.key === '=') {
    change = { place: scaledBy(props.place, 1.1, props.limits), kind: 'resize' }
  } else if (event.key === '-' || event.key === '_' || event.key === '−') {
    change = { place: scaledBy(props.place, 1 / 1.1, props.limits), kind: 'resize' }
  } else if (event.key === '[' || event.key === ']') {
    change = { place: turnedBy(props.place, event.key === ']' ? FINE_TURN_STEP : -FINE_TURN_STEP), kind: 'turn' }
  }
  if (!change) return
  event.preventDefault()
  event.stopPropagation()
  emit('commit', change.place, announcementOf(change.kind, change.place))
}

useOverlayLayer({
  isOpen: () => props.adjusting,
  root: () => groupEl.value,
  close: () => emit('done'),
  // Fit to Canvas and Done are the Adjust bar's, which is part of Adjust.
  keepsPress: (event) => event.target instanceof Element && event.target.closest('[data-testid="reference-adjust-bar"]') !== null,
})

const focus = () => groupEl.value?.focus({ preventScroll: true })
onMounted(() => props.adjusting && focus())
watch(
  () => props.adjusting,
  (adjusting) => adjusting && focus(),
  { flush: 'post' },
)
</script>

<template>
  <div ref="rootEl" class="reference-adjust" data-testid="reference-adjust">
    <div
      ref="groupEl"
      class="reference-adjust__picture"
      :class="{ 'reference-adjust__picture--moving': press?.kind === 'move', 'reference-adjust__picture--handles-only': !adjusting }"
      :style="pictureStyle"
      role="group"
      :aria-label="groupName"
      :tabindex="adjusting ? 0 : undefined"
      data-testid="reference-adjust-picture"
      @pointerdown="begin($event, 'move')"
      @pointermove="drag"
      @pointerup="end"
      @pointercancel="cancel"
      @keydown="onKeydown"
    >
      <button
        v-for="corner in REFERENCE_CORNERS"
        :key="corner"
        class="reference-adjust__corner"
        :class="`reference-adjust__corner--${corner}`"
        type="button"
        tabindex="-1"
        :aria-label="words.corners[corner]"
        :style="{ cursor: cursorOf(corner) }"
        :data-testid="`reference-adjust-${corner}`"
        @pointerdown="begin($event, corner)"
      />
      <span class="reference-adjust__turn" :class="{ 'reference-adjust__turn--below': turnBelow }">
        <span class="reference-adjust__stem" aria-hidden="true" />
        <button
          class="reference-adjust__turn-handle"
          :class="{ 'reference-adjust__turn-handle--active': press?.kind === 'turn' }"
          type="button"
          tabindex="-1"
          :aria-label="words.turn"
          data-testid="reference-adjust-turn"
          @pointerdown="begin($event, 'turn')"
        >
          <AppIcon name="rotate" :size="12" />
        </button>
        <span v-if="press?.kind === 'turn'" class="reference-adjust__angle" data-testid="reference-adjust-angle">{{ angleText }}</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
/* Over the drawing area; only the picture and its handles take a press. */
.reference-adjust {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.reference-adjust__picture {
  position: absolute;
  box-sizing: border-box;
  border: var(--reference-outline) solid var(--ink);
  cursor: grab;
  pointer-events: auto;
  touch-action: none;
}

/* Outside Adjust only the handles stand on the picture: no outline over the beads, and a press on it is the tool's. */
.reference-adjust__picture--handles-only {
  border-color: transparent;
  pointer-events: none;
}

.reference-adjust__corner,
.reference-adjust__turn-handle {
  pointer-events: auto;
}

.reference-adjust__picture--moving {
  cursor: grabbing;
}

.reference-adjust__picture:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

/* A corner handle: the Frame's resize handle, standing off the corner, grabbed within 14px (44px on touch). */
.reference-adjust__corner {
  --offset: var(--reference-handle-offset);
  position: absolute;
  box-sizing: border-box;
  width: var(--reference-handle-hit);
  height: var(--reference-handle-hit);
  padding: 0;
  background: none;
  border: 0;
  transform: translate(-50%, -50%);
  touch-action: none;
}

.reference-adjust__corner::before {
  position: absolute;
  inset: calc((var(--reference-handle-hit) - var(--reference-handle)) / 2);
  content: '';
  background: var(--canvas);
  border: var(--reference-outline) solid var(--ink);
  border-radius: var(--radius-xs);
}

@media (pointer: coarse) {
  .reference-adjust__corner {
    --offset: var(--reference-handle-offset-touch);
    width: var(--touch-target);
    height: var(--touch-target);
  }

  .reference-adjust__corner::before {
    inset: calc((var(--touch-target) - var(--reference-handle)) / 2);
  }
}

.reference-adjust__corner--top-left {
  top: calc(-1 * var(--offset));
  left: calc(-1 * var(--offset));
}

.reference-adjust__corner--top-right {
  top: calc(-1 * var(--offset));
  left: calc(100% + var(--offset));
}

.reference-adjust__corner--bottom-right {
  top: calc(100% + var(--offset));
  left: calc(100% + var(--offset));
}

.reference-adjust__corner--bottom-left {
  top: calc(100% + var(--offset));
  left: calc(-1 * var(--offset));
}

/* The Turn handle on its dashed stem, above the top edge's middle (below the bottom edge where there is no room). */
.reference-adjust__turn {
  position: absolute;
  bottom: 100%;
  left: 50%;
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  transform: translateX(-50%);
}

.reference-adjust__turn--below {
  top: 100%;
  bottom: auto;
  flex-direction: column;
}

.reference-adjust__stem {
  width: 0;
  height: calc(var(--frame-control-offset) - var(--reference-turn) / 2);
  border-left: var(--reference-outline) dashed var(--ink);
}

.reference-adjust__turn-handle {
  display: grid;
  place-items: center;
  box-sizing: border-box;
  width: var(--reference-turn);
  height: var(--reference-turn);
  padding: 0;
  color: var(--ink);
  background: var(--canvas);
  border: var(--reference-outline) solid var(--ink);
  border-radius: var(--radius-full);
  cursor: grab;
  touch-action: none;
}

.reference-adjust__turn-handle--active {
  color: var(--on-accent);
  background: var(--accent);
  cursor: grabbing;
}

@media (pointer: coarse) {
  .reference-adjust__turn-handle {
    box-shadow: 0 0 0 calc((var(--touch-target) - var(--reference-turn)) / 2) transparent;
  }
}

/* The angle while the Turn handle is dragged, in the Tooltip's look. */
.reference-adjust__angle {
  position: absolute;
  left: calc(100% + var(--space-8));
  padding: var(--space-2) var(--space-6);
  font: var(--type-meta-small);
  color: var(--ink);
  white-space: nowrap;
  background: var(--tooltip-fill);
  border-radius: var(--radius-sm);
  box-shadow: var(--elevation-3);
}
</style>
