<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Bead } from '../../domain/beads'
import type { Technique } from '../../domain/grid'
import { isSlowFramingSize } from '../../domain/imageFraming'
import { estimatedSizeMm, formatSizeMm, gridFromSize, type StatedSize } from '../../domain/projectSize'
import { useSizeUnit } from '../../composables/project/useSizeUnit'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import AppModal from '../ui/AppModal.vue'
import FormField from '../ui/form/FormField.vue'
import NumberField from '../ui/form/NumberField.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'

/**
 * The size step Convert image keeps (ticket 342, ADR 0026): a picture needs a Pattern size before there is a Frame to
 * fit it into, and the New Project form no longer asks for one. Width and Height in beads or mm (the unit is the
 * device's, shared with the Frame section), the size in the other unit beside them, and the slow-framing heads-up
 * (ticket 61) for the Bead and Technique chosen in the form. A typed mm value rounds up to whole beads (gridFromSize).
 */
const props = defineProps<{
  bead: Bead
  technique: Technique
  slowFramingCellThresholds: Record<Technique, number>
}>()

const emit = defineEmits<{
  confirm: [size: StatedSize]
  cancel: []
}>()

const { t, locale } = useI18n()

const unit = useSizeUnit()
const unitOptions = computed(() => [
  { value: 'beads' as const, label: t.value.form.unitBeads },
  { value: 'mm' as const, label: t.value.form.unitMm },
])

/** What the fields hold: a number field hands back a number once it is typed into or stepped. */
const widthText = ref<string | number>('')
const heightText = ref<string | number>('')
const touched = ref({ width: false, height: false })

const width = computed(() => Number(widthText.value))
const height = computed(() => Number(heightText.value))

/** A size in beads is a whole number of them, at least one; mm just has to be positive. */
const isSizeStated = computed(() => {
  const stated = String(widthText.value).trim() !== '' && String(heightText.value).trim() !== '' && width.value > 0 && height.value > 0
  return unit.value === 'beads' ? stated && Number.isInteger(width.value) && Number.isInteger(height.value) : stated
})

const dimensions = computed(() =>
  isSizeStated.value ? gridFromSize({ width: width.value, height: height.value, unit: unit.value }, props.bead) : undefined,
)

/** The stated size in the other unit: "≈ 3.0 × 2.2 cm" for beads, "≈ 20×10 beads" for mm. */
const estimate = computed(() => {
  const grid = dimensions.value
  if (!grid) return undefined
  if (unit.value === 'mm') {
    return t.value.form.estimateBeads.replace('{columns}', String(grid.columns)).replace('{rows}', String(grid.rows))
  }
  return `≈ ${formatSizeMm(estimatedSizeMm(grid, props.bead), { mm: t.value.form.unitMm, cm: t.value.form.unitCm }, locale.value)}`
})

const techniqueLabel = computed<Record<Technique, string>>(() => ({
  loom: t.value.form.techniqueLoom,
  peyote: t.value.form.techniquePeyote,
  brick: t.value.form.techniqueBrick,
}))

const slowFramingWarning = computed(() =>
  dimensions.value && isSlowFramingSize(props.technique, dimensions.value, props.slowFramingCellThresholds)
    ? t.value.convertImage.slowFramingWarning.replace('{technique}', techniqueLabel.value[props.technique])
    : undefined,
)

/** A size field's error, saying what to enter (`writing.md`, Field error); none until the field has been left. */
function sizeError(text: string | number, value: number, field: 'width' | 'height'): string | undefined {
  if (!touched.value[field]) return undefined
  if (String(text).trim() === '' || !(value > 0)) return field === 'width' ? t.value.form.enterWidth : t.value.form.enterHeight
  if (unit.value === 'beads' && !Number.isInteger(value)) return t.value.form.enterWholeBeads
  return undefined
}
const widthError = computed(() => sizeError(widthText.value, width.value, 'width'))
const heightError = computed(() => sizeError(heightText.value, height.value, 'height'))

function onConfirm() {
  if (!isSizeStated.value) {
    touched.value = { width: true, height: true }
    return
  }
  emit('confirm', { width: width.value, height: height.value, unit: unit.value })
}
</script>

<template>
  <AppModal :title="t.convertImage.sizeTitle" size="confirm" data-testid="convert-size-dialog" @cancel="emit('cancel')">
    <form class="convert-size" novalidate @submit.prevent="onConfirm">
      <p class="convert-size__message">{{ t.convertImage.sizeMessage }}</p>

      <FormField :label="t.form.unitLabel" label-id="convert-size-unit-label">
        <template v-if="estimate" #aside>
          <span data-testid="convert-size-estimate">{{ estimate }}</span>
        </template>
        <SegmentedControl v-model="unit" :options="unitOptions" mono labelledby="convert-size-unit-label" data-testid="convert-size-unit" />
      </FormField>

      <div class="convert-size__pair">
        <FormField :label="t.form.widthLabel" label-for="width-input" :error="widthError" error-testid="width-error">
          <NumberField
            id="width-input"
            v-model="widthText"
            data-testid="width-input"
            testid-prefix="width-input"
            data-autofocus
            :whole="unit === 'beads'"
            :invalid="!!widthError"
            :min="unit === 'beads' ? 1 : 0"
            :step="unit === 'beads' ? 1 : 'any'"
            stepper
            :digits-only="unit === 'beads'"
            :placeholder="unit"
            :decrease-label="t.form.decreaseWidthButton"
            :increase-label="t.form.increaseWidthButton"
            @blur="touched.width = true"
          />
        </FormField>
        <FormField :label="t.form.heightLabel" label-for="height-input" :error="heightError" error-testid="height-error">
          <NumberField
            id="height-input"
            v-model="heightText"
            data-testid="height-input"
            testid-prefix="height-input"
            :whole="unit === 'beads'"
            :invalid="!!heightError"
            :min="unit === 'beads' ? 1 : 0"
            :step="unit === 'beads' ? 1 : 'any'"
            stepper
            :digits-only="unit === 'beads'"
            :placeholder="unit"
            :decrease-label="t.form.decreaseHeightButton"
            :increase-label="t.form.increaseHeightButton"
            @blur="touched.height = true"
          />
        </FormField>
      </div>

      <p v-if="slowFramingWarning" class="convert-size__warning" data-testid="convert-image-slow-framing-warning">
        <AppIcon name="warning" :size="14" />
        <span>{{ slowFramingWarning }}</span>
      </p>
    </form>
    <template #actions>
      <AppButton variant="in-box" data-testid="convert-size-cancel" @click="emit('cancel')">
        {{ t.convertImage.cancelButton }}
      </AppButton>
      <AppButton variant="primary" :disabled="!isSizeStated" data-testid="convert-size-continue" @click="onConfirm">
        {{ t.convertImage.sizeContinue }}
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.convert-size {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.convert-size__message {
  margin: 0;
  font: var(--type-body);
  color: var(--body);
}

.convert-size__pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-10);
}

.convert-size__warning {
  display: flex;
  gap: var(--space-6);
  align-items: flex-start;
  margin: 0;
  font: var(--type-meta);
  font-family: var(--font-sans);
  color: var(--body);
}

.convert-size__warning > .icon {
  margin-top: var(--space-2);
  color: var(--warning);
}
</style>
