<script setup lang="ts">
import { computed, useId } from 'vue'
import { BEAD_CATALOG, beadAfterPick, formFactorName, uniqueBy, type Bead } from '../../domain/beads'
import type { BeadShape } from '../../domain/weave'
import { useI18n } from '../../i18n/useI18n'
import PanelPicker from '../shell/PanelPicker.vue'
import BeadShapeField from './BeadShapeField.vue'

// The bead section shared by New Project and the Project panel (ProjectPanel card, tickets 554, 568): Bead shape, then
// Brand, Type and Size as three pickers on one row that narrow each other. A pick only asks (`pick`): New Project sets
// its draft, the Project panel's shell confirms Replace Bead; until then the pickers keep showing the Bead they were given.
const props = defineProps<{
  /** The Bead shown, or nothing for one that is no longer offered. */
  bead: Bead | undefined
  /** What it could switch to: everything offered but its own, with the catalog's Bead of its id when its copy is out of date. */
  candidates: readonly Bead[]
}>()
const shape = defineModel<BeadShape>('beadShape', { required: true })
const emit = defineEmits<{ pick: [beadId: string] }>()

const { t } = useI18n()
const shapeLabelId = useId()
const own = computed(() => props.bead)
/** The candidates and the Bead shown, in the catalog's order. */
const entries = computed(() => {
  const all = own.value && !props.candidates.some((bead) => bead.id === own.value!.id) ? [...props.candidates, own.value] : [...props.candidates]
  const rank = (bead: Bead) => BEAD_CATALOG.findIndex((listed) => listed.id === bead.id) >>> 0
  return all.sort((a, b) => rank(a) - rank(b))
})

const brands = computed(() => uniqueBy(entries.value, (bead) => bead.brand.id).map((bead) => ({ value: bead.brand.id, label: bead.brand.name })))
const types = computed(() =>
  uniqueBy(
    entries.value.filter((bead) => bead.brand.id === own.value?.brand.id),
    (bead) => bead.formFactor.id,
  ).map((bead) => ({ value: bead.formFactor.id, label: formFactorName(bead.formFactor, t.value.formFactors) })),
)
const sizes = computed(() =>
  entries.value.filter((bead) => bead.brand.id === own.value?.brand.id && bead.formFactor.id === own.value?.formFactor.id).map((bead) => ({ value: bead.id, label: bead.size })),
)

function ask(bead: Bead | undefined) {
  if (bead && bead.id !== own.value?.id) emit('pick', bead.id)
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
  <div class="bead-section" data-testid="bead-section">
    <div class="bead-section__shape" data-testid="bead-shape-row">
      <span :id="shapeLabelId">{{ t.form.beadShapeLabel }}</span>
      <BeadShapeField :model-value="shape" :labelledby="shapeLabelId" small testid="bead-shape" @update:model-value="shape = $event" />
    </div>
    <div v-if="own" class="bead-section__pickers" role="group" :aria-label="t.panels.project.bead">
      <PanelPicker bare :label="t.panels.project.beadBrand" :model-value="own.brand.id" :options="brands" data-testid="bead-brand" @update:model-value="pickBrand" />
      <PanelPicker bare :label="t.panels.project.beadType" :model-value="own.formFactor.id" :options="types" data-testid="bead-type" @update:model-value="pickType" />
      <PanelPicker bare :label="t.panels.project.beadSize" :model-value="own.id" :options="sizes" data-testid="bead-size" @update:model-value="pickSize" />
    </div>
  </div>
</template>

<style scoped>
.bead-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-4) var(--space-10);
}

.bead-section__shape {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  min-height: var(--panel-item-height);
  font: var(--type-control);
  color: var(--ink);
}

.bead-section__pickers {
  display: flex;
  gap: var(--space-6);
}
</style>
