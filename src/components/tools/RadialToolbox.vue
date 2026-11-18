<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { controlAction } from '../../composables/shell/controlRegistry'
import { ownLength } from '../../composables/ui/cssZoom'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { fillBlanks } from '../../domain/fillBlanks'
import { RADIAL_DIVIDERS, RADIAL_HOLE, RADIAL_PLACES, RADIAL_REACH, RADIAL_RING, RADIAL_ROOM, radialItemAt, radialItemOff, radialNameCenter, radialSliceOutline, type RadialItemId } from '../../domain/radialToolbox'
import type { Tool } from '../../domain/tool'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from '../ui/AppIcon.vue'
import IconButton from '../ui/IconButton.vue'

// The Radial toolbox (tickets 1063, 1064; ADR 0098; RadialToolbox card): a ring of ten actions round the pointer, each
// its existing control's name, icon and event. Drawn in the app shell, outside the canvas's zoom (ADR 0034); an overlay
// like the others (ADR 0061), its hole outside it.
const props = defineProps<{
  open: boolean
  /** The ring's centre on screen, in client px. */
  center: { x: number; y: number }
  /** The Tool whose tile is pressed, by the Tool pill's own rule; none while none is lit there. */
  activeTool?: Tool
  canUndo: boolean
  canRedo: boolean
  /** The recent colours the Tool pill shows, in its order; a missing one keeps its place and is off. */
  recents: readonly string[]
  /** The colour of the bead that was pressed; none on an empty position, where Pick color from Canvas is off. */
  beadHex?: string | null
  /** The item under the pointer a slide holds down, told by the ring's rule (ticket 1077): it wears the pressed look
   * and shows its name. */
  held?: RadialItemId
}>()

const emit = defineEmits<{
  /** What the Tool pill emits for a tool tile and a recent colour. */
  'select-tool': [tool: Tool]
  'pick-recent': [hex: string]
  /** Pick color from Canvas, on the bead that was pressed. */
  'pick-color': []
  /** What the Canvas strip's Undo and Redo do. */
  undo: []
  redo: []
  /** Escape or a press outside, the hole included. */
  close: []
}>()

const { t } = useI18n()

const rootEl = ref<HTMLElement>()

/** The ten items as they are drawn: each with its control's name and icon, whether it is off, and what its name says
 * after it (a colour's hex). */
const items = computed(() =>
  RADIAL_PLACES.map((place) => {
    if ('recent' in place) {
      const hex = props.recents[place.recent]
      const name = `${t.value.toolPill.recent} ${place.recent + 1}`
      return { place, hex, name, meta: hex, label: hex ? `${name}, ${fillBlanks(t.value.toolPill.useColor, { color: hex })}` : name, off: radialItemOff(place.id, props) }
    }
    const action = controlAction(place.id)
    const off = radialItemOff(place.id, props)
    const meta = place.id === 'pick-color' ? (props.beadHex ?? undefined) : undefined
    return { place, icon: action.icon, name: action.name(t.value), meta, off, lit: 'tool' in place ? place.tool === props.activeTool : undefined }
  }),
)

/** The band, its two rims and the dividers are drawn in the design system's px, about the ring's centre. */
const viewBox = `${-RADIAL_REACH} ${-RADIAL_REACH} ${2 * RADIAL_REACH} ${2 * RADIAL_REACH}`
/** A divider is half the band long, centred on the tiles' radius: the pill's divider turned. */
const dividerEnds = { from: -(RADIAL_RING.radius - RADIAL_RING.band / 4), to: -(RADIAL_RING.radius + RADIAL_RING.band / 4) }

/** An item's hit area: its slice of the band, cut out of a pad the ring's size, in percent of that pad. */
function sliceShape(id: RadialItemId): string {
  const half = 50
  const points = radialSliceOutline(id, (half * RADIAL_HOLE) / RADIAL_REACH, half)
  return `polygon(${points.map((point) => `${(half + point.x).toFixed(3)}% ${(half + point.y).toFixed(3)}%`).join(', ')})`
}
const sliceShapes = Object.fromEntries(RADIAL_PLACES.map((place) => [place.id, sliceShape(place.id)])) as Record<RadialItemId, string>

/** The ring is placed on screen and drawn in its own px, which CSS zoom draws larger (ticket 1071). */
const placeStyle = computed(() => ({ left: `${ownLength(rootEl.value, props.center.x)}px`, top: `${ownLength(rootEl.value, props.center.y)}px` }))

/** The item a mouse or a hovering pen is over, by the ring's rule; a finger has no hover. */
const hovered = ref<RadialItemId>()
/** The item whose look and name show: the one a held pointer is on, else the hovered one. */
const under = computed(() => props.held ?? hovered.value)
const named = computed(() => items.value.find((item) => item.place.id === under.value))

const nameEl = ref<HTMLElement>()
/** How far the name stands from over the ring's centre, in the ring's own px: the least that keeps it `float-edge`
 * inside the screen at each side, however long its language makes it (ticket 1076). */
const nameShift = ref(0)
function placeName() {
  const root = rootEl.value
  if (!root || !nameEl.value) return
  const center = ownLength(root, props.center.x)
  // `float-edge` in the ring's own px: its share of the ring's measured reach.
  const edge = (root.offsetWidth / 2) * (RADIAL_ROOM.edge / RADIAL_REACH)
  nameShift.value = radialNameCenter(center, nameEl.value.offsetWidth, ownLength(root, window.innerWidth), edge) - center
}
watch([named, () => props.center, () => props.open], placeName, { flush: 'post' })
onMounted(placeName)

function onPointerMove(event: PointerEvent) {
  if (event.pointerType === 'touch') return
  // The hole on screen: the ring's own share of its measured box.
  const hole = ((rootEl.value?.getBoundingClientRect().width ?? 0) / 2) * (RADIAL_HOLE / RADIAL_REACH)
  hovered.value = radialItemAt({ x: event.clientX - props.center.x, y: event.clientY - props.center.y }, hole)
}

/** The item just picked: it stays pressed while the ring leaves, the one thing that confirms the pick. */
const picked = ref<RadialItemId>()

watch(() => props.open, (open) => {
  if (!open) return
  hovered.value = undefined
  picked.value = undefined
})

/** A click or a tap on an item, or a screen reader's press of its button: its own control's event. An item that is
 * off does nothing. */
async function onClick(event: MouseEvent) {
  const id = (event.target as Element | null)?.closest<HTMLElement>('[data-radial-item]')?.dataset.radialItem
  const item = items.value.find((each) => each.place.id === id)
  if (!props.open || !item || item.off) return
  const { place } = item
  picked.value = place.id
  if ('tool' in place) emit('select-tool', place.tool)
  else if ('recent' in place) emit('pick-recent', item.hex!)
  else if (place.id === 'pick-color') emit('pick-color')
  else if (place.id === 'undo') emit('undo')
  else emit('redo')
  // Undo and Redo keep the ring open: nothing is left pressed for when it closes later.
  await nextTick()
  if (props.open) picked.value = undefined
}

useOverlayLayer({ isOpen: () => props.open, root: () => rootEl.value, close: () => emit('close') })
</script>

<template>
  <Transition name="radial-toolbox">
    <!-- A press on the ring must not take focus from where it was (RadialToolbox card), and the browser's menu stays shut. -->
    <div
      v-show="open"
      ref="rootEl"
      class="radial-toolbox"
      :style="placeStyle"
      role="toolbar"
      :aria-label="t.a11y.toolsLandmark"
      data-testid="radial-toolbox"
      @click="onClick"
      @mousedown.prevent
      @contextmenu.prevent
      @pointermove="onPointerMove"
      @pointerleave="hovered = undefined"
    >
      <svg class="radial-toolbox__band" :viewBox="viewBox" aria-hidden="true" focusable="false">
        <circle class="radial-toolbox__fill" :r="RADIAL_RING.radius" :stroke-width="RADIAL_RING.band" />
        <circle class="radial-toolbox__rim" :r="RADIAL_REACH - 0.5" />
        <circle class="radial-toolbox__rim" :r="RADIAL_HOLE + 0.5" />
        <line v-for="angle in RADIAL_DIVIDERS" :key="angle" class="radial-toolbox__divider" :y1="dividerEnds.from" :y2="dividerEnds.to" :transform="`rotate(${angle})`" />
      </svg>

      <span
        v-for="item in items"
        :key="item.place.id"
        class="radial-toolbox__place"
        :class="{
          'radial-toolbox__place--under': !item.off && under === item.place.id,
          'radial-toolbox__place--held': !item.off && held === item.place.id,
          'radial-toolbox__place--picked': picked === item.place.id,
        }"
        :style="{ '--radial-angle': `${item.place.angle}deg` }"
      >
        <button
          v-if="'hex' in item"
          type="button"
          class="ui-control radial-toolbox__recent"
          :aria-label="item.label"
          :aria-disabled="item.off ? 'true' : undefined"
          :tabindex="-1"
          :data-radial-item="item.place.id"
          :data-testid="`radial-${item.place.id}`"
        >
          <span class="radial-toolbox__swatch" :class="{ 'radial-toolbox__swatch--missing': item.off }" :style="{ backgroundColor: item.hex }" />
          <span class="radial-toolbox__slice" :style="{ clipPath: sliceShapes[item.place.id] }" />
        </button>
        <IconButton
          v-else
          variant="pill"
          :label="item.name"
          :disabled="item.off"
          :selected="item.lit"
          :accent="!!item.lit"
          :tabindex="-1"
          :data-radial-item="item.place.id"
          :data-testid="`radial-${item.place.id}`"
        >
          <AppIcon v-if="item.icon" :name="item.icon" :size="22" />
          <span class="radial-toolbox__slice" :style="{ clipPath: sliceShapes[item.place.id] }" />
        </IconButton>
      </span>

      <span v-if="named" ref="nameEl" class="radial-toolbox__name" :style="{ '--radial-name-shift': `${nameShift}px` }" aria-hidden="true" data-testid="radial-name">
        <strong class="radial-toolbox__name-text">{{ named.name }}</strong>
        <span v-if="named.meta" class="radial-toolbox__name-meta">{{ named.meta }}</span>
      </span>
    </div>
  </Transition>
</template>

<style scoped>
/* The ring's box is its outer edge, centred on the pressed point; only its band takes the pointer, so the Canvas shows
 * and is pressed through the hole. 216px across round a 120px hole (RadialToolbox card). */
.radial-toolbox {
  --pill-tile: calc(var(--pill-thickness) - 2 * var(--space-4));
  --radial-reach: calc(var(--radial-radius) + var(--pill-thickness) / 2);
  position: fixed;
  z-index: var(--z-popover);
  width: calc(2 * var(--radial-reach));
  height: calc(2 * var(--radial-reach));
  margin: calc(-1 * var(--radial-reach)) 0 0 calc(-1 * var(--radial-reach));
  pointer-events: none;
}

/* The band is one shape with a hole in the Tool pill's material, so its shadow is a filter, not a box's. */
.radial-toolbox__band {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  filter: var(--elevation-float-filter);
}

.radial-toolbox__fill {
  fill: none;
  stroke: var(--elevated);
}

.radial-toolbox__rim,
.radial-toolbox__divider {
  fill: none;
  stroke: var(--line);
  stroke-width: 1px;
  vector-effect: non-scaling-stroke;
}

.radial-toolbox__divider {
  stroke: var(--line-soft);
}

:root[data-theme='contrast'] .radial-toolbox__rim {
  stroke: var(--line-strong);
}

/* A tile stands upright with its centre on the tiles' radius, at its item's angle clockwise from straight up. */
.radial-toolbox__place {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  transform: translate(-50%, -50%) rotate(var(--radial-angle)) translateY(calc(-1 * var(--radial-radius))) rotate(calc(-1 * var(--radial-angle)));
}

.radial-toolbox__place :deep(.icon-btn),
.radial-toolbox__recent {
  pointer-events: auto;
}

/* An item's hit area is its slice (ticket 0962): a pad the ring's size, back on the ring's centre, cut to the slice.
 * It replaces the square touch pad, which would reach into the neighbours' slices. */
.radial-toolbox__slice {
  position: absolute;
  top: 50%;
  left: 50%;
  width: calc(2 * var(--radial-reach));
  height: calc(2 * var(--radial-reach));
  transform: translate(-50%, -50%) rotate(var(--radial-angle)) translateY(var(--radial-radius)) rotate(calc(-1 * var(--radial-angle)));
}

.radial-toolbox :deep(.ui-control::before) {
  content: none;
}

/* A recent colour: a round swatch on a tile the tools' size; a colour is round and a tool is a tile. */
.radial-toolbox__recent {
  position: relative;
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--pill-tile);
  height: var(--pill-tile);
  padding: 0;
  cursor: pointer;
  background: none;
  border: 0;
  border-radius: var(--radius-lg);
  transition: background-color var(--duration-fast) var(--ease-standard);
}

.radial-toolbox__recent[aria-disabled='true'] {
  cursor: not-allowed;
}

.radial-toolbox__swatch {
  box-sizing: border-box;
  width: var(--radial-swatch);
  height: var(--radial-swatch);
  border-radius: var(--radius-full);
  box-shadow: inset 0 0 0 1px var(--field-line);
}

/* A recent colour that does not exist yet keeps its place as a dashed ring. */
.radial-toolbox__swatch--missing {
  border: 1px dashed var(--line-strong);
  box-shadow: none;
}

/* Under a mouse: the tile's hover look. The active tool keeps its pressed look, as in the pill. */
.radial-toolbox__place--under :deep(.icon-btn:not(.icon-btn--selected)),
.radial-toolbox__place--under .radial-toolbox__recent {
  color: var(--ink);
  background: var(--hover-fill);
}

/* Under a held finger or Pencil, at a press, and on the picked tile while the ring leaves: one step stronger. */
.radial-toolbox__place--held :deep(.icon-btn),
.radial-toolbox__place--held .radial-toolbox__recent,
.radial-toolbox__recent:active:not([aria-disabled='true']),
.radial-toolbox-leave-active .radial-toolbox__place--picked :deep(.icon-btn),
.radial-toolbox-leave-active .radial-toolbox__place--picked .radial-toolbox__recent {
  color: var(--ink);
  background: var(--press-fill);
}

/* The name of the item under the pointer: the Tooltip's bubble, centred over the ring, or as near that as keeps it
 * `float-edge` inside the screen (ticket 1076). */
.radial-toolbox__name {
  position: absolute;
  bottom: calc(100% + var(--space-8));
  left: 50%;
  display: flex;
  gap: var(--space-8);
  align-items: baseline;
  box-sizing: border-box;
  width: max-content;
  max-width: min(var(--tooltip-max-width), calc(100vw - 2 * var(--float-edge)));
  padding: var(--space-6) var(--space-8);
  font: var(--type-small);
  line-height: var(--tooltip-line);
  color: var(--ink);
  background: var(--tooltip-fill);
  backdrop-filter: blur(var(--tooltip-blur));
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-sm);
  box-shadow: var(--elevation-3);
  transform: translateX(calc(-50% + var(--radial-name-shift, 0px)));
}

.radial-toolbox__name-text {
  font-weight: 700;
}

.radial-toolbox__name-meta {
  font: var(--type-meta-tiny);
  line-height: var(--tooltip-line);
  color: var(--tooltip-muted);
}

/* In: the colour popover's pop. Out: a fade, the ring taking no more presses. */
.radial-toolbox-enter-active {
  transition:
    opacity var(--duration-base) var(--ease-out),
    transform var(--duration-base) var(--ease-out);
}

.radial-toolbox-enter-from {
  opacity: 0;
  transform: scale(0.94);
}

.radial-toolbox-leave-active {
  transition: opacity var(--radial-out) var(--ease-in);
}

.radial-toolbox-leave-active :deep(.icon-btn),
.radial-toolbox-leave-active .radial-toolbox__recent {
  pointer-events: none;
}

.radial-toolbox-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .radial-toolbox-enter-from {
    transform: none;
  }

  .radial-toolbox-leave-active {
    transition-duration: var(--duration-fast);
  }
}
</style>
