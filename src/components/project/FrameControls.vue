<script setup lang="ts">
import { computed, useId } from 'vue'
import AppNote from '../ui/AppNote.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'
import BrickBlockField from './BrickBlockField.vue'
import { TECHNIQUES, type Technique } from '../../domain/grid'
import { resolveProjectBead, rowProgressStarted, type Project } from '../../domain/project'
import { formatOtherUnit } from '../../domain/projectSize'
import { useSizeUnit } from '../../composables/project/useSizeUnit'
import { techniqueName } from '../../i18n/techniqueName'
import { useI18n } from '../../i18n/useI18n'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'

// The Frame's part of the Project panel (ProjectPanel and Frame cards, tickets 233, 443): the Technique choice and the
// Frame's Estimated size with its warning as a Note (ticket 328). Edit/Fit/Remove Frame live on the Selection and
// Progress bars (spec 0440). Once a Row progress pass is done the Technique is locked, with the reason under it.
const props = defineProps<{ project: Project }>()

const emit = defineEmits<{ 'set-technique': [technique: Technique]; 'set-brick-block': [brickBlock: number] }>()

const { t, locale } = useI18n()

const frame = computed(() => props.project.frame)
const locked = computed(() => rowProgressStarted(props.project))
const bead = computed(() => resolveProjectBead(props.project))

/** The unit the Estimated size leads with: kept on the device, never in the Project (ticket 342). */
const { unit } = useSizeUnit()

/** The Estimated size in the other unit: mm while the unit is beads, the bead count while it is mm. */
const estimate = computed(() =>
  bead.value && frame.value
    ? formatOtherUnit(frame.value, bead.value, unit.value, { mm: t.value.form.unitMm, cm: t.value.form.unitCm, beadsTemplate: t.value.form.estimateBeads }, locale.value)
    : undefined,
)

const techniqueLabelId = useId()
const brickBlockAction = controlAction('change-brick-block')
const techniqueAction = controlAction('change-technique')
/** The Technique choice, set on the open Project: choosing another is one Undo step (ticket 351). */
const technique = computed({
  get: () => props.project.technique,
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

const deps = computed(() => controlDeps({ activeProject: () => props.project }))
</script>

<template>
  <div class="frame-controls" data-testid="frame-controls">
    <div class="frame-controls__technique" data-testid="frame-technique-row">
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
      v-if="project.technique === 'brick'"
      :model-value="project.brickBlock ?? 1"
      :disabled="!brickBlockAction.enabled?.(deps)"
      :disabled-body="brickBlockAction.disabledBody?.(t, deps)"
      testid="frame-brick-block"
      @update:model-value="emit('set-brick-block', $event)"
    />

    <p v-if="locked" :id="lockedNoteId" class="frame-controls__note" data-testid="frame-locked">{{ t.size.lockedReason }}</p>

    <div v-if="estimate" class="frame-controls__estimate" data-testid="size-estimate-row">
      <span class="frame-controls__estimate-text" role="group" :aria-label="t.size.estimateLabel" data-testid="size-estimate">{{ estimate }}</span>
    </div>
    <AppNote v-if="estimate" data-testid="size-estimate-note">{{ t.size.estimateWarning }}</AppNote>
  </div>
</template>

<style scoped>
/* As wide as the sheet it sits in, so everything below wraps inside that width rather than setting its own. */
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
