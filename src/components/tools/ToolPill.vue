<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { controlAction } from '../../composables/shell/controlRegistry'
import { useElementSize } from '../../composables/ui/useElementSize'
import { useRovingFocus } from '../../composables/ui/useRovingFocus'
import { useToolPillDrag } from '../../composables/tools/useToolPillDrag'
import { PILL_POSITIONS, isVerticalPill, pillPositionForKey, type PillPosition, type PillRect } from '../../domain/toolPill'
import type { Tool } from '../../domain/tool'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from '../ui/AppIcon.vue'
import IconButton from '../ui/IconButton.vue'
import { markOn } from '../ui/swatchMark'
import ColorPopover from './ColorPopover.vue'
import { PASTE_TILE_HOTKEY, PILL_TOOLS, TOOL_HOTKEYS } from './toolIcons'

// The Tool pill (ticket 439, ADR 0059; ToolPill card): the tools floating over the drawing area, replacing the Dock:
// grip, six tool tiles, a divider, the colour control. It docks to one of four edges (drag, or the grip's arrow keys).
// This layer takes no pointer events itself and sits outside the canvas's zoom transform (ADR 0034).
const props = defineProps<{
  activeTool: Tool
  /** Whether the clipboard holds something: the Paste tile follows Hand then (ticket 447). */
  hasClipboard?: boolean
  /** Whether paste mode is on: the Paste tile then shows as the active tool. */
  pasteArmed?: boolean
  position: PillPosition
  /** The chosen colour's hex and name; none while no colour is chosen. */
  colorHex?: string
  colorName?: string
  /** The colours used before the chosen one, newest first: what the pill shows beside it. */
  recentsInPill: readonly string[]
  /** The colours the popover offers back. */
  recentsInPopover: readonly string[]
  popoverOpen: boolean
  selectedColorId?: string
  customColor?: string
}>()

const emit = defineEmits<{
  'select-tool': [tool: Tool]
  /** The Paste tile was pressed: enter paste mode, stamp nothing (ticket 447). */
  'paste-mode': []
  'update:position': [position: PillPosition]
  'update:popoverOpen': [open: boolean]
  'pick-recent': [hex: string]
  'select-color': [colorId: string]
  'select-custom-color': [hex: string]
  /** Where the pill is in the drawing area's pixels (undefined when it cannot be measured): the Selection bar keeps
   * clear of it. */
  rect: [rect: PillRect | undefined]
}>()

const { t } = useI18n()

const layerEl = ref<HTMLElement>()
const pillEl = ref<HTMLElement>()
const colorTileEl = ref<HTMLElement>()

const vertical = computed(() => isVerticalPill(props.position))
const tiles = PILL_TOOLS.map((tool) => ({ tool, action: controlAction(`tool-${tool}`), key: TOOL_HOTKEYS[tool] }))
const pasteAction = controlAction('tool-paste')
/** Paste mode runs under Select, but the Paste tile is the one lit then (ticket 447). */
const isActive = (tool: Tool) => props.activeTool === tool && !(tool === 'select' && props.pasteArmed && props.hasClipboard)
const colorAction = controlAction('pill-colors')
const colorLabel = computed(() => t.value.toolPill.color.replace('{name}', props.colorName ?? ''))

/** The tool tiles and the colour control are one Tab stop (the active tool); the arrows move along them. */
const roving = useRovingFocus(pillEl, '.tool-pill__stop')

const drag = useToolPillDrag(pillEl, layerEl, {
  onStart: () => emit('update:popoverOpen', false),
  onDrop: (position) => emit('update:position', position),
})

const pillStyle = computed(() => (drag.dragging.value ? { left: `${drag.corner.value.left}px`, top: `${drag.corner.value.top}px` } : undefined))

/** The grip's arrow keys send the pill to that edge. */
function onGripKeydown(event: KeyboardEvent) {
  const next = pillPositionForKey(event.key)
  if (!next) return
  event.preventDefault()
  event.stopPropagation()
  emit('update:position', next)
}

function toggleColor() {
  emit('update:popoverOpen', !props.popoverOpen)
}

/** The pill's rectangle in the layer's own pixels (the drawing area's), for the Selection bar to keep clear of. */
function measure(): PillRect | undefined {
  const pill = pillEl.value?.getBoundingClientRect()
  const layer = layerEl.value?.getBoundingClientRect()
  return pill && layer && pill.width > 0 ? { left: pill.left - layer.left, top: pill.top - layer.top, width: pill.width, height: pill.height } : undefined
}

// The pill shows the recents only while the whole pill fits along its edge (ticket 439), else the one swatch
// rather than scroll. Fit is probed by drawing the recents and asking the pill if it overflows, before the browser
// paints.
const recentsRoom = ref(true)
const probing = ref(false)
const showRecents = computed(() => recentsRoom.value || probing.value)
let latestProbe = 0
async function probeRoom() {
  if (drag.dragging.value) return
  const probe = ++latestProbe
  probing.value = true
  await nextTick()
  if (probe !== latestProbe) return // a newer probe owns the measuring now
  const el = pillEl.value
  // Where the last tile ends, not `scrollWidth`: a tile's touch target reaches past the pill's edge and would count as
  // overflow. One pixel of slack for sub-pixel rounding.
  const last = el?.lastElementChild
  if (el && last) {
    const box = el.getBoundingClientRect()
    const tile = last.getBoundingClientRect()
    recentsRoom.value = vertical.value ? tile.bottom <= box.bottom - el.clientTop + 1 : tile.right <= box.right - el.clientLeft + 1
  }
  probing.value = false
}
const pillSize = useElementSize(pillEl)
const layerSize = useElementSize(layerEl)
// Everything that changes the pill's length or its edge's: the layer, the edge, the recents it holds, whether
// a chosen colour exists, and a drag ending.
watch(
  [layerSize.width, layerSize.height, () => props.position, () => props.recentsInPill.length, () => props.hasClipboard, () => props.colorHex === undefined, drag.dragging],
  () => void probeRoom(),
  { immediate: true, flush: 'post' },
)
watch(
  [pillSize.width, pillSize.height, layerSize.width, layerSize.height, () => props.position],
  () => void nextTick(() => emit('rect', measure())),
  { immediate: true },
)
</script>

<template>
  <div ref="layerEl" class="tool-pill-layer" data-testid="tool-pill-layer">
    <div v-if="drag.dragging.value" class="tool-pill-zones" aria-hidden="true" data-testid="tool-pill-zones">
      <span
        v-for="edge in PILL_POSITIONS"
        :key="edge"
        class="tool-pill-zone"
        :class="[`tool-pill-zone--${edge}`, { 'tool-pill-zone--near': drag.nearest.value === edge }]"
        :data-testid="`tool-pill-zone-${edge}`"
      />
    </div>

    <div
      ref="pillEl"
      class="tool-pill"
      :class="[`tool-pill--${position}`, { 'tool-pill--vertical': vertical, 'tool-pill--lifted': drag.dragging.value }]"
      :style="pillStyle"
      role="toolbar"
      :aria-label="t.a11y.toolsLandmark"
      :aria-orientation="vertical ? 'vertical' : 'horizontal'"
      data-tool-pill
      data-testid="tool-pill"
      :data-position="position"
      @pointerdown="drag.onPointerDown"
      @keydown="roving.onKeydown"
    >
      <button
        type="button"
        class="ui-control tool-pill__grip"
        :aria-label="t.toolPill.move"
        data-testid="tool-pill-grip"
        @keydown="onGripKeydown"
      >
        <span class="tool-pill__grip-bar" />
      </button>

      <IconButton
        v-for="tile in tiles"
        :key="tile.tool"
        class="tool-pill__stop"
        variant="pill"
        :action="tile.action"
        :tooltip="{ placement: vertical ? undefined : position === 'top' ? 'bottom' : 'top' }"
        :hotkey="tile.key"
        show-hotkey
        :selected="isActive(tile.tool)"
        :accent="isActive(tile.tool)"
        :tabindex="roving.tabIndexFor(isActive(tile.tool))"
        :data-testid="`pill-tool-${tile.tool}`"
        @click="emit('select-tool', tile.tool)"
      />

      <IconButton
        v-if="hasClipboard"
        class="tool-pill__stop"
        variant="pill"
        :action="pasteAction"
        :tooltip="{ placement: vertical ? undefined : position === 'top' ? 'bottom' : 'top' }"
        :hotkey="PASTE_TILE_HOTKEY"
        show-hotkey
        :selected="!!pasteArmed"
        :accent="!!pasteArmed"
        :tabindex="roving.tabIndexFor(!!pasteArmed)"
        data-testid="pill-tool-paste"
        @click="emit('paste-mode')"
      />

      <span class="tool-pill__divider" role="presentation" />

      <IconButton
        :ref="(component) => (colorTileEl = (component as { $el?: HTMLElement } | null)?.$el?.querySelector('button') ?? undefined)"
        class="tool-pill__stop"
        variant="pill"
        :action="colorAction"
        :label="colorLabel"
        icon="palette"
        :tooltip="{ placement: vertical ? undefined : position === 'top' ? 'bottom' : 'top' }"
        :selected="popoverOpen"
        :aria-pressed="undefined"
        :aria-expanded="popoverOpen"
        :tabindex="-1"
        data-testid="pill-color"
        @click="toggleColor"
      >
        <span class="tool-pill__swatch" :style="{ backgroundColor: colorHex ?? 'transparent' }">
          <AppIcon name="palette" :size="14" :class="['tool-pill__swatch-mark', colorHex && `tool-pill__swatch-mark--${markOn(colorHex)}`]" />
        </span>
      </IconButton>

      <template v-if="showRecents">
        <button
          v-for="hex in recentsInPill"
          :key="hex"
          type="button"
          class="ui-control tool-pill__stop tool-pill__recent"
          :aria-label="t.toolPill.useColor.replace('{color}', hex)"
          :tabindex="-1"
          data-testid="pill-recent"
          @click="emit('pick-recent', hex)"
        >
          <span class="tool-pill__recent-swatch" :style="{ backgroundColor: hex }" />
        </button>
      </template>

    </div>

    <ColorPopover
      v-if="popoverOpen"
      :tile="colorTileEl"
      :pill="pillEl"
      :position="position"
      :color-hex="colorHex"
      :color-name="colorName"
      :selected-color-id="selectedColorId"
      :custom-color="customColor"
      :recents="recentsInPopover"
      @close="emit('update:popoverOpen', false)"
      @pick-recent="emit('pick-recent', $event)"
      @select-color="emit('select-color', $event)"
      @select-custom-color="emit('select-custom-color', $event)"
    />
  </div>
</template>

<style scoped>
/* The layer is the drawing area, transparent to pointers; only the pill takes them. 48px (`pill-thickness`) = 40px
 * tiles in 4px padding, 2px apart. */
.tool-pill-layer {
  --pill-tile: calc(var(--pill-thickness) - 2 * var(--space-4));
  --pill-pad: var(--space-4);
  --pill-between: var(--space-2);
  --pill-icon: calc(var(--space-20) + var(--space-2));
  position: absolute;
  inset: 0;
  z-index: var(--z-canvas-overlay);
  pointer-events: none;
}

.tool-pill {
  position: absolute;
  display: flex;
  align-items: center;
  gap: var(--pill-between);
  box-sizing: border-box;
  padding: var(--pill-pad);
  /* A pill longer than its edge scrolls along its length, with no scrollbar (like the Canvas strip). */
  overflow: auto;
  scrollbar-width: none;
  pointer-events: auto;
  touch-action: pan-x;
  background: var(--elevated);
  border: 1px solid var(--line);
  border-radius: var(--radius-full);
  box-shadow: var(--elevation-2);
}

.tool-pill::-webkit-scrollbar {
  display: none;
}

.tool-pill--bottom,
.tool-pill--top {
  left: 50%;
  /* As long as its content, up to the edge gaps: a box placed at `left: 50%` would otherwise be sized to half its
   * layer (ticket 461). */
  width: max-content;
  max-width: calc(100% - 2 * var(--pill-gap));
  transform: translateX(-50%);
}

.tool-pill--bottom {
  bottom: var(--pill-gap);
}

.tool-pill--top {
  top: var(--pill-gap);
}

.tool-pill--vertical {
  flex-direction: column;
  top: 50%;
  height: max-content;
  max-height: calc(100% - 2 * var(--pill-gap));
  touch-action: pan-y;
  transform: translateY(-50%);
}

.tool-pill--left {
  left: var(--pill-gap);
}

.tool-pill--right {
  right: var(--pill-gap);
}

/* Lifted: it follows the pointer from its own top-left corner, with a deeper shadow, taking no fixed edge. */
.tool-pill--lifted {
  top: auto;
  right: auto;
  bottom: auto;
  width: max-content;
  height: auto;
  max-width: none;
  max-height: none;
  cursor: grabbing;
  transform: none;
  box-shadow: var(--elevation-3);
}

/* The grip: 18 x 40px (40 x 18px vertical) with a 4 x 22px bar; the cursor is `grab` here. */
.tool-pill__grip {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--pill-grip);
  height: var(--pill-tile);
  padding: 0;
  cursor: grab;
  background: none;
  border: 0;
  border-radius: var(--radius-lg);
  touch-action: none;
}

.tool-pill-layer {
  --pill-grip: calc(var(--space-16) + var(--space-2));
}

.tool-pill--vertical .tool-pill__grip {
  width: var(--pill-tile);
  height: var(--pill-grip);
}

.tool-pill__grip-bar {
  width: var(--space-4);
  height: var(--pill-icon);
  background: var(--line-strong);
  border-radius: var(--radius-full);
}

.tool-pill--vertical .tool-pill__grip-bar {
  width: var(--pill-icon);
  height: var(--space-4);
}

.tool-pill__grip:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

/* A divider: 1px, 24px long, 4px margin, across the pill's length. */
.tool-pill__divider {
  flex: none;
  width: 1px;
  height: var(--space-24);
  margin: 0 var(--space-4);
  background: var(--line-soft);
}

.tool-pill--vertical .tool-pill__divider {
  width: var(--space-24);
  height: 1px;
  margin: var(--space-4) 0;
}

/* The chosen colour: a 22px round swatch, ringed with a 2px gap in the pill's fill. */
.tool-pill__swatch {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: var(--pill-icon);
  height: var(--pill-icon);
  border-radius: var(--radius-full);
  box-shadow: 0 0 0 var(--space-2) var(--elevated), 0 0 0 calc(2 * var(--space-2)) var(--ring);
}

/* The palette icon sits inside the swatch, in the mark that reads on the chosen colour (or the muted ink while none
 * is chosen). */
.tool-pill__swatch-mark {
  color: var(--muted);
}

.tool-pill__swatch-mark--dark {
  color: var(--swatch-mark-dark);
}

.tool-pill__swatch-mark--light {
  color: var(--swatch-mark-light);
}

/* Recents: 18px swatches on tiles 30px long and 40px across (30px tall when vertical). */
.tool-pill__recent {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  padding: 0;
  color: var(--muted);
  background: none;
  border: 0;
  border-radius: var(--radius-lg);
}

.tool-pill__recent {
  width: calc(var(--space-32) - var(--space-2));
  height: var(--pill-tile);
}

.tool-pill--vertical .tool-pill__recent {
  width: var(--pill-tile);
  height: calc(var(--space-32) - var(--space-2));
}

.tool-pill__recent-swatch {
  width: calc(var(--space-16) + var(--space-2));
  height: calc(var(--space-16) + var(--space-2));
  border-radius: var(--radius-full);
  box-shadow: inset 0 0 0 1px var(--swatch-edge);
}

@media (hover: hover) {
  .tool-pill__recent:hover {
    color: var(--ink);
    background: var(--hover-fill);
  }
}

.tool-pill__recent:active {
  background: var(--press-fill);
}

.tool-pill__recent:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

/* The four drop zones inside the drawing area while dragging: dashed, the nearest edge's in the accent with a 14%
 * wash. */
.tool-pill-zones {
  position: absolute;
  inset: 0;
}

.tool-pill-zone {
  position: absolute;
  box-sizing: border-box;
  border: 2px dashed var(--line-strong);
  border-radius: var(--radius-full);
  transition: background var(--duration-slow) var(--ease-standard);
}

.tool-pill-zone--bottom,
.tool-pill-zone--top {
  left: 50%;
  width: calc(var(--pill-thickness) * 5);
  max-width: calc(100% - 2 * var(--pill-gap));
  height: var(--pill-thickness);
  transform: translateX(-50%);
}

.tool-pill-zone--bottom {
  bottom: var(--pill-gap);
}

.tool-pill-zone--top {
  top: var(--pill-gap);
}

.tool-pill-zone--left,
.tool-pill-zone--right {
  top: 50%;
  width: var(--pill-thickness);
  height: calc(var(--pill-thickness) * 5);
  max-height: calc(100% - 2 * var(--pill-gap));
  transform: translateY(-50%);
}

.tool-pill-zone--left {
  left: var(--pill-gap);
}

.tool-pill-zone--right {
  right: var(--pill-gap);
}

.tool-pill-zone--near {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  border-color: var(--accent);
}

@media (prefers-contrast: more) {
  .tool-pill {
    border-color: var(--line-strong);
  }
}
</style>
