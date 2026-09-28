<script setup lang="ts">
import { computed, ref, useId, watch, type Ref } from 'vue'
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
import { estimatedSizeMm, formatSizeConversion, formatSizeMm, gridFromSize } from '../domain/patternSize'
import { useI18n } from '../i18n/useI18n'
import AppButton from './AppButton.vue'
import AppIcon from './AppIcon.vue'
import AppTooltip from './AppTooltip.vue'
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

/**
 * Width and Height as a click, not just a typed number (redesign-feedback.md): a whole beads count steps by 1; mm/cm
 * step by 1 too, its smallest meaningful unit. Blank or unparseable starts from the field's own minimum, the same
 * floor Create/Convert already enforce, rather than from 0 or NaN.
 */
function stepSize(text: Ref<string>, delta: 1 | -1) {
  const min = unit.value === 'beads' ? 1 : 0
  const current = Number(text.value)
  text.value =
    text.value.trim() === '' || Number.isNaN(current) ? String(min) : String(Math.max(min, current + delta))
}

function stepWidth(delta: 1 | -1) {
  stepSize(widthText, delta)
}

function stepHeight(delta: 1 | -1) {
  stepSize(heightText, delta)
}
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

/**
 * The Unit picker's conversion row (ticket 179): both axes' bead-to-real-world conversion, live off the same
 * `dimensions`/`selectedBead` the rest of the form reads, so it never disagrees with `estimate` above.
 */
const sizeConversion = computed(() => {
  const grid = dimensions.value
  const bead = selectedBead.value
  if (!grid || !bead) return undefined
  return formatSizeConversion(grid, bead, { mm: t.value.form.unitMm, cm: t.value.form.unitCm }, locale.value)
})

/** Ticket 170: the same "this is an estimate, not a measurement" explanation Size gives, on hover/focus of an info button beside it. */
const estimateTooltipId = useId()
const estimateTipOpen = ref(false)

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
    Technique, Width and Height in their Unit with the size in the other unit beside it, a computed bead-to-real-world
    conversion row for both axes (ticket 179), Create Pattern, then "or" and Convert image. Create and Convert both
    wait for a size; its reason is written at the field.
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
        <span class="new-pattern-form__number">
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
          <!-- A click, not just the on-screen keyboard, for Width and Height (redesign-feedback.md). -->
          <span class="new-pattern-form__spin">
            <button type="button" class="ui-control new-pattern-form__spin-button" :aria-label="t.form.increaseWidth" data-testid="width-increase" @click="stepWidth(1)">
              <AppIcon name="chevron-up" :size="14" />
            </button>
            <button type="button" class="ui-control new-pattern-form__spin-button" :aria-label="t.form.decreaseWidth" data-testid="width-decrease" @click="stepWidth(-1)">
              <AppIcon name="chevron-down" :size="14" />
            </button>
          </span>
        </span>
      </FormField>
      <FormField :label="t.form.heightLabel" label-for="height-input" :error="heightError" error-testid="height-error">
        <span class="new-pattern-form__number">
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
          <span class="new-pattern-form__spin">
            <button type="button" class="ui-control new-pattern-form__spin-button" :aria-label="t.form.increaseHeight" data-testid="height-increase" @click="stepHeight(1)">
              <AppIcon name="chevron-up" :size="14" />
            </button>
            <button type="button" class="ui-control new-pattern-form__spin-button" :aria-label="t.form.decreaseHeight" data-testid="height-decrease" @click="stepHeight(-1)">
              <AppIcon name="chevron-down" :size="14" />
            </button>
          </span>
        </span>
      </FormField>
    </div>

    <FormField :label="t.form.unitLabel" label-id="unit-label">
      <template v-if="estimate" #aside>
        <span class="new-pattern-form__estimate">
          <span data-testid="new-pattern-estimate-text">{{ estimate }}</span>
          <span class="new-pattern-form__estimate-info-wrap">
            <button
              type="button"
              class="new-pattern-form__estimate-info"
              data-testid="new-pattern-estimate-info"
              :aria-label="t.size.estimateInfoButton"
              :aria-describedby="estimateTooltipId"
              @mouseenter="estimateTipOpen = true"
              @mouseleave="estimateTipOpen = false"
              @focus="estimateTipOpen = true"
              @blur="estimateTipOpen = false"
              @keydown.escape="estimateTipOpen = false"
            >
              <AppIcon name="info" :size="14" />
            </button>
            <span
              v-show="estimateTipOpen"
              :id="estimateTooltipId"
              role="tooltip"
              class="new-pattern-form__estimate-tooltip"
              data-testid="new-pattern-estimate-tooltip"
            >
              {{ t.size.estimateWarning }}
            </span>
          </span>
        </span>
      </template>
      <SegmentedControl v-model="unit" :options="unitOptions" mono labelledby="unit-label" data-testid="unit-select" />
    </FormField>

    <p v-if="sizeConversion" class="new-pattern-form__conversion" data-testid="size-conversion">
      <span>{{ sizeConversion }}</span>
      <AppTooltip :text="t.form.sizeConversionInfo" placement="top">
        <template #default="{ describedby }">
          <button
            type="button"
            class="ui-control new-pattern-form__conversion-info"
            data-testid="size-conversion-info"
            :aria-label="t.form.sizeConversionInfoButton"
            :aria-describedby="describedby"
          >
            <AppIcon name="info" :size="14" />
          </button>
        </template>
      </AppTooltip>
    </p>

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

/* Width and Height as a click, not just the on-screen keyboard (redesign-feedback.md): the field shrinks to make room for a stacked up/down pair beside it. */
.new-pattern-form__number {
  display: flex;
  align-items: stretch;
  min-width: 0;
}

.new-pattern-form__number :deep(.text-field) {
  flex: 1 1 auto;
  min-width: 0;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.new-pattern-form__spin {
  display: flex;
  flex: none;
  flex-direction: column;
  width: var(--space-24);
}

.new-pattern-form__spin-button {
  display: flex;
  flex: 1 1 0;
  align-items: center;
  justify-content: center;
  padding: 0;
  color: var(--muted);
  background: var(--elevated);
  border: 1px solid var(--field-line);
  border-left: 0;
  cursor: pointer;
}

.new-pattern-form__spin-button:first-child {
  border-top-right-radius: var(--radius-md);
}

.new-pattern-form__spin-button:last-child {
  margin-top: -1px;
  border-bottom-right-radius: var(--radius-md);
}

@media (hover: hover) {
  .new-pattern-form__spin-button:hover {
    color: var(--ink);
    background: var(--hover-fill);
  }
}

.new-pattern-form__spin-button:active {
  background: var(--press-fill);
}

.new-pattern-form__spin-button:focus-visible {
  position: relative;
  z-index: 1;
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: -2px;
}

:root[data-theme='contrast'] .new-pattern-form__spin-button {
  border-width: 2px;
}

.new-pattern-form__submit {
  width: 100%;
  height: var(--field-height);
}

/* The Unit picker's conversion row (ticket 179): the same muted meta line as the hint/warning/error rows below Convert image, plus an inline info tooltip trigger right after the text. */
.new-pattern-form__conversion {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  margin: calc(-1 * var(--space-8)) 0 0;
  font: var(--type-meta);
  font-family: var(--font-sans);
  color: var(--muted);
}

.new-pattern-form__conversion-info {
  display: inline-grid;
  flex: none;
  place-items: center;
  width: var(--expand-size);
  height: var(--expand-size);
  padding: 0;
  color: var(--muted);
  background: none;
  border: 0;
  border-radius: var(--radius-full);
  cursor: help;
}

@media (hover: hover) {
  .new-pattern-form__conversion-info:hover {
    color: var(--ink);
    background: var(--hover-fill);
  }
}

.new-pattern-form__conversion-info:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
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

/* The Unit field's aside (ticket 170): the size in the other unit, plus Size's own "estimate, not a measurement" info tooltip. */
.new-pattern-form__estimate {
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
}

.new-pattern-form__estimate-info-wrap {
  position: relative;
  display: inline-flex;
}

.new-pattern-form__estimate-info {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--expand-size);
  height: var(--expand-size);
  padding: 0;
  color: var(--muted);
  background: none;
  border: 0;
  border-radius: var(--radius-full);
  cursor: help;
}

@media (hover: hover) {
  .new-pattern-form__estimate-info:hover {
    color: var(--ink);
    background: var(--hover-fill);
  }
}

.new-pattern-form__estimate-info:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

.new-pattern-form__estimate-tooltip {
  position: absolute;
  top: calc(100% + var(--space-6));
  right: 0;
  z-index: var(--z-tooltip);
  box-sizing: border-box;
  width: var(--tooltip-wide);
  padding: var(--space-6) var(--space-8);
  font: var(--type-small);
  line-height: 1rem;
  color: var(--canvas);
  text-transform: none;
  white-space: normal;
  background: var(--ink);
  border-radius: var(--radius-sm);
}
</style>
