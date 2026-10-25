<script setup lang="ts">
import { computed, useId } from 'vue'
import { BEAD_CATALOG, beadAfterPick, type Bead } from '../../domain/beads'
import { resolveProjectBead, type Project } from '../../domain/project'
import { DEFAULT_BEAD_SHAPE, type BeadShape } from '../../domain/weave'
import { useI18n } from '../../i18n/useI18n'
import PanelPicker from '../shell/PanelPicker.vue'
import BeadShapeField from './BeadShapeField.vue'

// The bead section of the Project panel (ProjectPanel card, ticket 554): Bead shape, then Brand, Type and Size as three
// pickers on one row that narrow each other. A pick only asks (the shell confirms Replace Bead); until it is confirmed
// the pickers keep showing the Project's own Bead.
const props = defineProps<{
  project: Project
  /** What the Project could switch to: everything offered but its own, with the catalog's Bead of its id when its copy is out of date. */
  candidates: readonly Bead[]
}>()
const emit = defineEmits<{ 'set-bead-shape': [shape: BeadShape]; 'replace-bead': [beadId: string] }>()

const { t } = useI18n()
const shapeLabelId = useId()
const own = computed(() => resolveProjectBead(props.project))
/** The candidates and the Project's own Bead, in the catalog's order. */
const entries = computed(() => {
  const all = own.value && !props.candidates.some((bead) => bead.id === own.value!.id) ? [...props.candidates, own.value] : [...props.candidates]
  const rank = (bead: Bead) => BEAD_CATALOG.findIndex((listed) => listed.id === bead.id) >>> 0
  return all.sort((a, b) => rank(a) - rank(b))
})

function unique<T>(items: readonly T[], key: (item: T) => string): T[] {
  return items.filter((item, index) => items.findIndex((other) => key(other) === key(item)) === index)
}

const brands = computed(() => unique(entries.value, (bead) => bead.brand.id).map((bead) => ({ value: bead.brand.id, label: bead.brand.name })))
const types = computed(() =>
  unique(
    entries.value.filter((bead) => bead.brand.id === own.value?.brand.id),
    (bead) => bead.formFactor.id,
  ).map((bead) => ({ value: bead.formFactor.id, label: t.value.formFactors[bead.formFactor.nameKey] })),
)
const sizes = computed(() =>
  entries.value.filter((bead) => bead.brand.id === own.value?.brand.id && bead.formFactor.id === own.value?.formFactor.id).map((bead) => ({ value: bead.id, label: bead.size })),
)

function ask(bead: Bead | undefined) {
  if (bead && bead.id !== own.value?.id) emit('replace-bead', bead.id)
}

function pickBrand(brandId: string) {
  if (own.value) ask(beadAfterPick(entries.value, own.value, { brandId }))
}

function pickType(formFactorId: string) {
  if (own.value) ask(beadAfterPick(entries.value, own.value, { formFactorId }))
}

function pickSize(beadId: string) {
  ask(entries.value.find((bead) => bead.id === beadId))
}
</script>

<template>
  <div class="project-bead" data-testid="project-bead-section">
    <div class="project-bead__shape" data-testid="bead-shape-row">
      <span :id="shapeLabelId">{{ t.form.beadShapeLabel }}</span>
      <BeadShapeField :model-value="project.beadShape ?? DEFAULT_BEAD_SHAPE" :labelledby="shapeLabelId" small testid="bead-shape" @update:model-value="emit('set-bead-shape', $event)" />
    </div>
    <div v-if="own" class="project-bead__pickers" role="group" :aria-label="t.panels.project.bead">
      <PanelPicker bare :label="t.panels.project.beadBrand" :model-value="own.brand.id" :options="brands" data-testid="bead-brand" @update:model-value="pickBrand" />
      <PanelPicker bare :label="t.panels.project.beadType" :model-value="own.formFactor.id" :options="types" data-testid="bead-type" @update:model-value="pickType" />
      <PanelPicker bare :label="t.panels.project.beadSize" :model-value="own.id" :options="sizes" data-testid="bead-size" @update:model-value="pickSize" />
    </div>
  </div>
</template>

<style scoped>
.project-bead {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-4) var(--space-10);
}

.project-bead__shape {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  min-height: var(--panel-item-height);
  font: var(--type-control);
  color: var(--ink);
}

.project-bead__pickers {
  display: flex;
  gap: var(--space-6);
}
</style>
