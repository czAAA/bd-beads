<script setup lang="ts">
import { computed, ref } from 'vue'
import { DEFAULT_BEAD, findBead, offeredBeads } from '../../domain/beads'
import { resolveProjectBead, type CreateProjectInput, type Project } from '../../domain/project'
import { formatMm, formatSizeMm, estimatedSizeMm } from '../../domain/projectSize'
import { clampAxis, starterProjectInput, type Starter, type StarterAxis } from '../../domain/starters'
import { describeWeave, type Technique } from '../../domain/weave'
import { techniqueName } from '../../i18n/techniqueName'
import { useI18n } from '../../i18n/useI18n'
import AppNote from '../ui/AppNote.vue'
import AppStepper from '../ui/form/AppStepper.vue'
import FormField from '../ui/form/FormField.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'
import TextField from '../ui/form/TextField.vue'
import StarterPicture from './StarterPicture.vue'
import BeadPicker from './BeadPicker.vue'
import BrickBlockField from './BrickBlockField.vue'

// The Starter setup (tickets 493, 495; StarterGallery card): Name, Bead, Techniques, Brick block, unit, sizes and the
// Estimated size; Create is the panel's pinned footer button. With a `project` it sets up a Frame on that open Project
// instead: no Name or Bead, the Project's own Bead measures the size.
const props = defineProps<{ starter: Starter; project?: Project }>()
const emit = defineEmits<{ submit: [payload: CreateProjectInput] }>()

const { t, locale } = useI18n()

const name = ref('')
const beadId = ref(props.project?.beadId ?? DEFAULT_BEAD.id)
const technique = ref<Technique>(props.starter.technique)
const brickBlock = ref(1)
const columns = ref(props.starter.width.default)
const rows = ref(props.starter.height.default)

/** How the sizes are read: the stepper's number stays a count of beads (Units), and mm or cm only change what it shows. */
type ShownUnit = 'beads' | 'mm' | 'cm'
const unit = ref<ShownUnit>('beads')

const weave = computed(() => ({ technique: technique.value }))
const countsUnits = computed(() => describeWeave(weave.value).countsUnits)
const unitOptions = computed(() => [
  { value: 'beads' as const, label: countsUnits.value ? t.value.form.unitUnits : t.value.form.unitBeads },
  { value: 'mm' as const, label: t.value.form.unitMm },
  { value: 'cm' as const, label: t.value.form.unitCm },
])

const techniqueOptions = computed(() => props.starter.techniques.map((value) => ({ value, label: techniqueName(t.value, value) })))
const bead = computed(() => (props.project ? resolveProjectBead(props.project) : findBead(beadId.value)))

/** The size the Frame will have, in the Bead's real measure. */
const estimated = computed(() => {
  if (!bead.value) return undefined
  const positions = describeWeave(weave.value).positionsOf({ columns: columns.value, rows: rows.value })
  return estimatedSizeMm({ ...positions, ...weave.value }, bead.value)
})
const estimateText = computed(() => (estimated.value ? formatSizeMm(estimated.value, { mm: t.value.form.unitMm, cm: t.value.form.unitCm }, locale.value) : ''))

/** What a side's field shows in mm or cm, or nothing in beads (the number is the count). */
function shownAs(mm: number | undefined): string | undefined {
  if (mm === undefined || unit.value === 'beads') return undefined
  return unit.value === 'cm' ? `${formatMm(mm / 10, locale.value)} ${t.value.form.unitCm}` : `${formatMm(mm, locale.value)} ${t.value.form.unitMm}`
}
const widthShown = computed(() => shownAs(estimated.value?.widthMm))
const heightShown = computed(() => shownAs(estimated.value?.heightMm))

function setSide(side: 'width' | 'height', value: number) {
  const axis = props.starter[side]
  if (side === 'width') columns.value = clampAxis(axis, value)
  else rows.value = clampAxis(axis, value)
}

const sides = computed(() => [
  { side: 'width' as const, axis: props.starter.width, model: columns, label: t.value.form.widthLabel, shown: widthShown.value, decrease: t.value.form.decreaseWidthButton, increase: t.value.form.increaseWidthButton },
  { side: 'height' as const, axis: props.starter.height, model: rows, label: t.value.form.heightLabel, shown: heightShown.value, decrease: t.value.form.decreaseHeightButton, increase: t.value.form.increaseHeightButton },
])

function presetsOf(axis: StarterAxis): readonly number[] {
  return axis.lock ? [] : (axis.presets ?? [])
}

function onSubmit() {
  emit(
    'submit',
    starterProjectInput(props.starter, {
      technique: technique.value,
      brickBlock: brickBlock.value,
      beadId: beadId.value,
      name: name.value.trim() || t.value.starters[props.starter.id].name,
      columns: columns.value,
      rows: rows.value,
    }),
  )
}
</script>

<template>
  <form id="starter-setup-form" class="starter-setup" novalidate data-testid="starter-setup" @submit.prevent="onSubmit">
    <div class="starter-setup__sample">
      <span class="starter-setup__picture">
        <StarterPicture :technique="technique" :columns="starter.width.default" :rows="starter.height.default" :seed-text="starter.id" />
      </span>
      <AppNote data-testid="starter-sample-note">{{ t.starters.sampleNote }}</AppNote>
    </div>

    <FormField v-if="!project" :label="t.form.nameLabel" label-for="starter-name-input" :aside="t.form.optional">
      <TextField
        id="starter-name-input"
        v-model="name"
        data-testid="starter-name-input"
        type="text"
        :placeholder="t.starters[starter.id].name"
      />
    </FormField>

    <FormField v-if="!project" :label="t.form.beadLabel" label-id="starter-bead-label">
      <BeadPicker v-model="beadId" :beads="offeredBeads()" testid="starter-bead-picker" />
    </FormField>

    <FormField v-if="techniqueOptions.length > 1" :label="t.form.techniqueLabel" label-id="starter-technique-label">
      <SegmentedControl
        v-model="technique"
        :options="techniqueOptions"
        labelledby="starter-technique-label"
        data-testid="starter-technique"
      />
    </FormField>

    <BrickBlockField v-if="describeWeave(weave).hasBrickBlock" v-model="brickBlock" testid="starter-brick-block" />

    <FormField :label="t.form.unitLabel" label-id="starter-unit-label">
      <SegmentedControl v-model="unit" :options="unitOptions" mono labelledby="starter-unit-label" data-testid="starter-unit" />
    </FormField>

    <div v-for="entry in sides" :key="entry.side" class="starter-setup__side" :data-testid="`starter-${entry.side}`">
      <span :id="`starter-${entry.side}-label`" class="starter-setup__label">{{ entry.label }}</span>
      <AppStepper
        :model-value="entry.model.value"
        :min="entry.axis.min"
        :max="entry.axis.max"
        :disabled="entry.axis.lock"
        :value-label="entry.label"
        :decrease-label="entry.decrease"
        :increase-label="entry.increase"
        :display="entry.shown"
        :decrease-testid="`starter-${entry.side}-decrease`"
        :increase-testid="`starter-${entry.side}-increase`"
        :value-testid="`starter-${entry.side}-value`"
        @update:model-value="setSide(entry.side, $event)"
      />
      <p v-if="entry.axis.lock" class="starter-setup__fixed" :data-testid="`starter-${entry.side}-fixed`">{{ t.starters.fixedNote }}</p>
      <div
        v-else-if="presetsOf(entry.axis).length"
        class="starter-setup__presets"
        role="group"
        :aria-labelledby="`starter-${entry.side}-label`"
      >
        <button
          v-for="preset in presetsOf(entry.axis)"
          :key="preset"
          class="starter-setup__chip"
          type="button"
          :aria-pressed="entry.model.value === preset"
          :data-testid="`starter-${entry.side}-preset-${preset}`"
          @click="setSide(entry.side, preset)"
        >
          {{ preset }}
        </button>
      </div>
    </div>

    <p class="starter-setup__estimate" role="group" :aria-label="t.size.estimateLabel" data-testid="starter-estimate">
      {{ t.size.estimateLabel }}: <strong>{{ estimateText }}</strong>
    </p>
    <AppNote>{{ t.size.estimateWarning }}</AppNote>
  </form>
</template>

<style scoped>
.starter-setup {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.starter-setup__sample {
  display: flex;
  gap: var(--space-12);
  align-items: center;
}

.starter-setup__picture {
  flex: none;
  width: 6rem;
  height: 6rem;
}

.starter-setup__side {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.starter-setup__label {
  font: var(--type-control);
}

.starter-setup__presets {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-6);
}

.starter-setup__chip {
  min-width: 2.5rem;
  padding: var(--space-4) var(--space-10);
  font: var(--type-meta);
  color: var(--ink);
  cursor: pointer;
  background: var(--elevated);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-full);
  font-variant-numeric: tabular-nums;
}

.starter-setup__chip[aria-pressed='true'] {
  border-color: var(--accent-strong);
  box-shadow: inset 0 0 0 1px var(--accent-strong);
}

.starter-setup__chip:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.starter-setup__fixed,
.starter-setup__estimate {
  margin: 0;
  font: var(--type-meta);
  font-family: var(--font-sans);
  color: var(--muted);
}

.starter-setup__estimate strong {
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}
</style>
