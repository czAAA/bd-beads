<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDropSteps } from '../../composables/ui/useDropSteps'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import IconButton from '../ui/IconButton.vue'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import type { Project } from '../../domain/project'

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
  /** The open Project: what the actions' enabled states and disabled reasons read (ADR 0035). */
  project: Project
  canRemoveLine: boolean
  /** Whether the Frame is being set: the bar then holds the Frame's size, Fit to drawing and Done (v16). */
  settingFrame?: boolean
  /** The Frame's size as it is now, "17×17 · 2.7 × 2.7 cm", while it is being set. */
  frameSummary?: string
}>()

const emit = defineEmits<{
  copy: []
  rotate: []
  'remove-line': []
  'fit-frame': []
  'remove-frame': []
  'done-frame': []
  /** The pre-copy clear x and the post-copy Cancel both just back out one step (App.vue's backOutOfSelect). */
  dismiss: []
}>()

const { t } = useI18n()

const rowEl = ref<HTMLElement>()
const dropped = useDropSteps(rowEl, 3, [() => props.pasteArmed, () => t.value.contextBar])

/** Every button is a registry action, so its name, Tooltip, key and disabled reason come from there, as in the Toolbox. */
const actions = {
  fit: controlAction('fit-to-drawing'),
  removeFrame: controlAction('remove-frame'),
  done: controlAction('done-frame'),
  copy: controlAction('copy'),
  rotate: controlAction('rotate'),
  removeLine: controlAction('remove-line'),
  clear: controlAction('clear-selection'),
  cancel: controlAction('cancel-paste'),
}

const deps = computed(() =>
  controlDeps({
    activeProject: () => props.project,
    hasSelection: () => !!props.selectionSize,
    canRemoveSelectedLine: () => props.canRemoveLine,
  }),
)

/** A button whose label has dropped keeps its name in the Tooltip: the icon-only button, over the same action. */
const labelled = (step: number) => (dropped.value < step ? AppButton : IconButton)

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
      <IconButton class="context-bar__button" icon="frame" :action="actions.fit" :deps="deps" data-testid="context-bar-fit-frame" @click="emit('fit-frame')" />
      <IconButton
        v-if="project.frame"
        class="context-bar__button"
        :action="actions.removeFrame"
        :deps="deps"
        data-testid="context-bar-remove-frame"
        @click="emit('remove-frame')"
      />
      <AppButton class="context-bar__button" :action="actions.done" :deps="deps" data-testid="context-bar-done-frame" @click="emit('done-frame')" />
    </template>
    <template v-else-if="!pasteArmed">
      <span class="context-bar__size" data-testid="context-bar-size">{{ sizeText }}</span>
      <component :is="labelled(3)" class="context-bar__button" :action="actions.copy" :deps="deps" data-testid="context-bar-copy" data-tour="copy" @click="emit('copy')" />
      <component :is="labelled(2)" class="context-bar__button" :action="actions.rotate" :deps="deps" data-testid="context-bar-rotate" @click="emit('rotate')" />
      <component
        :is="labelled(1)"
        class="context-bar__button"
       
        :action="actions.removeLine"
        :deps="deps"
        data-testid="context-bar-remove-line"
        data-tour="remove-line"
        @click="emit('remove-line')"
      />
      <IconButton class="context-bar__button" shape="round" :action="actions.clear" :deps="deps" data-testid="context-bar-clear" @click="emit('dismiss')" />
    </template>
    <template v-else>
      <span class="context-bar__hint" data-testid="context-bar-hint">{{ t.contextBar.pasteHint }}</span>
      <component :is="labelled(1)" class="context-bar__button" :action="actions.rotate" :deps="deps" data-testid="context-bar-rotate" @click="emit('rotate')" />
      <AppButton class="context-bar__button" :action="actions.cancel" :deps="deps" data-testid="context-bar-cancel" @click="emit('dismiss')" />
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

.context-bar :deep(.context-bar__button) {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  gap: var(--space-6);
  width: auto;
  min-width: 2.5rem;
  height: 2.5rem;
  padding: 0 var(--space-8);
  font: var(--type-small);
  color: inherit;
  background: none;
  border: 0;
  border-radius: var(--radius-sm);
}

.context-bar :deep(.icon-btn--round.context-bar__button) {
  width: 2.5rem;
  padding: 0;
}

.context-bar :deep(.context-bar__button[aria-disabled='true']) {
  color: inherit;
  background: none;
  opacity: 0.5;
}

@media (hover: hover) {
  .context-bar :deep(.context-bar__button:hover:not([aria-disabled='true'])) {
    background: none;
    opacity: 0.8;
  }
}

.context-bar :deep(.context-bar__button:focus-visible) {
  outline: var(--focus-width) solid var(--canvas);
  outline-offset: -2px;
}

.context-bar--armed :deep(.context-bar__button:focus-visible) {
  outline-color: var(--on-accent);
}
</style>
