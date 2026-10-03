<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDropSteps } from '../../composables/ui/useDropSteps'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from '../ui/AppIcon.vue'

/**
 * The design system's ContextBar (ticket 168; ContextBar card): a floating bar above the Progress bar, on phone and
 * iPad mini, offering what a Selection can do. While a Selection exists: its size, Copy, Rotate, Remove line and a
 * clear x, on `ink` with `canvas` text. Once Copy has armed the clipboard it turns `accent`: "Tap where to paste",
 * Rotate and Cancel (both "clear x" and Cancel back out of the same state -- see App.vue's backOutOfSelect).
 *
 * Its labels drop right to left as Russian doesn't fit (responsive.md, Fitting longer text) -- useDropSteps, the
 * same measured-priority idea useFitByPriority gives the header, generalized to more than one step.
 */
const props = defineProps<{
  /** The Selection's size in cells; absent once Copy has armed the clipboard (a Copy clears the Selection itself). */
  selectionSize?: { columns: number; rows: number }
  /** Whether a copied block is armed to paste (useSelectionGesture's pasteProjectionActive). */
  pasteArmed: boolean
  canRemoveLine: boolean
  /** Whether the Frame is being set: the bar then holds the Frame's size, Fit to drawing and Done (v16). */
  settingFrame?: boolean
  /** The Frame's size as it is now, "17×17 · 2.7 × 2.7 cm", while it is being set. */
  frameSummary?: string
  /** Why Rotate is off, when it is: it turns the Frame, so it needs one, and waits while Row progress is on. It is named by this too. */
  rotateOff?: string
}>()

const emit = defineEmits<{
  copy: []
  rotate: []
  'remove-line': []
  'fit-frame': []
  'done-frame': []
  /** The pre-copy clear x and the post-copy Cancel both just back out one step (App.vue's backOutOfSelect). */
  dismiss: []
}>()

const { t } = useI18n()

const rowEl = ref<HTMLElement>()
const dropped = useDropSteps(rowEl, 3, [() => props.pasteArmed, () => t.value.contextBar])

const sizeText = computed(() => (props.selectionSize ? `${props.selectionSize.columns}×${props.selectionSize.rows}` : ''))
</script>

<template>
  <div
    v-if="settingFrame || selectionSize || pasteArmed"
    ref="rowEl"
    class="context-bar"
    :class="{ 'context-bar--armed': pasteArmed && !settingFrame }"
    role="toolbar"
    :aria-label="t.contextBar.label"
    data-testid="context-bar"
  >
    <template v-if="settingFrame">
      <span class="context-bar__size context-bar__frame-size" data-testid="context-bar-frame-size">{{ frameSummary }}</span>
      <button
        type="button"
        class="ui-control context-bar__button"
        :aria-label="t.frame.fitToDrawing"
        :title="t.frame.fitToDrawing"
        data-testid="context-bar-fit-frame"
        @click="emit('fit-frame')"
      >
        <AppIcon name="frame" :size="16" />
      </button>
      <button type="button" class="ui-control context-bar__button" data-testid="context-bar-done-frame" @click="emit('done-frame')">
        <AppIcon name="check" :size="16" />
        <span>{{ t.frame.done }}</span>
      </button>
    </template>
    <template v-else-if="!pasteArmed">
      <span class="context-bar__size" data-testid="context-bar-size">{{ sizeText }}</span>
      <button type="button" class="ui-control context-bar__button" data-testid="context-bar-copy" data-tour="copy" @click="emit('copy')">
        <AppIcon name="copy" :size="16" />
        <span v-if="dropped < 3">{{ t.tools.copyButton }}</span>
      </button>
      <button type="button" class="ui-control context-bar__button" data-testid="context-bar-rotate" :disabled="!!rotateOff" :aria-label="rotateOff" :title="rotateOff" @click="emit('rotate')">
        <AppIcon name="rotate" :size="16" />
        <span v-if="dropped < 2">{{ t.palette.rotateButton }}</span>
      </button>
      <button
        type="button"
        class="ui-control context-bar__button"
        data-testid="context-bar-remove-line"
        data-tour="remove-line"
        :disabled="!canRemoveLine"
        @click="emit('remove-line')"
      >
        <AppIcon name="remove-line" :size="16" />
        <span v-if="dropped < 1">{{ t.tools.removeLineShort }}</span>
      </button>
      <button
        type="button"
        class="ui-control context-bar__button context-bar__button--round"
        :aria-label="t.contextBar.clearButton"
        data-testid="context-bar-clear"
        @click="emit('dismiss')"
      >
        <AppIcon name="close" :size="16" />
      </button>
    </template>
    <template v-else>
      <span class="context-bar__hint" data-testid="context-bar-hint">{{ t.contextBar.pasteHint }}</span>
      <button type="button" class="ui-control context-bar__button context-bar__button--accent" data-testid="context-bar-rotate" :disabled="!!rotateOff" :aria-label="rotateOff" :title="rotateOff" @click="emit('rotate')">
        <AppIcon name="rotate" :size="16" />
        <span v-if="dropped < 1">{{ t.palette.rotateButton }}</span>
      </button>
      <button type="button" class="ui-control context-bar__button context-bar__button--accent" data-testid="context-bar-cancel" @click="emit('dismiss')">
        <span>{{ t.contextBar.cancelButton }}</span>
      </button>
    </template>
  </div>
</template>

<style scoped>
/* 10px from the screen edges, on ink, elevation-3, 14px radius (ContextBar card). */
.context-bar {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  box-sizing: border-box;
  height: 2.5rem;
  padding: 0 var(--space-10);
  color: var(--canvas);
  background: var(--ink);
  border-radius: var(--context-bar-radius);
  box-shadow: var(--elevation-3);
}

.context-bar--armed {
  color: var(--on-accent);
  background: var(--accent);
}

.context-bar__size {
  flex: none;
  font: var(--type-meta);
  color: inherit;
  opacity: 0.8;
}

.context-bar__hint {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  font: var(--type-small);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.context-bar__button {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-6);
  height: 2.5rem;
  padding: 0 var(--space-8);
  font: var(--type-small);
  color: inherit;
  background: none;
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.context-bar__button--round {
  padding: 0;
  width: 2.5rem;
  justify-content: center;
}

.context-bar__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.context-bar__button:focus-visible {
  outline: var(--focus-width) solid var(--canvas);
  outline-offset: -2px;
}

.context-bar--armed .context-bar__button:focus-visible {
  outline-color: var(--on-accent);
}
</style>
