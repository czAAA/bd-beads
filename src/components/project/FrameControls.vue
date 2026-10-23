<script setup lang="ts">
import { computed, inject, useId } from 'vue'
import AppButton from '../ui/AppButton.vue'
import AppNote from '../ui/AppNote.vue'
import { PANEL_CONTEXT } from '../shell/panelContext'
import SegmentedControl from '../ui/form/SegmentedControl.vue'
import BrickBlockField from './BrickBlockField.vue'
import { describeWeave, TECHNIQUES, type Technique } from '../../domain/weave'
import { frameWeave, resolveProjectBead, rowProgressStarted, type Project } from '../../domain/project'
import { formatOtherUnit } from '../../domain/projectSize'
import { useSizeUnit } from '../../composables/project/useSizeUnit'
import { techniqueName } from '../../i18n/techniqueName'
import { useI18n } from '../../i18n/useI18n'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'

// The Frame's part of the Project panel (ProjectPanel and Frame cards, tickets 233, 443, 492): the Frame's own Technique choice and the
// Frame's Estimated size with its warning as a Note (ticket 328). Right-angle weave is fixed when the Project is made, so
// it offers no choice (ticket 482). Once a Row progress pass is done the Technique is locked, with the reason under it.
const props = defineProps<{ project: Project }>()

const emit = defineEmits<{ 'set-technique': [technique: Technique]; 'set-brick-block': [brickBlock: number] }>()

const { t, locale } = useI18n()

const frame = computed(() => props.project.frame)
const locked = computed(() => rowProgressStarted(props.project))
const bead = computed(() => resolveProjectBead(props.project))

/** The unit the Estimated size leads with: kept on the device, never in the Project (ticket 342). */
const { unit, countTemplate } = useSizeUnit(() => frameWeave(props.project).technique)

/** The Estimated size in the other unit: mm while the unit is beads, the bead count while it is mm. */
const estimate = computed(() =>
  bead.value && frame.value
    ? formatOtherUnit(frame.value, bead.value, unit.value, { mm: t.value.form.unitMm, cm: t.value.form.unitCm, beadsTemplate: countTemplate.value }, locale.value, props.project)
    : undefined,
)

const techniqueLabelId = useId()
const brickBlockAction = controlAction('change-brick-block')
const techniqueAction = controlAction('change-technique')
/** The Technique choice, set on the open Project: choosing another is one Undo step (ticket 351). */
const technique = computed({
  get: () => frameWeave(props.project).technique,
  set: (value: Technique) => emit('set-technique', value),
})
const techniqueOptions = computed(() => {
  const body = techniqueAction.body?.(t.value)
  const disabledBody = techniqueAction.disabledBody?.(t.value, deps.value)
  return TECHNIQUES.map((value) => {
    const name = techniqueName(t.value, value)
    return { value, label: name, tooltip: { name, body, disabledBody } }
  })
})

const lockedNoteId = useId()

// Add Frame from Template, or Replace Frame with one (ticket 495): the Template gallery and its setup are the panel's subpanels.
const panel = inject(PANEL_CONTEXT, undefined)
const templateAction = computed(() => controlAction(frame.value ? 'replace-frame' : 'add-frame-from-template'))

const deps = computed(() => controlDeps({ activeProject: () => props.project }))
</script>

<template>
  <div class="frame-controls" data-testid="frame-controls">
    <div v-if="project.frame" class="frame-controls__technique" data-testid="frame-technique-row">
      <span :id="techniqueLabelId">{{ t.form.techniqueLabel }}</span>
      <SegmentedControl
        v-model="technique"
        :options="techniqueOptions"
        :disabled="!techniqueAction.enabled?.(deps)"
        small
        :labelledby="techniqueLabelId"
        data-testid="frame-technique"
      />
    </div>

    <BrickBlockField
      v-if="project.frame && describeWeave(frameWeave(project)).hasBrickBlock"
      :model-value="frameWeave(project).brickBlock ?? 1"
      :disabled="!brickBlockAction.enabled?.(deps)"
      :disabled-body="brickBlockAction.disabledBody?.(t, deps)"
      testid="frame-brick-block"
      @update:model-value="emit('set-brick-block', $event)"
    />

    <AppButton
      variant="secondary"
      size="sm"
      :action="templateAction"
      :deps="deps"
      data-testid="frame-from-template"
      @click="panel?.openSub(templateAction.name(t))"
    />

    <p v-if="locked" :id="lockedNoteId" class="frame-controls__note" data-testid="frame-locked">{{ t.size.lockedReason }}</p>

    <div v-if="estimate" class="frame-controls__estimate" data-testid="size-estimate-row">
      <span class="frame-controls__estimate-text" role="group" :aria-label="t.size.estimateLabel" data-testid="size-estimate">{{ estimate }}</span>
    </div>
    <AppNote v-if="estimate" data-testid="size-estimate-note">{{ t.size.estimateWarning }}</AppNote>
  </div>
</template>

<style scoped>
/* As wide as the panel it sits in, so everything below wraps inside that width rather than setting its own. */
.frame-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.frame-controls__technique {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  font: var(--type-control);
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
