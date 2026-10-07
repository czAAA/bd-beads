<script setup lang="ts">
import { computed, useId } from 'vue'
import AppButton from '../ui/AppButton.vue'
import AppNote from '../ui/AppNote.vue'
import AppStepper from '../ui/form/AppStepper.vue'
import { resolveProjectBead, type Project } from '../../domain/project'
import { estimatedSizeMm, formatSizeMm } from '../../domain/projectSize'
import { useI18n } from '../../i18n/useI18n'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'

/**
 * The body of the Frame row (MirrorSizeControls card, ticket 233): Columns and Rows steppers, Fit to drawing and Remove
 * Frame, and the Frame's Estimated size with its warning as a Note (ticket 328). With no Frame it says what a Frame is and offers Fit
 * to drawing; opening the row starts Set Frame on the canvas. While Row progress is on the Frame's size is locked and
 * the reason is written under the controls.
 */
const props = defineProps<{
  project: Project
  /** Offers Set Frame itself, for where opening the controls doesn't start it (the phone's Frame sheet). */
  withSetFrame?: boolean
}>()

const emit = defineEmits<{
  'set-size': [columns: number, rows: number]
  fit: []
  remove: []
  'set-frame': []
}>()

const { t, locale } = useI18n()

const frame = computed(() => props.project.frame)
const locked = computed(() => props.project.rowProgress.enabled)
const bead = computed(() => resolveProjectBead(props.project))

const columns = computed({
  get: () => frame.value?.columns ?? 0,
  set: (value: number) => emit('set-size', value, frame.value?.rows ?? 1),
})
const rows = computed({
  get: () => frame.value?.rows ?? 0,
  set: (value: number) => emit('set-size', frame.value?.columns ?? 1, value),
})

const estimate = computed(() => {
  if (!bead.value || !frame.value) {
    return undefined
  }
  return formatSizeMm(estimatedSizeMm(frame.value, bead.value), { mm: t.value.form.unitMm, cm: t.value.form.unitCm }, locale.value)
})

const lockedNoteId = useId()

const setFrameAction = controlAction('set-frame')
const fitAction = controlAction('fit-to-drawing')
const removeAction = controlAction('remove-frame')
const deps = computed(() => controlDeps({ activeProject: () => props.project }))
/** The steppers' reason while Row progress holds the Frame still. */
const lockedReason = computed(() => removeAction.disabledBody?.(t.value, deps.value))
</script>

<template>
  <div class="frame-controls" data-testid="frame-controls">
    <p v-if="!frame" class="frame-controls__note" data-testid="frame-explainer">{{ t.frame.explainer }}</p>

    <template v-if="frame">
      <label class="frame-controls__setting">
        <span>{{ t.frame.columnsLabel }}</span>
        <AppStepper
          v-model="columns"
          :min="1"
          :disabled="locked"
          tooltip
          :disabled-body="lockedReason"
          :decrease-label="t.frame.fewerColumns"
          :increase-label="t.frame.moreColumns"
          decrease-testid="frame-columns-decrease"
          increase-testid="frame-columns-increase"
          value-testid="frame-columns"
        />
      </label>
      <label class="frame-controls__setting">
        <span>{{ t.frame.rowsLabel }}</span>
        <AppStepper
          v-model="rows"
          :min="1"
          :disabled="locked"
          tooltip
          :disabled-body="lockedReason"
          :decrease-label="t.frame.fewerRows"
          :increase-label="t.frame.moreRows"
          decrease-testid="frame-rows-decrease"
          increase-testid="frame-rows-increase"
          value-testid="frame-rows"
        />
      </label>
    </template>

    <!-- While Row progress is on the buttons stay hoverable and say why they are locked, and the reason is written below. -->
    <div class="frame-controls__actions">
      <AppButton v-if="withSetFrame" variant="primary" :action="setFrameAction" data-testid="frame-set" @click="emit('set-frame')" />
      <AppButton variant="toolbox" :action="fitAction" :deps="deps" data-testid="frame-fit" @click="emit('fit')" />
      <AppButton v-if="frame" variant="toolbox" :action="removeAction" :deps="deps" data-testid="frame-remove" @click="emit('remove')" />
    </div>
    <p v-if="locked" :id="lockedNoteId" class="frame-controls__note" data-testid="frame-locked">{{ t.size.lockedReason }}</p>

    <div v-if="estimate" class="frame-controls__estimate" data-testid="size-estimate-row">
      <span class="frame-controls__estimate-text" role="group" :aria-label="t.size.estimateLabel" data-testid="size-estimate">≈ {{ estimate }}</span>
    </div>
    <AppNote v-if="estimate" data-testid="size-estimate-note">{{ t.size.estimateWarning }}</AppNote>
  </div>
</template>

<style scoped>
/*
 * As wide as the Tool group it sits in (a full row of ToolGroup's fixed columns — ticket 114 made the Toolbox a narrow
 * rail), so everything below wraps inside that width rather than setting one of its own: the estimate and the notes
 * wrap, and each row's counter and "change from" choice fall onto as many lines as they need.
 */
.frame-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.frame-controls__setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  font: var(--type-control);
}

.frame-controls__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8);
}

.frame-controls__estimate {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.frame-controls__estimate-text {
  font-weight: 700;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.frame-controls__note {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.35;
  opacity: 0.75;
}
</style>
