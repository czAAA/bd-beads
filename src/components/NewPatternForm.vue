<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { BEAD_CATALOG, beadLabel, type Bead } from '../domain/beads'
import type { CreatePatternInput } from '../domain/pattern'
import type { SizeUnit, Technique } from '../domain/grid'
import {
  formatImageLimits,
  imageInputAccept,
  validateImageFile,
  type ImageRejection,
  type PixelData,
} from '../domain/imageConversion'
import { ImageConversionError, decodeImageFile, type DecodeImage } from '../domain/imageDecode'
import { isSlowFramingSize, SLOW_FRAMING_CELLS } from '../domain/imageFraming'
import { estimatedSizeMm, formatSizeMm, gridFromSize } from '../domain/patternSize'
import { useI18n } from '../i18n/useI18n'
import AppButton from './AppButton.vue'
import AppIcon from './AppIcon.vue'
import FieldSelect from './form/FieldSelect.vue'
import FileButton from './form/FileButton.vue'
import FormField from './form/FormField.vue'
import LoadingState from './LoadingState.vue'
import NumberField from './form/NumberField.vue'
import SegmentedControl from './form/SegmentedControl.vue'
import TextField from './form/TextField.vue'

const { t, locale } = useI18n()

const props = withDefaults(
  defineProps<{
    beads?: readonly Bead[]
    /**
     * How a chosen picture is turned into pixels (ticket 58). Defaults to the browser's own decoding; a test hands
     * over synthetic pixel data instead, since jsdom decodes no image bytes. Resolved where it is called rather than
     * through withDefaults, where a function default would be taken as the value itself.
     */
    decodeImage?: DecodeImage
    /**
     * The per-Technique cell-count thresholds the slow-framing hint (ticket 61) compares the current grid against.
     * Defaults to the real thresholds; a test overrides them to exercise the per-Technique lookup without the three
     * real constants having to differ from each other.
     */
    slowFramingCellThresholds?: Record<Technique, number>
  }>(),
  {
    beads: () => BEAD_CATALOG,
    decodeImage: undefined,
    slowFramingCellThresholds: () => SLOW_FRAMING_CELLS,
  },
)

const emit = defineEmits<{
  submit: [payload: CreatePatternInput]
  /**
   * The form's current values, emitted whenever any of them change (and once on mount). Convert image's frame is sized
   * from these, and follows them as they are edited during framing (ticket 58).
   */
  draft: [payload: CreatePatternInput]
  /** A picture that passed validation and decoded — the framing step's starting point. */
  'convert-image': [image: PixelData]
}>()

const name = ref('')
const beadId = ref(props.beads[0]!.id)
const technique = ref<Technique>('loom')
const widthText = ref('')
const heightText = ref('')
/** Beads by default (ADR 0017): a weaver counts beads, and mm/cm are converted to a grid once, through the chosen Bead. */
const unit = ref<SizeUnit>('beads')

const width = computed(() => Number(widthText.value))
const height = computed(() => Number(heightText.value))
const selectedBead = computed(() => props.beads.find((candidate) => candidate.id === beadId.value))
const namePlaceholder = computed(() => (selectedBead.value ? beadLabel(selectedBead.value) : ''))

/** A size in beads is a whole number of them, at least one; mm/cm just have to be positive. */
const isSizeStated = computed(() => {
  const stated = width.value > 0 && height.value > 0
  return unit.value === 'beads' ? stated && Number.isInteger(width.value) && Number.isInteger(height.value) : stated
})

/**
 * The grid the stated size works out to, in whichever unit it was stated: beads are the columns and rows directly, and
 * mm/cm are converted through the chosen Bead. The single source the slow-framing hint and (via the emitted
 * draft, see domain/pattern's patternGeometry) Convert image's frame all read, so none of them can disagree about it.
 */
const dimensions = computed(() =>
  isSizeStated.value && selectedBead.value
    ? gridFromSize({ width: width.value, height: height.value, unit: unit.value }, selectedBead.value)
    : undefined,
)

const isValid = computed(() => isSizeStated.value)

const techniqueOptions = computed(() => [
  { value: 'loom' as const, label: t.value.form.techniqueLoom },
  { value: 'peyote' as const, label: t.value.form.techniquePeyote },
  { value: 'brick' as const, label: t.value.form.techniqueBrick },
])

const unitOptions = computed(() => [
  { value: 'beads' as const, label: t.value.form.unitBeads },
  { value: 'mm' as const, label: t.value.form.unitMm },
  { value: 'cm' as const, label: t.value.form.unitCm },
])

/** Beside Unit: the stated size in the other unit (NewPatternForm card), "≈ 64 × 48 mm" or "≈ 40×30 beads". */
const estimate = computed(() => {
  const grid = dimensions.value
  const bead = selectedBead.value
  if (!grid || !bead) return undefined
  if (unit.value === 'beads') {
    return `≈ ${formatSizeMm(estimatedSizeMm(grid, bead), { mm: t.value.form.unitMm, cm: t.value.form.unitCm }, locale.value)}`
  }
  return t.value.form.estimateBeads.replace('{columns}', String(grid.columns)).replace('{rows}', String(grid.rows))
})

/** Which size fields have been left once, so their errors wait until then rather than greeting an empty form. */
const touched = ref({ width: false, height: false })

/** A size field's error, saying what to enter (`writing.md`, Field error); none until the field has been left. */
function sizeError(text: string, value: number, field: 'width' | 'height'): string | undefined {
  if (!touched.value[field]) return undefined
  if (text.trim() === '' || !(value > 0)) return field === 'width' ? t.value.form.enterWidth : t.value.form.enterHeight
  if (unit.value === 'beads' && !Number.isInteger(value)) return t.value.form.enterWholeBeads
  return undefined
}

const widthError = computed(() => sizeError(String(widthText.value), width.value, 'width'))
const heightError = computed(() => sizeError(String(heightText.value), height.value, 'height'))

const techniqueLabel = computed<Record<Technique, string>>(() => ({
  loom: t.value.form.techniqueLoom,
  peyote: t.value.form.techniquePeyote,
  brick: t.value.form.techniqueBrick,
}))

/**
 * The slow-framing heads-up (ticket 61): shown once the current Bead + Technique + size implies a grid at or past
 * that Technique's threshold (see domain/imageFraming's isSlowFramingSize), before any picture is even chosen. Live
 * off the same fields the form's own `draft` emit watches, so it needs no resubmit and no file picked first.
 */
const slowFramingWarning = computed(() => {
  if (!isValid.value || !dimensions.value) {
    return undefined
  }

  if (!isSlowFramingSize(technique.value, dimensions.value, props.slowFramingCellThresholds)) {
    return undefined
  }

  return t.value.convertImage.slowFramingWarning.replace('{technique}', techniqueLabel.value[technique.value])
})

function currentInput(): CreatePatternInput {
  return {
    name: name.value.trim(),
    technique: technique.value,
    beadId: beadId.value,
    size: { width: width.value, height: height.value, unit: unit.value },
  }
}

watch([name, beadId, technique, widthText, heightText, unit], () => emit('draft', currentInput()), {
  immediate: true,
})

function onSubmit() {
  if (!isValid.value) {
    return
  }

  emit('submit', currentInput())
}

/** Why the last chosen picture was turned away, if it was — one of domain/imageConversion's ImageRejection reasons. */
const convertRejection = ref<ImageRejection | undefined>()

/**
 * The advertised limits and every rejection message, filled in from the constants the validation itself enforces (see
 * formatImageLimits), so what this promises and what it refuses can never drift apart.
 */
const limitsHint = computed(() => formatImageLimits(t.value.convertImage.limitsHint))
const convertError = computed(() =>
  convertRejection.value ? formatImageLimits(t.value.convertImage.errors[convertRejection.value]) : undefined,
)

/**
 * Validates and decodes a chosen picture, then hands it over for framing. Format and size are judged from the file
 * itself; the resolution limit needs the decoded dimensions, so it comes back from the decode step as a rejection of
 * its own (see imageDecode.ts).
 */
async function onConvertImage(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) {
    return
  }

  try {
    await convertFile(file)
  } finally {
    // Clear the input so re-picking the same file still counts as a change (the same reason PatternImport does).
    input.value = ''
  }
}

/** A picked or dropped picture: validated, decoded, and handed over for framing, or turned away with the reason. */
async function convertFile(file: File): Promise<void> {
  convertRejection.value = validateImageFile(file)

  try {
    if (!convertRejection.value) {
      reading.value = true
      emit('convert-image', await (props.decodeImage ?? decodeImageFile)(file))
    }
  } catch (error) {
    convertRejection.value = error instanceof ImageConversionError ? error.reason : 'decodeFailed'
  } finally {
    reading.value = false
  }
}

/** Whether a chosen picture is being read: a big one takes a moment, and says so once it does (ticket 158). */
const reading = ref(false)

/** A picture dropped on Convert image: only once a size is stated, the same as picking one. */
function onDropImage(file: File) {
  if (isValid.value) void convertFile(file)
}
</script>

<template>
  <!--
    The New Pattern form (ticket 149; NewPatternForm card), in the left column's first box: Name (optional), Bead,
    Technique, Width and Height in their Unit with the size in the other unit beside it, Create Pattern, then "or" and
    Convert image. Create and Convert both wait for a size; its reason is written at the field.
  -->
  <form class="new-pattern-form" novalidate @submit.prevent="onSubmit">
    <FormField :label="t.form.nameLabel" label-for="name-input" :aside="t.form.optional">
      <TextField id="name-input" v-model="name" data-testid="name-input" type="text" :placeholder="namePlaceholder" />
    </FormField>

    <FormField :label="t.form.beadLabel" label-for="bead-select">
      <FieldSelect id="bead-select" v-model="beadId" data-testid="bead-select">
        <option v-for="bead in beads" :key="bead.id" :value="bead.id">
          {{ bead.brand }} {{ bead.name }} {{ bead.size }}
        </option>
      </FieldSelect>
    </FormField>

    <FormField :label="t.form.techniqueLabel" label-id="technique-label">
      <SegmentedControl
        v-model="technique"
        :options="techniqueOptions"
        labelledby="technique-label"
        data-testid="technique-select"
      />
    </FormField>

    <div class="new-pattern-form__pair">
      <FormField :label="t.form.widthLabel" label-for="width-input" :error="widthError" error-testid="width-error">
        <NumberField
          id="width-input"
          v-model="widthText"
          data-testid="width-input"
          :unit="unitOptions.find((option) => option.value === unit)?.label"
          :whole="unit === 'beads'"
          :invalid="!!widthError"
          :min="unit === 'beads' ? 1 : 0"
          :step="unit === 'beads' ? 1 : 'any'"
          @blur="touched.width = true"
        />
      </FormField>
      <FormField :label="t.form.heightLabel" label-for="height-input" :error="heightError" error-testid="height-error">
        <NumberField
          id="height-input"
          v-model="heightText"
          data-testid="height-input"
          :unit="unitOptions.find((option) => option.value === unit)?.label"
          :whole="unit === 'beads'"
          :invalid="!!heightError"
          :min="unit === 'beads' ? 1 : 0"
          :step="unit === 'beads' ? 1 : 'any'"
          @blur="touched.height = true"
        />
      </FormField>
    </div>

    <FormField :label="t.form.unitLabel" label-id="unit-label" :aside="estimate">
      <SegmentedControl v-model="unit" :options="unitOptions" mono labelledby="unit-label" data-testid="unit-select" />
    </FormField>

    <AppButton class="new-pattern-form__submit" type="submit" variant="primary" icon="plus" :disabled="!isValid">
      {{ t.form.submit }}
    </AppButton>

    <!--
      Convert image (CONTEXT.md, ADR 0010) as the form's second way out: a picture instead of an empty grid, at the
      size stated above. It needs that size before there is a frame to fit a picture into, so it waits for one the same
      way Create does, and says so under it. The limits are always written under it too.
    -->
    <p class="new-pattern-form__or" aria-hidden="true">{{ t.form.or }}</p>
    <div class="new-pattern-form__convert" :title="limitsHint" data-testid="convert-image-field">
      <FileButton
        id="convert-image-input"
        :label="t.convertImage.fileLabel"
        icon="image"
        data-testid="convert-image-input"
        :accept="imageInputAccept()"
        :title="limitsHint"
        :disabled="!isValid"
        :disabled-reason="t.form.enterSizeFirst"
        @change="onConvertImage"
        @drop-file="onDropImage"
      />
      <p class="new-pattern-form__hint" data-testid="convert-image-limits">{{ limitsHint }}</p>
      <LoadingState v-if="reading" compact :text="t.convertImage.readingPicture" />
      <p v-if="slowFramingWarning" class="new-pattern-form__warning" data-testid="convert-image-slow-framing-warning">
        <AppIcon name="warning" :size="14" />
        <span>{{ slowFramingWarning }}</span>
      </p>
      <p v-if="convertError" class="new-pattern-form__error" role="alert" data-testid="convert-image-error">
        <AppIcon name="warning" :size="14" />
        <span>{{ convertError }}</span>
      </p>
    </div>
  </form>
</template>

<style scoped>
.new-pattern-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.new-pattern-form__pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-10);
}

.new-pattern-form__submit {
  width: 100%;
  height: var(--field-height);
}

/* "or", between two rules. */
.new-pattern-form__or {
  display: flex;
  align-items: center;
  gap: var(--space-10);
  margin: 0;
  font: var(--type-meta-small);
  color: var(--muted);
}

.new-pattern-form__or::before,
.new-pattern-form__or::after {
  flex: 1;
  height: 1px;
  content: '';
  background: var(--panel-rule);
}

.new-pattern-form__convert {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.new-pattern-form__hint,
.new-pattern-form__warning,
.new-pattern-form__error {
  display: flex;
  gap: var(--space-6);
  align-items: flex-start;
  margin: 0;
  font: var(--type-meta);
  font-family: var(--font-sans);
  color: var(--muted);
}

.new-pattern-form__warning {
  color: var(--body);
}

.new-pattern-form__warning > .icon {
  margin-top: var(--space-2);
  color: var(--warning);
}

.new-pattern-form__error {
  color: var(--danger);
}

.new-pattern-form__error > .icon {
  margin-top: var(--space-2);
}
</style>
