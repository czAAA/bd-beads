<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import { useElementSize } from '../../composables/ui/useElementSize'
import { useRovingFocus } from '../../composables/ui/useRovingFocus'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'
import { BAR_EDGE_PX, selectionBarPlacement, type BarBox, type SelectionAnchor } from '../../composables/tools/selectionBarPlacement'
import AppMenuItem from '../ui/AppMenuItem.vue'
import IconButton from '../ui/IconButton.vue'
import MenuButton from '../ui/MenuButton.vue'
import { controlAction, controlDeps, type ControlAction } from '../../composables/shell/controlRegistry'
import { frameAllows } from '../../domain/frameShape'
import type { Project } from '../../domain/project'
import { copyLayerSelection, selectionInFinishedRows, type Selection } from '../../domain/selection'

// The design system's ContextBar (tickets 168, 415; ContextBar card): an icon-only bar above the Selection's top edge,
// clamped in the canvas box, flipped below when no room. Only applicable actions render; the rest fold into "...".
// None in paste mode (ticket 437, ADR 0016) or Edit Frame (ticket 427, ADR 0054); no Select all button (ticket 439).
const props = withDefaults(defineProps<{
  /** The Selection's size, "12×8 ≈ 4.2 × 2.6 cm"; absent when there is no Selection. */
  selectionSummary?: string
  /** The Selection itself: which layer it is on decides whether a quarter turn is offered (ticket 492). */
  selection?: Selection
  /** The Selection's rectangle and the canvas box it is in, in the box's own pixels: where the bar anchors. */
  anchor?: SelectionAnchor
  /** A gesture, pan or pinch is running: the bar steps out of the way until it ends. */
  gesturing?: boolean
  /** While `gesturing`, shrink to the size readout alone, in place, instead of hiding; the buttons return when the
   * gesture ends. */
  sizeOnly?: boolean
  /** Whether paste mode is on (useSelectionGesture's pasteProjectionActive): the bar then hides, Select all with it. */
  pasteArmed: boolean
  /** Whether the clipboard holds something (ticket 447): the bar then offers Paste, which enters paste mode and
   * stamps nothing. */
  hasClipboard?: boolean
  /** The open Project: what the actions' enabled states and disabled reasons read (ADR 0035). */
  project: Project
  canRemoveLine: boolean
  /** Whether the Selection holds beads of exactly one Piece, which Name can then name (ticket 406). */
  canNamePiece?: boolean
  /** A color is chosen to paint with: Fill needs one (it is disabled with its reason without). Chosen unless told
   * otherwise. */
  hasPaintColor?: boolean
  /** Whether the Select tool is active: the bar then offers Select all as its first item (ticket 428, ADR 0051). */
  selectActive?: boolean
  /** The Tool pill's rectangle in the same pixels: the bar keeps clear of it (ticket 439). */
  obstacle?: BarBox
}>(), { hasPaintColor: true })

const emit = defineEmits<{
  copy: []
  cut: []
  paste: []
  fill: []
  frame: []
  'clear-selection': []
  rotate: []
  'select-all': []
  'remove-line': []
  'name-piece': []
}>()

const { t } = useI18n()

const actions = {
  selectAll: controlAction('select-all'),
  copy: controlAction('copy'),
  cut: controlAction('cut'),
  paste: controlAction('tool-paste'),
  fill: controlAction('fill-selection'),
  frame: controlAction('frame-from-selection'),
  rotate: controlAction('rotate'),
  removeLine: controlAction('remove-line'),
  namePiece: controlAction('name-piece'),
  clear: controlAction('empty-selection'),
}

const deps = computed(() =>
  controlDeps({
    activeProject: () => props.project,
    hasSelection: () => props.selectionSummary !== undefined,
    selectionHasBeads: () => !!props.selection && copyLayerSelection(props.project, props.selection) !== undefined,
    selectionInFinishedRows: () => !!props.selection && selectionInFinishedRows(props.project, props.selection),
    hasClipboard: () => !!props.hasClipboard,
    canRemoveSelectedLine: () => props.canRemoveLine,
    canNamePiece: () => !!props.canNamePiece,
    hasPaintColor: () => props.hasPaintColor,
  }),
)

/** A stylus tap that selects must not also press a bar button: the bar shows disabled, with no Tooltip, for this long
 * after every new, resized or moved Selection (ticket 499). Keyboard shortcuts don't read it. */
const ARMING_DELAY_MS = 350
const armed = ref(false)
let armingTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => props.selection && { ...props.selection },
  () => {
    armed.value = false
    clearTimeout(armingTimer)
    armingTimer = setTimeout(() => (armed.value = true), ARMING_DELAY_MS)
  },
  { immediate: true, deep: true },
)
onBeforeUnmount(() => clearTimeout(armingTimer))

/** Touch gets the taller bar with bigger icons (ContextBar card). */
const touch = useMediaQuery('(pointer: coarse)')
const iconSize = computed(() => (touch.value ? 18 : 16))

/** One button of the Selection bar, in the order it is drawn; `group` decides where a divider goes. */
interface BarItem {
  id: string
  action: ControlAction
  group: number
  run: () => void
  danger?: boolean
}

/** What applies to this Selection, in order, Select all first while the Select tool is active (ContextBar card). */
const items = computed<BarItem[]>(() => {
  const showSelectAll = props.selectActive && !props.pasteArmed
  const list: BarItem[] = [
    ...(showSelectAll ? [{ id: 'select-all', action: actions.selectAll, group: 0, run: () => emit('select-all') }] : []),
    { id: 'copy', action: actions.copy, group: 1, run: () => emit('copy') },
    { id: 'cut', action: actions.cut, group: 1, run: () => emit('cut') },
    ...(props.hasClipboard ? [{ id: 'paste', action: actions.paste, group: 1, run: () => emit('paste') }] : []),
  ]
  list.push({ id: 'fill', action: actions.fill, group: 2, run: () => emit('fill') })
  // Offered with a Frame too: it moves the Frame to the Selection, e.g. onto another named Schema (ticket 407); not over
  // a Custom frame, whose Frame shape sets its outline (ticket 0592).
  if (frameAllows(props.project?.frame, 'from-selection')) list.push({ id: 'frame', action: actions.frame, group: 2, run: () => emit('frame') })
  // Disabled, saying why, where the Selection reaches into finished rows (ticket 0647).
  list.push({ id: 'rotate', action: actions.rotate, group: 2, run: () => emit('rotate') })
  if (props.canRemoveLine) list.push({ id: 'remove-line', action: actions.removeLine, group: 2, run: () => emit('remove-line') })
  if (props.canNamePiece) list.push({ id: 'name-piece', action: actions.namePiece, group: 2, run: () => emit('name-piece') })
  list.push({ id: 'clear', action: actions.clear, group: 3, run: () => emit('clear-selection'), danger: true })
  return list
})

// The bar's spacing in px, in step with its CSS: `--space-2` between items and at each side, and a 1px divider with
// `--selbar-divider-margin` (3px) either side. The fit maths reserves a side padding and a divider per end of the
// readout.
const BAR_ITEM_GAP_PX = 2
const BAR_SIDE_PADDING_PX = 2
const BAR_DIVIDER_PX = 1 + 2 * 3

const rootEl = ref<HTMLElement>()
// One Tab stop; ←/→ step along the buttons and stop at the ends (ADR 0075).
const roving = useRovingFocus(rootEl, { selector: '.context-bar__button', axis: () => 'horizontal', managesTabIndex: true })
const readoutEl = ref<HTMLElement>()
const bar = useElementSize(rootEl)
const readout = useElementSize(readoutEl)

/** How many buttons fit beside the readout in the canvas box's width (a button is as wide as the bar is high); every
 * one with no measured box (a test). */
const capacity = computed(() => {
  const viewport = props.anchor?.viewport.width
  if (!viewport || !readout.width.value || !bar.height.value) return Infinity
  const room = viewport - 2 * BAR_EDGE_PX - readout.width.value - 2 * (BAR_SIDE_PADDING_PX + BAR_DIVIDER_PX)
  return Math.max(1, Math.floor(room / (bar.height.value + BAR_ITEM_GAP_PX)))
})
const overflowing = computed(() => items.value.length > capacity.value)
const shown = computed(() => (overflowing.value ? items.value.slice(0, Math.max(0, capacity.value - 1)) : items.value))
const folded = computed(() => (overflowing.value ? items.value.slice(shown.value.length) : []))

const placement = computed(() => {
  const anchor = props.anchor
  if (!anchor) return undefined
  return selectionBarPlacement(anchor.box, { width: bar.width.value, height: bar.height.value }, anchor.viewport, props.obstacle)
})
const placedStyle = computed(() => (placement.value ? { left: `${placement.value.left}px`, top: `${placement.value.top}px` } : undefined))

/** A folded item is disabled by the same rule as its button would be, and says why on hover. */
const isDisabled = (item: BarItem) => !armed.value || (item.action.enabled ? !item.action.enabled(deps.value) : false)
const disabledReason = (item: BarItem) => (armed.value && isDisabled(item) ? item.action.disabledBody?.(t.value, deps.value) : undefined)

/** Gesturing with a size to show: only the readout, no buttons. */
const compact = computed(() => !!props.gesturing && !!props.sizeOnly && props.selectionSummary !== undefined)
const showing = computed(() => props.selectionSummary !== undefined)
</script>

<template>
  <div
    v-if="showing"
    ref="rootEl"
    v-show="!gesturing || (sizeOnly && selectionSummary !== undefined)"
    class="context-bar"
    :class="{ 'context-bar--placed': placement, 'context-bar--below': placement?.below }"
    :style="placedStyle"
    role="toolbar"
    :aria-label="t.contextBar.label"
    data-testid="context-bar"
    @keydown="roving.onKeydown"
    @focusin="roving.onFocusin"
  >
    <span ref="readoutEl" class="context-bar__size" data-testid="context-bar-size">{{ selectionSummary }}</span>
    <template v-for="(item, index) in shown" :key="item.id">
      <span v-if="index === 0 || shown[index - 1].group !== item.group" v-show="!compact" class="context-bar__divider" aria-hidden="true" />
      <IconButton
        v-show="!compact"
        class="context-bar__button"
        :class="{ 'context-bar__button--danger': item.danger }"
        :icon-size="iconSize"
        :action="item.action"
        :deps="deps"
        :disabled="armed ? undefined : true"
        :data-testid="`context-bar-${item.id}`"
        @click="item.run()"
      />
    </template>
    <template v-if="folded.length">
      <span v-show="!compact" class="context-bar__divider" aria-hidden="true" />
      <MenuButton v-show="!compact" class="context-bar__button" icon="more" icon-only :label="t.contextBar.moreLabel" align="end" data-testid="context-bar-more">
        <AppMenuItem
          v-for="item in folded"
          :key="item.id"
          :icon="item.action.icon"
          :disabled="isDisabled(item)"
          :name="item.action.name(t)"
          :disabled-body="disabledReason(item)"
          :data-testid="`context-bar-more-${item.id}`"
          @select="item.run()"
        >
          {{ item.action.name(t) }}
        </AppMenuItem>
      </MenuButton>
    </template>
  </div>
</template>

<style scoped>
/* On ink, elevation-3, --selbar-radius; 28px high (36px on touch), 2px between items (ContextBar card). */
.context-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  box-sizing: border-box;
  height: var(--selbar-height);
  padding: 0 var(--space-2);
  color: var(--canvas);
  background: var(--ink);
  border-radius: var(--selbar-radius);
  box-shadow: var(--elevation-3);
}

:root[data-theme='dark'] .context-bar {
  border: 1px solid var(--line-strong);
  box-shadow: none;
}

@media (pointer: coarse) {
  .context-bar {
    height: var(--selbar-height-touch);
  }
}

/* Anchored to the Selection: the canvas box places it with left and top. */
.context-bar--placed {
  position: absolute;
  z-index: var(--z-context-bar);
  max-width: calc(100% - 2 * var(--space-8));
}

.context-bar__size {
  flex: none;
  padding: 0 var(--space-6);
  font: var(--type-meta);
  color: color-mix(in srgb, var(--canvas) 74%, transparent);
  white-space: nowrap;
}

.context-bar__divider {
  flex: none;
  width: 1px;
  height: var(--space-16);
  margin: 0 var(--selbar-divider-margin);
  background: color-mix(in srgb, var(--canvas) 28%, transparent);
}

.context-bar :deep(.context-bar__button) {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--selbar-height);
  min-width: var(--hit-min);
  height: var(--selbar-height);
  padding: 0;
  color: inherit;
  background: none;
  border: 0;
  border-radius: var(--radius-sm);
}

@media (pointer: coarse) {
  .context-bar :deep(.context-bar__button) {
    width: var(--selbar-height-touch);
    height: var(--selbar-height-touch);
  }
}

.context-bar :deep(.context-bar__button--danger) {
  color: var(--selbar-danger);
}

.context-bar :deep(.context-bar__button[aria-disabled='true']) {
  color: inherit;
  background: none;
  opacity: 0.5;
}

@media (hover: hover) {
  .context-bar :deep(.context-bar__button:hover:not([aria-disabled='true'])) {
    background: color-mix(in srgb, var(--canvas) 12%, transparent);
  }
}

.context-bar :deep(.context-bar__button:active:not([aria-disabled='true'])) {
  background: color-mix(in srgb, var(--canvas) 20%, transparent);
}

.context-bar :deep(.context-bar__button:focus-visible) {
  outline: var(--focus-width) solid var(--canvas);
  outline-offset: var(--focus-offset);
}
</style>
