<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import { useElementSize } from '../../composables/ui/useElementSize'
import { useRovingFocus } from '../../composables/ui/useRovingFocus'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'
import { useRotateCopy } from '../../composables/ui/useRotateCopy'
import { ownPoint } from '../../composables/ui/cssZoom'
import { areaBarPlacement, BAR_EDGE_PX, type BarBox, barOutOfView, type SelectionAnchor, selectionBarPlacement, type SheetArea } from '../../composables/tools/selectionBarPlacement'
import AppMenuItem from '../ui/AppMenuItem.vue'
import IconButton from '../ui/IconButton.vue'
import MenuButton from '../ui/MenuButton.vue'
import MirrorBarItems from './MirrorBarItems.vue'
import AreaMoveGrip from './AreaMoveGrip.vue'
import { controlAction, controlDeps, type ControlAction } from '../../composables/shell/controlRegistry'
import { frameAllows } from '../../domain/frameShape'
import type { Project } from '../../domain/project'
import { selectionHasBeads, selectionInFinishedRows, selectionLayer, type Selection } from '../../domain/selection'
import { frameOf } from '../../domain/layerRecord'
import type { Rect } from '../../domain/canvas'
import type { MirrorFit, MirrorSetting, ShapeAxes } from '../../domain/mirror'

/** What the Mirror bar shows (ADR 0082): the Mirror, its size readout, the Area in its layer's positions, and a Custom
 * frame's own Axes while the whole Frame is the Mirror. */
export interface MirrorBarState {
  setting: MirrorSetting
  summary: string
  rect?: Rect
  /** What the Area offers the chips and Steppers (ticket 0775); none on a Custom frame. */
  fit?: MirrorFit
  shape?: ShapeAxes
}

// The design system's ContextBar (tickets 168, 415, 0750, 0808, 0812): an icon-only bar floating above its area, clamped
// in the canvas box; above the Area sheet of a rectangle Selection or (as the Mirror bar) a Canvas Area, clear of its
// band, with a move grip first. Actions that don't fit fold into "..."; none in paste mode (437) or Edit Frame (427).
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
  /** The Mirror while it is on (ADR 0082): given with no Selection, the bar is the Mirror bar, anchored to `mirrorAnchor`
   * and shrunk to its readout while `mirrorSizeOnly` (the Area resized) and a gesture runs. The canvas shows it as a
   * second bar beside the Selection bar (ticket 0809). */
  mirror?: MirrorBarState
  mirrorAnchor?: SelectionAnchor
  mirrorSizeOnly?: boolean
}>(), { hasPaintColor: true })

const emit = defineEmits<{
  copy: []
  cut: []
  paste: []
  fill: []
  frame: []
  'clear-selection': []
  rotate: []
  'mirror-selection': []
  'update:mirror': [setting: MirrorSetting]
  'close-mirror': []
  'select-all': []
  'remove-line': []
  'name-piece': []
  /** The move grip was pressed (ticket 0808): the canvas takes the press on as a drag of that area. */
  'move-press': [event: PointerEvent, area: SheetArea]
  /** An arrow on the move grip: the area moves a bead. */
  'move-key': [event: KeyboardEvent, area: SheetArea]
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
  mirrorSelection: controlAction('mirror-selection'),
  removeLine: controlAction('remove-line'),
  namePiece: controlAction('name-piece'),
  clear: controlAction('empty-selection'),
}

const deps = computed(() =>
  controlDeps({
    activeProject: () => props.project,
    hasSelection: () => props.selectionSummary !== undefined,
    selectionHasBeads: () => !!props.selection && selectionHasBeads(props.project, props.selection),
    selectionInFinishedRows: () => !!props.selection && selectionInFinishedRows(props.project, props.selection),
    hasClipboard: () => !!props.hasClipboard,
    canRemoveSelectedLine: () => props.canRemoveLine,
    canNamePiece: () => !!props.canNamePiece,
    hasPaintColor: () => props.hasPaintColor,
    selectionOnFrame: () => !!props.selection && selectionLayer(props.project, props.selection) === 'frame',
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
  if (frameAllows(frameOf(props.project), 'from-selection')) list.push({ id: 'frame', action: actions.frame, group: 2, run: () => emit('frame') })
  // Disabled, saying why, where the Selection reaches into finished rows (ticket 0647).
  list.push({ id: 'rotate', action: actions.rotate, group: 2, run: rotateFromBar })
  // Always offered: the Selection's rectangle becomes the Mirror's Area (ADR 0082); on a Frame Selection it says why not.
  list.push({ id: 'mirror-selection', action: actions.mirrorSelection, group: 2, run: () => emit('mirror-selection') })
  if (props.canRemoveLine) list.push({ id: 'remove-line', action: actions.removeLine, group: 2, run: () => emit('remove-line') })
  if (props.canNamePiece) list.push({ id: 'name-piece', action: actions.namePiece, group: 2, run: () => emit('name-piece') })
  list.push({ id: 'clear', action: actions.clear, group: 3, run: () => emit('clear-selection'), danger: true })
  return list
})

// The bar's spacing in px, in step with its CSS: `--space-2` between items and at each side, and a 1px divider with
// `--selbar-divider-margin` (3px) either side. The fit maths reserves a side padding and a divider per end of the
// readout. The gap and the side padding are read from the bar where it is drawn, since touch spaces it wider (ticket 0962).
const BAR_ITEM_GAP_PX = 2
const BAR_SIDE_PADDING_PX = 2
const BAR_DIVIDER_PX = 1 + 2 * 3

const rootEl = ref<HTMLElement>()
// One Tab stop; ←/→ step along the buttons and stop at the ends (ADR 0075).
const roving = useRovingFocus(rootEl, { selector: '.context-bar__button, .context-bar__control', axis: () => 'horizontal', managesTabIndex: true })
const readoutEl = ref<HTMLElement>()
// Placed by its outer edge: its padding and the dark theme's border count, or it would sit on what it keeps clear of.
const bar = useElementSize(rootEl, { box: 'border-box' })
const readout = useElementSize(readoutEl)

/** How many buttons fit beside the readout in the canvas box's width (a button is as wide as the bar is high); every
 * one with no measured box (a test). */
const capacity = computed(() => {
  const viewport = props.anchor?.viewport.width
  if (!viewport || !readout.width.value || !bar.height.value) return Infinity
  const style = rootEl.value ? getComputedStyle(rootEl.value) : undefined
  const gap = Number.parseFloat(style?.columnGap ?? '') || BAR_ITEM_GAP_PX
  const side = Number.parseFloat(style?.paddingLeft ?? '') || BAR_SIDE_PADDING_PX
  const room = viewport - 2 * BAR_EDGE_PX - readout.width.value - 2 * (side + BAR_DIVIDER_PX)
  return Math.max(1, Math.floor(room / (bar.height.value + gap)) - (gripArea.value ? 1 : 0))
})
const overflowing = computed(() => items.value.length > capacity.value)
const shown = computed(() => (overflowing.value ? items.value.slice(0, Math.max(0, capacity.value - 1)) : items.value))
const folded = computed(() => (overflowing.value ? items.value.slice(shown.value.length) : []))

/** This bar is the Mirror bar: it is given the Mirror and no Selection (the Selection bar is another ContextBar). */
const mirrorShown = computed(() => props.selectionSummary === undefined && !!props.mirror)
/** The area whose Area sheet the bar sits above, its move grip's (ContextBar card, Area sheet): a rectangle Selection, or the Mirror's
 * Canvas Area; none for a Piece's shape and the whole Frame, whose bars float. */
const sheetArea = computed<SheetArea | undefined>(() => {
  if (mirrorShown.value) return props.mirror!.setting.place?.layer === 'canvas' ? 'mirror' : undefined
  return props.selection && !props.selection.cells ? 'selection' : undefined
})
/** The area the bar's move grip moves: the sheet's, or a Piece's shape, whose bar floats and whose beads go with it
 * (ticket 1013). */
const gripArea = computed<SheetArea | undefined>(() => sheetArea.value ?? (!mirrorShown.value && props.selection?.cells ? 'selection' : undefined))
const readoutText = computed(() => (mirrorShown.value ? props.mirror!.summary : props.selectionSummary))
/** Touch's bigger icons, as the bar's own; the Mirror bar's chips take the same. */
const chipIconSize = computed(() => (touch.value ? 18 : 16))

// The Mirror bar where it cannot fit the canvas box (ContextBar card, Too narrow): first the readout drops, then the bar
// scrolls sideways, still one row (ticket 0771); nothing folds away. Measured afresh whenever its content or the box changes.
const mirrorFit = ref<0 | 1 | 2>(0)
/** The box the bar is placed in (the canvas box's layer): its width is the room the bar has. */
const hostEl = computed(() => rootEl.value?.parentElement ?? undefined)
const host = useElementSize(hostEl)
watch(
  () => [mirrorShown.value, sheetArea.value, host.width.value, props.mirrorAnchor?.viewport.width, props.mirror?.setting.axes, props.mirror?.setting.mode, props.mirror?.shape] as const,
  async () => {
    mirrorFit.value = 0
    for (const next of [1, 2] as const) {
      await nextTick()
      const root = rootEl.value
      if (!mirrorShown.value || !root || root.scrollWidth <= root.clientWidth + 1) return
      mirrorFit.value = next
    }
  },
  { immediate: true, deep: true, flush: 'post' },
)

const placedAnchor = computed(() => (mirrorShown.value ? props.mirrorAnchor : props.anchor))
const placement = computed<{ left: number; top: number; below: boolean } | undefined>(() => {
  const anchor = placedAnchor.value
  if (!anchor) return undefined
  const size = { width: bar.width.value, height: bar.height.value }
  if (sheetArea.value) return areaBarPlacement(anchor.box, size, anchor.viewport, props.obstacle)
  // Above the whole Frame's sheet, or below it with no room there, never flipped back over the band's tools (ContextBar
  // card, Placement).
  const keepSide = mirrorShown.value && props.mirror!.setting.place?.layer === 'frame'
  return selectionBarPlacement(anchor.box, size, anchor.viewport, props.obstacle, { keepSide })
})
/** The bar gone out of view with its Area (ticket 0779): wholly outside the canvas box, hidden so Tab never reaches it. */
const away = computed(() => {
  const at = placement.value
  const viewport = placedAnchor.value?.viewport
  return !!at && !!viewport && barOutOfView(at, { width: bar.width.value, height: bar.height.value }, viewport)
})
const placedStyle = computed(() => {
  const at = placement.value
  if (!at) return undefined
  return { left: `${at.left}px`, top: `${at.top}px`, ...(away.value ? { visibility: 'hidden' as const } : {}) }
})

/** A folded item is disabled by the same rule as its button would be, and says why on hover. */
const isDisabled = (item: BarItem) => !armed.value || (item.action.enabled ? !item.action.enabled(deps.value) : false)
const disabledReason = (item: BarItem) => (armed.value && isDisabled(item) ? item.action.disabledBody?.(t.value, deps.value) : undefined)

/** Gesturing with a size to show: only the readout, no buttons. */
const compact = computed(() => !!props.gesturing && (mirrorShown.value ? !!props.mirrorSizeOnly : !!props.sizeOnly && props.selectionSummary !== undefined))
const showing = computed(() => props.selectionSummary !== undefined || mirrorShown.value)

/** The Rotate copy that waits where it was pressed while the turned Selection takes the bar away (ticket 1110,
 * ContextBar card). Nothing plays as the Selection turns, so the bar's own button takes over the moment it is back under it. */
const rotateCopy = useRotateCopy({ handOverMs: 0 })
/** A screen point in the px of the box the bar is placed in, which the copy keeps however the bar moves. */
function inHost(x: number, y: number): { left: number; top: number } {
  const at = ownPoint(hostEl.value, { clientX: x, clientY: y })
  return { left: at.x, top: at.y }
}
/** Rotate from the bar's button or its "…" item: a pointer's press leaves the copy over the button, or one centred where
 * the item was pressed, a button as big as the bar is high. */
function rotateFromBar(): void {
  const press = rotateCopy.takePress()
  emit('rotate')
  if (!press) return
  const size = bar.height.value
  const at = inHost(press.at.x, press.at.y)
  const place = press.button ? inHost(press.button.left, press.button.top) : { left: at.left - size / 2, top: at.top - size / 2 }
  rotateCopy.pressed({ ...place, scale: 1, small: false }, press.touch)
}
/** A press on the copy turns the Selection again, as the bar's own button does; the bar's arming wait is for a tap that
 * selects, which this is not. */
function rotateFromCopy(): void {
  emit('rotate')
  rotateCopy.pressedAgain()
}
const copyStyle = computed(() => {
  const place = rotateCopy.place.value
  return place ? { left: `${place.left}px`, top: `${place.top}px` } : {}
})
/** Turned back, the bar's own Rotate is under the copy again: it takes over. */
function handOverIfUnder(): void {
  const own = rootEl.value?.querySelector('[data-rotate-from="button"]')?.getBoundingClientRect()
  rotateCopy.ownAt(own && inHost(own.left, own.top))
}
watch(placement, handOverIfUnder, { flush: 'post' })
// It goes with the Selection, and with a press on the canvas (a new Selection, a drag, a pan), paste mode too.
watch(
  () => props.selectionSummary !== undefined && !props.gesturing && !props.pasteArmed,
  (stays) => stays || rotateCopy.drop(),
)
</script>

<template>
  <div
    v-if="showing"
    ref="rootEl"
    v-show="!gesturing || compact"
    class="context-bar"
    :class="{ 'context-bar--placed': placement, 'context-bar--below': placement?.below, 'context-bar--area': sheetArea, 'context-bar--mirror': mirrorShown, 'context-bar--scrolls': mirrorShown && mirrorFit === 2 && !compact }"
    :style="placedStyle"
    role="toolbar"
    :aria-label="mirrorShown ? t.mirror.title : t.contextBar.label"
    :data-testid="mirrorShown ? 'mirror-bar' : 'context-bar'"
    @keydown="roving.onKeydown"
    @focusin="roving.onFocusin"
    @pointerdown.capture="rotateCopy.notePress"
    @keydown.capture="rotateCopy.forgetPress"
  >
    <AreaMoveGrip v-if="gripArea" v-show="!compact" :area="gripArea" :piece="!!selection?.cells" @press="emit('move-press', $event, gripArea)" @key="emit('move-key', $event, gripArea)" />
    <span v-show="!mirrorShown || mirrorFit === 0 || compact" ref="readoutEl" class="context-bar__size" data-testid="context-bar-size">{{ readoutText }}</span>
    <MirrorBarItems
      v-if="mirrorShown"
      v-show="!compact"
      :setting="mirror!.setting"
      :fit="mirror!.fit"
      :shape="mirror!.shape"
      :icon-size="chipIconSize"
      @update:setting="emit('update:mirror', $event)"
      @close="emit('close-mirror')"
    />
    <template v-for="(item, index) in mirrorShown ? [] : shown" :key="item.id">
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
        :data-rotate-from="item.id === 'rotate' ? 'button' : undefined"
        @click="item.run()"
      />
    </template>
    <template v-if="!mirrorShown && folded.length">
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
          :data-rotate-from="item.id === 'rotate' ? 'menu' : undefined"
          @select="item.run()"
        >
          {{ item.action.name(t) }}
        </AppMenuItem>
      </MenuButton>
    </template>
  </div>
  <!-- Rotate's copy, lifted off the bar where it was pressed (ticket 1110): no Tab stop and hidden from a screen
       reader, so Rotate is there once; the bar's own button is the keyboard's. -->
  <div
    v-if="rotateCopy.place.value"
    :ref="rotateCopy.copyEl"
    class="context-bar__rotate-copy"
    :class="{ 'context-bar__rotate-copy--leaving': rotateCopy.leaving.value }"
    :style="copyStyle"
    data-testid="context-bar-rotate-copy"
    aria-hidden="true"
    @pointerenter="rotateCopy.enter"
    @pointerleave="rotateCopy.leave"
  >
    <IconButton class="context-bar__button" :icon-size="iconSize" :action="actions.rotate" :deps="deps" tabindex="-1" @pointerdown="rotateCopy.noteCopyPress" @mousedown.prevent @click="rotateFromCopy" />
  </div>
</template>

<style scoped>
/* On ink, elevation-3, `radius-sm`; 28px high (36px on touch), 2px between items (ContextBar card). */
.context-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  box-sizing: border-box;
  height: var(--selbar-height);
  padding: 0 var(--space-2);
  color: var(--canvas);
  background: var(--ink);
  border-radius: var(--radius-sm);
  box-shadow: var(--elevation-3);
}

:root[data-theme='dark'] .context-bar {
  border: 1px solid var(--line-strong);
  box-shadow: none;
}

/* Touch (ticket 0962): the items stand `touch-target` apart, so each button's `touch-target` hit area lies over no
 * other's, and the ends' pads stay inside the bar, so they never make the Mirror bar scroll. */
@media (pointer: coarse) {
  .context-bar {
    gap: calc(var(--touch-target) - var(--selbar-height-touch));
    height: var(--selbar-height-touch);
    padding: 0 calc((var(--touch-target) - var(--selbar-height-touch)) / 2);
  }
}

/* Anchored to the Selection: the canvas box places it with left and top. */
.context-bar--placed {
  position: absolute;
  z-index: var(--z-context-bar);
  max-width: calc(100% - 2 * var(--space-8));
}

/* The Mirror bar lies under the Selection bar where the two meet, as its sheet under the Selection's (ticket 0809),
 * until it takes focus: then it comes up, so a bar reached by Tab is never hidden. */
.context-bar--placed.context-bar--mirror:not(:focus-within) {
  z-index: calc(var(--z-context-bar) - 1);
}

/* The Mirror bar too narrow for one row even without its readout (ContextBar card, Too narrow): still one row, it
 * scrolls sideways with no scrollbar; a control focused off the edge scrolls into view. */
.context-bar--scrolls {
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
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

/* The move grip first and the button last run parallel to the bar's corners (ticket 1080): across, `radius-sm` less
 * the side padding (and dark's line), never under `radius-xs`; up and down they reach the bar's edge, so `radius-sm`. */
.context-bar > :deep(:first-child .area-move-grip) {
  border-top-left-radius: calc(var(--radius-sm) - var(--space-2)) var(--radius-sm);
  border-bottom-left-radius: calc(var(--radius-sm) - var(--space-2)) var(--radius-sm);
}

.context-bar > :deep(:last-child .context-bar__button) {
  border-top-right-radius: calc(var(--radius-sm) - var(--space-2)) var(--radius-sm);
  border-bottom-right-radius: calc(var(--radius-sm) - var(--space-2)) var(--radius-sm);
}

:root[data-theme='dark'] .context-bar > :deep(:first-child .area-move-grip) {
  border-top-left-radius: calc(var(--radius-sm) - var(--space-2) - 1px) var(--radius-sm);
  border-bottom-left-radius: calc(var(--radius-sm) - var(--space-2) - 1px) var(--radius-sm);
}

:root[data-theme='dark'] .context-bar > :deep(:last-child .context-bar__button) {
  border-top-right-radius: calc(var(--radius-sm) - var(--space-2) - 1px) var(--radius-sm);
  border-bottom-right-radius: calc(var(--radius-sm) - var(--space-2) - 1px) var(--radius-sm);
}

@media (pointer: coarse) {
  .context-bar > :deep(:first-child .area-move-grip) {
    border-top-left-radius: calc(var(--radius-sm) - (var(--touch-target) - var(--selbar-height-touch)) / 2) var(--radius-sm);
    border-bottom-left-radius: calc(var(--radius-sm) - (var(--touch-target) - var(--selbar-height-touch)) / 2) var(--radius-sm);
  }

  .context-bar > :deep(:last-child .context-bar__button) {
    border-top-right-radius: calc(var(--radius-sm) - (var(--touch-target) - var(--selbar-height-touch)) / 2) var(--radius-sm);
    border-bottom-right-radius: calc(var(--radius-sm) - (var(--touch-target) - var(--selbar-height-touch)) / 2) var(--radius-sm);
  }

  :root[data-theme='dark'] .context-bar > :deep(:first-child .area-move-grip) {
    border-top-left-radius: var(--radius-xs) var(--radius-sm);
    border-bottom-left-radius: var(--radius-xs) var(--radius-sm);
  }

  :root[data-theme='dark'] .context-bar > :deep(:last-child .context-bar__button) {
    border-top-right-radius: var(--radius-xs) var(--radius-sm);
    border-bottom-right-radius: var(--radius-xs) var(--radius-sm);
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

/* Rotate's copy (ContextBar card, ticket 1110): the bar's Rotate lifted off it, a one-button bar of its look (`ink`, `radius-sm`,
 * `elevation-3`, dark's `line-strong` edge) with its button where the bar's was, over the bar; it fades on leaving. */
.context-bar__rotate-copy {
  --copy-side: var(--space-2);
  --copy-edge: 0px;

  position: absolute;
  z-index: calc(var(--z-context-bar) + 1);
  display: flex;
  margin: calc(-1 * var(--copy-edge)) 0 0 calc(-1 * (var(--copy-side) + var(--copy-edge)));
  padding: 0 var(--copy-side);
  color: var(--canvas);
  background: var(--ink);
  border-radius: var(--radius-sm);
  box-shadow: var(--elevation-3);
  pointer-events: auto;
  transition: opacity var(--rotate-copy-fade) var(--ease-in);
}

:root[data-theme='dark'] .context-bar__rotate-copy {
  --copy-edge: 1px;

  border: 1px solid var(--line-strong);
  box-shadow: none;
}

@media (pointer: coarse) {
  .context-bar__rotate-copy {
    --copy-side: calc((var(--touch-target) - var(--selbar-height-touch)) / 2);
  }
}

.context-bar__rotate-copy--leaving {
  opacity: 0;
}

.context-bar__rotate-copy :deep(.context-bar__button) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--selbar-height);
  min-width: var(--hit-min);
  height: var(--selbar-height);
  padding: 0;
  color: inherit;
  background: none;
  border: 0;
  border-radius: calc(var(--radius-sm) - var(--copy-side) - var(--copy-edge)) var(--radius-sm);
}

/* As the bar's end buttons: never under `radius-xs` across (touch's wider sides in dark). */
@media (pointer: coarse) {
  :root[data-theme='dark'] .context-bar__rotate-copy :deep(.context-bar__button) {
    border-radius: var(--radius-xs) var(--radius-sm);
  }
}

@media (pointer: coarse) {
  .context-bar__rotate-copy :deep(.context-bar__button) {
    width: var(--selbar-height-touch);
    height: var(--selbar-height-touch);
  }
}

.context-bar__rotate-copy :deep(.context-bar__button[aria-disabled='true']) {
  opacity: 0.5;
}

@media (hover: hover) {
  .context-bar__rotate-copy :deep(.context-bar__button:hover:not([aria-disabled='true'])) {
    background: color-mix(in srgb, var(--canvas) 12%, transparent);
  }
}

.context-bar__rotate-copy :deep(.context-bar__button:active:not([aria-disabled='true'])) {
  background: color-mix(in srgb, var(--canvas) 20%, transparent);
}

/* One set of states for every control in either bar, written to win over the icon button's own hover fill. Hover and
 * press mix `canvas` into the bar at 12% and 20%; "on" (a chip, the chosen Mode) is `canvas` with `ink`, only dimmed
 * by them, so its icon or text stays readable. */
@media (hover: hover) {
  .context-bar :deep(:is(.context-bar__button, .context-bar__control, .area-move-grip):hover:not([aria-disabled='true'])) {
    background: color-mix(in srgb, var(--canvas) 12%, transparent);
  }

  .context-bar :deep(.context-bar__control:is([aria-pressed='true'], [aria-checked='true']):hover:not([aria-disabled='true'])) {
    background: color-mix(in srgb, var(--canvas) 86%, var(--ink));
  }
}

.context-bar :deep(:is(.context-bar__button, .context-bar__control, .area-move-grip):active:not([aria-disabled='true'])) {
  background: color-mix(in srgb, var(--canvas) 20%, transparent);
}

.context-bar :deep(.context-bar__control:is([aria-pressed='true'], [aria-checked='true'])) {
  color: var(--ink);
  background: var(--canvas);
}

.context-bar :deep(.context-bar__control:is([aria-pressed='true'], [aria-checked='true']):active:not([aria-disabled='true'])) {
  background: color-mix(in srgb, var(--canvas) 72%, var(--ink));
}

.context-bar :deep(:is(.context-bar__button, .context-bar__control, .area-move-grip):focus-visible) {
  outline: var(--focus-width) solid var(--canvas);
  outline-offset: var(--focus-offset);
}
</style>
