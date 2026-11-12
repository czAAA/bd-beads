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
import { reachLimit } from '../../rendering/handleSizes'
import { arrowMove, placeOnScreen, REFERENCE_TURN_OFFSET_PX, screenToGrid, type ReferenceView } from '../../rendering/referenceImage'
import AppHandle from '../ui/AppHandle.vue'
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
  /** While a corner is dragged, the beads the picture covers and their measure (ticket 0883). */
  size?: { beads: string; measure: string }
  /** The Frame's margin sheet on screen: the Turn handle stands below it where the picture lies under it (ticket 0883). */
  sheet?: { left: number; top: number; width: number; height: number }
}>()
const emit = defineEmits<{
  /** A drag as it goes, drawn but not saved. */
  preview: [place: ReferencePlace]
  /** A change to save, and what to announce of it. */
  commit: [place: ReferencePlace, announcement: string]
  done: []
  /** A handle is pressed or let go: the picture bar hides meanwhile (ticket 0883). */
  pressing: [on: boolean]
}>()

const { t } = useI18n()
const words = computed(() => t.value.referenceImage)
const rootEl = ref<HTMLElement>()
const groupEl = ref<HTMLElement>()

/** The press under way: what it works, where it started and the place it started from. */
const press = ref<{ kind: 'move' | 'turn' | ReferenceCorner; pointer: number; start: { x: number; y: number }; at: { x: number; y: number }; from: ReferencePlace; place: ReferencePlace }>()
const shown = computed(() => press.value?.place ?? props.place)
const onScreen = computed(() => placeOnScreen(props.view, shown.value, shown.value.width * props.aspect))

/** How far past the picture's edge the Turn handle stands below it: its offset, and on beyond the Frame's margin sheet
 * where the handle would land on it (ticket 0883). */
const turnReach = computed(() => {
  const { centre, height, angle } = onScreen.value
  const turn = radians(angle)
  const down = { x: -Math.sin(turn), y: Math.cos(turn) }
  const handle = height / 2 + REFERENCE_TURN_OFFSET_PX
  const sheet = props.sheet
  const at = { x: centre.x + down.x * handle, y: centre.y + down.y * handle }
  if (!sheet || down.y < 0.7 || at.x < sheet.left || at.x > sheet.left + sheet.width || at.y < sheet.top || at.y > sheet.top + sheet.height) return REFERENCE_TURN_OFFSET_PX
  return REFERENCE_TURN_OFFSET_PX + (sheet.top + sheet.height - at.y) / down.y + REFERENCE_TURN_OFFSET_PX / 2
})

/** The Turn handle stands below the picture's bottom edge (ticket 0883), or above its top edge where there is no room
 * below, so the top edge is free for the picture bar. */
const turnBelow = computed(() => {
  const { centre, height, angle } = onScreen.value
  const reach = height / 2 + turnReach.value
  const turn = radians(angle)
  const below = { x: centre.x - Math.sin(turn) * reach, y: centre.y + Math.cos(turn) * reach }
  const { width, height: tall } = props.view.viewport
  return below.x >= 0 && below.y >= 0 && below.x <= width && below.y <= tall
})
const stemStyle = computed(() => ({ height: `calc(${turnBelow.value ? turnReach.value : REFERENCE_TURN_OFFSET_PX}px - var(--reference-turn) / 2)` }))

/** The size chip beside the pointer while a corner is dragged (ticket 0883). */
const sizeChipStyle = computed(() => {
  const at = press.value?.at
  return at && { left: `${at.x + 16}px`, top: `${at.y + 16}px` }
})
const resizing = computed(() => !!press.value && press.value.kind !== 'move' && press.value.kind !== 'turn')

const pictureStyle = computed(() => {
  const { centre, width, height, angle } = onScreen.value
  return { left: `${centre.x}px`, top: `${centre.y}px`, width: `${width}px`, height: `${height}px`, transform: `translate(-50%, -50%) rotate(${angle}deg)` }
})

/** The diagonal resize cursor of a corner, as it points on screen once the picture is turned. */
const CORNER_DEGREES: Record<ReferenceCorner, number> = { 'top-left': 225, 'top-right': 315, 'bottom-right': 45, 'bottom-left': 135 }
const CURSORS = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize']
const cursorOf = (corner: ReferenceCorner) => CURSORS[Math.round((((CORNER_DEGREES[corner] + onScreen.value.angle) % 180) + 180) / 45) % 4]

/** A corner's reach on the picture as it is on screen (Handle card). */
const handleLimit = computed(() => reachLimit(onScreen.value))

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
  press.value = { kind, pointer: event.pointerId, start: local(event), at: local(event), from: props.place, place: props.place }
  emit('pressing', true)
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
  press.value = { ...pressed, place, at: local(event) }
  emit('preview', place)
}

function end(event: PointerEvent) {
  const pressed = press.value
  if (!pressed || event.pointerId !== pressed.pointer) return
  press.value = undefined
  emit('pressing', false)
  if (pressed.place === pressed.from) return
  emit('commit', pressed.place, announcementOf(pressed.kind === 'move' ? 'move' : pressed.kind === 'turn' ? 'turn' : 'resize', pressed.place))
}

function cancel() {
  const pressed = press.value
  press.value = undefined
  if (!pressed) return
  emit('pressing', false)
  emit('preview', pressed.from)
}

function announcementOf(change: 'move' | 'resize' | 'turn', place: ReferencePlace): string {
  if (change === 'turn') return fillBlanks(words.value.turned, { angle: Math.round(place.angle) })
  return change === 'move' ? words.value.moved : words.value.resized
}

/** An arrow moves the picture a bead the way it points on screen (Shift: ten); `+`/`−` resize it by a tenth, `[`/`]`
 * turn it 15°. */
function onKeydown(event: KeyboardEvent) {
  if (!props.adjusting) return
  const moved = arrowMove(props.view, props.bead, event)
  let change: { place: ReferencePlace; kind: 'move' | 'resize' | 'turn' } | undefined
  if (moved) {
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
      <AppHandle
        v-for="corner in REFERENCE_CORNERS"
        :key="corner"
        :place="corner"
        :hot="press?.kind === corner"
        :limit="handleLimit"
        class="reference-adjust__corner"
        :class="`reference-adjust__corner--${corner}`"
        tabindex="-1"
        :aria-label="words.corners[corner]"
        :style="{ cursor: cursorOf(corner) }"
        :data-testid="`reference-adjust-${corner}`"
        @pointerdown="begin($event, corner)"
      />
      <span class="reference-adjust__turn" :class="{ 'reference-adjust__turn--below': turnBelow }">
        <span class="reference-adjust__stem" :style="stemStyle" aria-hidden="true" />
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
    <div v-if="resizing && size && sizeChipStyle" class="reference-adjust__size" :style="sizeChipStyle" data-testid="reference-adjust-size">
      <span class="reference-adjust__size-beads">{{ size.beads }}</span>
      <span class="reference-adjust__size-measure">{{ size.measure }}</span>
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

/* A corner handle: the shared handle (Handle card) in `ink`, on the picture's corner, turned with it. */
.reference-adjust__corner {
  --handle-color: var(--ink);
}

.reference-adjust__corner--top-left {
  top: calc(-1 * var(--reference-outline));
  left: calc(-1 * var(--reference-outline));
}

.reference-adjust__corner--top-right {
  top: calc(-1 * var(--reference-outline));
  left: calc(100% + var(--reference-outline));
}

.reference-adjust__corner--bottom-right {
  top: calc(100% + var(--reference-outline));
  left: calc(100% + var(--reference-outline));
}

.reference-adjust__corner--bottom-left {
  top: calc(100% + var(--reference-outline));
  left: calc(-1 * var(--reference-outline));
}

/* The Turn handle on its dashed stem, below the bottom edge's middle (above the top edge where there is no room). */
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

/* The size while a corner is dragged (ticket 0883): the angle chip's look, beads over their measure. */
.reference-adjust__size {
  position: absolute;
  display: flex;
  flex-direction: column;
  padding: var(--space-4) var(--space-8);
  white-space: nowrap;
  background: var(--tooltip-fill);
  border-radius: var(--radius-sm);
  box-shadow: var(--elevation-3);
}

.reference-adjust__size-beads {
  font: var(--type-small);
  color: var(--ink);
}

.reference-adjust__size-measure {
  font: var(--type-meta-small);
  color: var(--muted);
}

.reference-adjust__stem {
  width: 0;
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
