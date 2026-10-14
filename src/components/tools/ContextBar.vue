<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import { useElementSize } from '../../composables/ui/useElementSize'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'
import { BAR_EDGE_PX, selectionBarPlacement, type SelectionAnchor } from '../../composables/tools/selectionBarPlacement'
import AppMenuItem from '../ui/AppMenuItem.vue'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import IconButton from '../ui/IconButton.vue'
import MenuButton from '../ui/MenuButton.vue'
import { controlAction, controlDeps, type ControlAction } from '../../composables/shell/controlRegistry'
import type { Project } from '../../domain/project'

/**
 * The design system's ContextBar (tickets 168, 415; ContextBar card): a thin icon-only bar anchored above the
 * Selection's top edge, centred on it, clamped inside the canvas box and flipped below when there is no room above. It
 * offers what a Selection can do: its size, Copy, Cut, Paste, Fill, Frame and, after a divider, Clear selection; only
 * what applies is rendered (Paste with a clipboard, Frame without a Frame, Remove line with a line selected). When the
 * canvas box is too narrow for all of it, the last actions fold into a "…" menu. Once Paste is armed it is "Tap to paste"
 * and Cancel at the canvas box's top-centre, and while the Frame is being set it holds the Frame's size, Fit to drawing,
 * Remove Frame and Done (ticket 295).
 */
const props = withDefaults(defineProps<{
  /** The Selection's size, "12×8 · 4.2 × 2.6 cm"; absent when there is no Selection. */
  selectionSummary?: string
  /** The Selection's rectangle and the canvas box it is in, in the box's own pixels: where the bar anchors. */
  anchor?: SelectionAnchor
  /** A gesture, pan or pinch is running: the bar steps out of the way until it ends. */
  gesturing?: boolean
  /** Whether a copied block is armed to paste (useSelectionGesture's pasteProjectionActive). */
  pasteArmed: boolean
  /** Whether something has been copied, so Paste applies. */
  hasClipboard?: boolean
  /** The open Project: what the actions' enabled states and disabled reasons read (ADR 0035). */
  project: Project
  canRemoveLine: boolean
  /** Whether the Selection holds beads of exactly one Piece, which Name can then name (ticket 406). */
  canNamePiece?: boolean
  /** A color is chosen to paint with: Fill needs one (it is disabled with its reason without). Chosen unless told otherwise. */
  hasPaintColor?: boolean
  /** Whether the Frame is being set: the bar then holds the Frame's size, Fit to drawing and Done (v16). */
  settingFrame?: boolean
  /** The Frame's size as it is now, "17×17 · 2.7 × 2.7 cm", while it is being set. */
  frameSummary?: string
}>(), { hasPaintColor: true })

const emit = defineEmits<{
  copy: []
  cut: []
  paste: []
  fill: []
  frame: []
  'clear-selection': []
  rotate: []
  'remove-line': []
  'name-piece': []
  'fit-frame': []
  'remove-frame': []
  'done-frame': []
  /** The armed paste's Cancel backs out one step (App.vue's backOutOfSelect). */
  dismiss: []
}>()

const { t } = useI18n()

const actions = {
  fit: controlAction('fit-to-drawing'),
  removeFrame: controlAction('remove-frame'),
  done: controlAction('done-frame'),
  copy: controlAction('copy'),
  cut: controlAction('cut'),
  paste: controlAction('paste'),
  fill: controlAction('fill-selection'),
  frame: controlAction('frame-from-selection'),
  rotate: controlAction('rotate'),
  removeLine: controlAction('remove-line'),
  namePiece: controlAction('name-piece'),
  clear: controlAction('empty-selection'),
  cancel: controlAction('cancel-paste'),
}

const deps = computed(() =>
  controlDeps({
    activeProject: () => props.project,
    hasSelection: () => props.selectionSummary !== undefined,
    hasClipboard: () => !!props.hasClipboard,
    canRemoveSelectedLine: () => props.canRemoveLine,
    canNamePiece: () => !!props.canNamePiece,
    hasPaintColor: () => props.hasPaintColor,
  }),
)

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

/** What applies to this Selection, in order (ContextBar card). */
const items = computed<BarItem[]>(() => {
  const list: BarItem[] = [
    { id: 'copy', action: actions.copy, group: 1, run: () => emit('copy') },
    { id: 'cut', action: actions.cut, group: 1, run: () => emit('cut') },
  ]
  if (props.hasClipboard) list.push({ id: 'paste', action: actions.paste, group: 1, run: () => emit('paste') })
  list.push({ id: 'fill', action: actions.fill, group: 2, run: () => emit('fill') })
  // Offered with a Frame too: it moves the Frame to the Selection, e.g. onto another named Schema (ticket 407).
  list.push({ id: 'frame', action: actions.frame, group: 2, run: () => emit('frame') })
  list.push({ id: 'rotate', action: actions.rotate, group: 2, run: () => emit('rotate') })
  if (props.canRemoveLine) list.push({ id: 'remove-line', action: actions.removeLine, group: 2, run: () => emit('remove-line') })
  if (props.canNamePiece) list.push({ id: 'name-piece', action: actions.namePiece, group: 2, run: () => emit('name-piece') })
  list.push({ id: 'clear', action: actions.clear, group: 3, run: () => emit('clear-selection'), danger: true })
  return list
})

/**
 * The bar's own spacing in px, kept in step with its CSS: `--space-2` between items and at each side, and a divider
 * that is 1px wide with `--selbar-divider-margin` (3px) either side. The fit maths reserves a side padding and a
 * divider for each end of the readout.
 */
const BAR_ITEM_GAP_PX = 2
const BAR_SIDE_PADDING_PX = 2
const BAR_DIVIDER_PX = 1 + 2 * 3

const rootEl = ref<HTMLElement>()
const readoutEl = ref<HTMLElement>()
const bar = useElementSize(rootEl)
const readout = useElementSize(readoutEl)

/** How many buttons fit beside the readout in the canvas box's width (a button is as wide as the bar is high); every one with no measured box (a test). */
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
  if (!anchor || props.settingFrame || props.pasteArmed) return undefined
  return selectionBarPlacement(anchor.box, { width: bar.width.value, height: bar.height.value }, anchor.viewport)
})
const placedStyle = computed(() => (placement.value ? { left: `${placement.value.left}px`, top: `${placement.value.top}px` } : undefined))

/** A folded item is disabled by the same rule as its button would be, and says why on hover. */
const isDisabled = (item: BarItem) => (item.action.enabled ? !item.action.enabled(deps.value) : false)
const disabledReason = (item: BarItem) => (isDisabled(item) ? item.action.disabledBody?.(t.value, deps.value) : undefined)

const showing = computed(() => !!props.settingFrame || props.selectionSummary !== undefined || props.pasteArmed)
const mode = computed(() => (props.settingFrame ? 'frame' : props.pasteArmed ? 'armed' : 'selection'))
</script>

<template>
  <div
    v-if="showing"
    ref="rootEl"
    v-show="!gesturing"
    class="context-bar"
    :class="[`context-bar--${mode}`, { 'context-bar--placed': placement, 'context-bar--below': placement?.below }]"
    :style="placedStyle"
    role="toolbar"
    :aria-label="t.contextBar.label"
    data-testid="context-bar"
  >
    <template v-if="settingFrame">
      <span class="context-bar__size context-bar__frame-size" data-testid="context-bar-frame-size">{{ frameSummary }}</span>
      <span class="context-bar__divider" aria-hidden="true" />
      <IconButton class="context-bar__button" :icon-size="iconSize" icon="frame" :action="actions.fit" :deps="deps" data-testid="context-bar-fit-frame" @click="emit('fit-frame')" />
      <IconButton
        v-if="project.frame"
        class="context-bar__button"
        :icon-size="iconSize"
        :action="actions.removeFrame"
        :deps="deps"
        data-testid="context-bar-remove-frame"
        @click="emit('remove-frame')"
      />
      <AppButton class="context-bar__button context-bar__done" :action="actions.done" :deps="deps" data-testid="context-bar-done-frame" @click="emit('done-frame')" />
    </template>
    <template v-else-if="!pasteArmed">
      <span ref="readoutEl" class="context-bar__size" data-testid="context-bar-size">{{ selectionSummary }}</span>
      <template v-for="(item, index) in shown" :key="item.id">
        <span v-if="index === 0 || shown[index - 1].group !== item.group" class="context-bar__divider" aria-hidden="true" />
        <IconButton
          class="context-bar__button"
          :class="{ 'context-bar__button--danger': item.danger }"
          :icon-size="iconSize"
          :action="item.action"
          :deps="deps"
          :data-testid="`context-bar-${item.id}`"
          :data-tour="item.id === 'copy' || item.id === 'remove-line' ? item.id : undefined"
          @click="item.run()"
        />
      </template>
      <template v-if="folded.length">
        <span class="context-bar__divider" aria-hidden="true" />
        <MenuButton class="context-bar__button" icon="more" icon-only :label="t.contextBar.moreLabel" align="end" data-testid="context-bar-more">
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
    </template>
    <template v-else>
      <AppIcon class="context-bar__hint" name="paste" :size="iconSize" :label="t.contextBar.pasteHint" data-testid="context-bar-hint" />
      <span class="context-bar__divider" aria-hidden="true" />
      <IconButton class="context-bar__button" :icon-size="iconSize" icon="close" :action="actions.cancel" :deps="deps" data-testid="context-bar-cancel" @click="emit('dismiss')" />
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

.context-bar__hint {
  flex: none;
  margin: 0 var(--space-6);
  color: color-mix(in srgb, var(--canvas) 74%, transparent);
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

.context-bar :deep(.context-bar__done) {
  width: auto;
  padding: 0 var(--space-8);
  font: var(--type-small);
}

@media (pointer: coarse) {
  .context-bar :deep(.context-bar__button) {
    width: var(--selbar-height-touch);
    height: var(--selbar-height-touch);
  }

  .context-bar :deep(.context-bar__done) {
    width: auto;
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
  outline-offset: -2px;
}
</style>
