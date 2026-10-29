<script setup lang="ts">
import { computed, useId } from 'vue'
import { BEAD_CATALOG, beadAfterPick, formFactorName, uniqueBy, type Bead } from '../../domain/beads'
import type { BeadShape } from '../../domain/weave'
import { useI18n } from '../../i18n/useI18n'
import PanelPicker from '../shell/PanelPicker.vue'
import BeadShapeField from './BeadShapeField.vue'

// The bead section (ProjectPanel and Frame cards, tickets 554, 568, 0687): Bead shape when bound, then Brand, Type and
// Size as three pickers on one row that narrow each other when given candidates. A pick only asks (`pick`): New Project
// sets its draft, a layer's panel confirms Replace Bead; until then the pickers keep showing the Bead they were given.
const props = defineProps<{
  /** The Bead shown, or nothing for one that is no longer offered. */
  bead?: Bead
  /** What it could switch to: everything offered but its own, with the catalog's Bead of its id when its copy is out of
   * date. Without them there are no pickers. */
  candidates?: readonly Bead[]
  /** The Bead shown differs from the catalog's of its id (ticket 534): its size shows "(as saved)" beside the catalog's. */
  outdated?: boolean
}>()
const shape = defineModel<BeadShape>('beadShape')
const emit = defineEmits<{ pick: [beadId: string] }>()

/** The size option standing for the Bead's own copy when it is out of date, as the catalog's Bead holds its id. */
const AS_SAVED = 'as-saved'

const { t } = useI18n()
const shapeLabelId = useId()
const own = computed(() => props.bead)
/** The candidates and the Bead shown, in the catalog's order. */
const entries = computed(() => {
  const candidates = props.candidates ?? []
  const all = own.value && !candidates.some((bead) => bead.id === own.value!.id) ? [...candidates, own.value] : [...candidates]
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
const sizes = computed(() => {
  const listed = entries.value
    .filter((bead) => bead.brand.id === own.value?.brand.id && bead.formFactor.id === own.value?.formFactor.id)
    .map((bead) => ({ value: bead.id, label: bead.size }))
  if (!props.outdated || !own.value) return listed
  const at = Math.max(0, listed.findIndex((option) => option.value === own.value!.id))
  // The button has room for the size alone; the menu and the button's name say "(as saved)".
  const saved = { value: AS_SAVED, label: `${own.value.size} ${t.value.replaceBead.outdatedPostfix}`, shortLabel: own.value.size }
  return [...listed.slice(0, at), saved, ...listed.slice(at)]
})
/** The size picker stands on the own copy, which an out-of-date Bead shows as its own option. */
const sizeShown = computed(() => (props.outdated ? AS_SAVED : (own.value?.id ?? '')))

/** Asks for a Bead other than the one shown; the catalog's Bead of its own id counts as other when the copy is out of date. */
function ask(bead: Bead | undefined) {
  if (bead && (bead.id !== own.value?.id || props.outdated)) emit('pick', bead.id)
}

function pickBrand(brandId: string) {
  if (own.value) ask(beadAfterPick(entries.value, own.value, { brandId }))
}

function pickType(formFactorId: string) {
  if (own.value) ask(beadAfterPick(entries.value, own.value, { formFactorId }))
}

function pickSize(beadId: string) {
  if (beadId !== AS_SAVED) ask(entries.value.find((bead) => bead.id === beadId))
}
</script>

<template>
  <div class="bead-section" data-testid="bead-section">
    <div v-if="shape" class="bead-section__shape" data-testid="bead-shape-row">
      <span :id="shapeLabelId">{{ t.form.beadShapeLabel }}</span>
      <BeadShapeField :model-value="shape" :labelledby="shapeLabelId" small testid="bead-shape" @update:model-value="shape = $event" />
    </div>
    <div v-if="own && candidates" class="bead-section__pickers" role="group" :aria-label="t.panels.project.bead">
      <PanelPicker bare :label="t.panels.project.beadBrand" :model-value="own.brand.id" :options="brands" data-testid="bead-brand" @update:model-value="pickBrand" />
      <PanelPicker bare :label="t.panels.project.beadType" :model-value="own.formFactor.id" :options="types" data-testid="bead-type" @update:model-value="pickType" />
      <PanelPicker bare :label="t.panels.project.beadSize" :model-value="sizeShown" :options="sizes" data-testid="bead-size" @update:model-value="pickSize" />
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
