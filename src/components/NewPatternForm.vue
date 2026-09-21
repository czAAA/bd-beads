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
import { gridFromSize, sizeCapRefusal } from '../domain/patternSize'
import { useI18n } from '../i18n/useI18n'

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
 * mm/cm are converted through the chosen Bead. The single source the cap, the slow-framing hint and (via the emitted
 * draft, see domain/pattern's patternGeometry) Convert image's frame all read, so none of them can disagree about it.
 */
const dimensions = computed(() =>
  isSizeStated.value && selectedBead.value
    ? gridFromSize({ width: width.value, height: height.value, unit: unit.value }, selectedBead.value)
    : undefined,
)

/**
 * Why the stated size can't be created (ADR 0017's cell cap), worded in the unit being used, or undefined when it can.
 * Judged on the grid the size converts to for the chosen Bead, so it re-runs whenever the Bead, the unit or either
 * side changes — the same size can pass with one Bead and be refused with a smaller one.
 */
const capRefusal = computed(() =>
  dimensions.value && selectedBead.value
    ? sizeCapRefusal(t.value.sizeCap, {
        unit: unit.value,
        dimensions: dimensions.value,
        bead: selectedBead.value,
        unitLabels: { mm: t.value.form.unitMm, cm: t.value.form.unitCm },
        locale: locale.value,
      })
    : undefined,
)

const isValid = computed(() => isSizeStated.value && !capRefusal.value)

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

  convertRejection.value = validateImageFile(file)

  try {
    if (!convertRejection.value) {
      emit('convert-image', await (props.decodeImage ?? decodeImageFile)(file))
    }
  } catch (error) {
    convertRejection.value = error instanceof ImageConversionError ? error.reason : 'decodeFailed'
  } finally {
    // Clear the input so re-picking the same file still counts as a change (the same reason PatternImport does).
    input.value = ''
  }
}
</script>

<template>
  <form class="new-pattern-form" @submit.prevent="onSubmit">
    <div class="field">
      <label for="name-input">{{ t.form.nameLabel }}</label>
      <input
        id="name-input"
        v-model="name"
        data-testid="name-input"
        type="text"
        :placeholder="namePlaceholder"
      />
    </div>

    <div class="field">
      <label for="bead-select">{{ t.form.beadLabel }}</label>
      <select id="bead-select" v-model="beadId" data-testid="bead-select">
        <option v-for="bead in beads" :key="bead.id" :value="bead.id">
          {{ bead.brand }} {{ bead.name }} {{ bead.size }}
        </option>
      </select>
    </div>

    <div class="field">
      <label for="technique-select">{{ t.form.techniqueLabel }}</label>
      <select id="technique-select" v-model="technique" data-testid="technique-select">
        <option value="loom">{{ t.form.techniqueLoom }}</option>
        <option value="peyote">{{ t.form.techniquePeyote }}</option>
        <option value="brick">{{ t.form.techniqueBrick }}</option>
      </select>
    </div>

    <div class="field">
      <label for="width-input">{{ t.form.widthLabel }}</label>
      <input
        id="width-input"
        v-model="widthText"
        data-testid="width-input"
        type="number"
        :min="unit === 'beads' ? 1 : 0"
        :step="unit === 'beads' ? 1 : 'any'"
      />
    </div>

    <div class="field">
      <label for="height-input">{{ t.form.heightLabel }}</label>
      <input
        id="height-input"
        v-model="heightText"
        data-testid="height-input"
        type="number"
        :min="unit === 'beads' ? 1 : 0"
        :step="unit === 'beads' ? 1 : 'any'"
      />
    </div>

    <div class="field">
      <label for="unit-select">{{ t.form.unitLabel }}</label>
      <select id="unit-select" v-model="unit" data-testid="unit-select">
        <option value="beads">{{ t.form.unitBeads }}</option>
        <option value="mm">{{ t.form.unitMm }}</option>
        <option value="cm">{{ t.form.unitCm }}</option>
      </select>
    </div>

    <!-- The cap's refusal (ADR 0017), in the unit being used and never only a bare cell count. It disables Create and Convert image below. -->
    <p v-if="capRefusal" class="new-pattern-form__error" role="alert" data-testid="size-cap-message">
      {{ capRefusal }}
    </p>

    <button type="submit" :disabled="!isValid">{{ t.form.submit }}</button>

    <!--
      Convert image (CONTEXT.md, ADR 0010) as the form's second way out: a picture instead of an empty grid, at the
      size stated above. It needs that size before there is a frame to fit a picture into, so it waits for one the same
      way the submit button does.
    -->
    <!--
      The limits are on this box as well as on the input itself: a browser shows no tooltip for a disabled control, and
      the input is disabled until a size is stated, so this is what carries the `title` until then.
    -->
    <div class="field new-pattern-form__convert" :title="limitsHint" data-testid="convert-image-field">
      <label for="convert-image-input">{{ t.convertImage.fileLabel }}</label>
      <input
        id="convert-image-input"
        type="file"
        data-testid="convert-image-input"
        :accept="imageInputAccept()"
        :title="limitsHint"
        :disabled="!isValid"
        @change="onConvertImage"
      />
      <p class="new-pattern-form__hint" data-testid="convert-image-limits">{{ limitsHint }}</p>
      <p v-if="slowFramingWarning" class="new-pattern-form__hint" data-testid="convert-image-slow-framing-warning">
        {{ slowFramingWarning }}
      </p>
      <p v-if="convertError" class="new-pattern-form__error" role="alert" data-testid="convert-image-error">
        {{ convertError }}
      </p>
    </div>
  </form>
</template>

<style scoped>
.new-pattern-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
}

/* Kept apart from the fields above it, since it is a second way out of the form rather than another thing to fill in. */
.new-pattern-form__convert {
  gap: 6px;
  padding-top: 16px;
  border-top: 1px solid color-mix(in srgb, var(--color-ink) 20%, transparent);
}

.new-pattern-form__hint {
  margin: 0;
  font-size: 14px;
  opacity: 0.7;
}

.new-pattern-form__error {
  margin: 0;
  color: var(--color-amaranth);
  font-weight: var(--font-weight-bold);
}
</style>
