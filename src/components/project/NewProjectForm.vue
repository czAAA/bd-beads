<script setup lang="ts">
import { computed, onMounted, ref, useId, watch } from 'vue'
import { BEAD_CATALOG, beadLabel } from '../../domain/beads'
import type { CreateProjectInput } from '../../domain/project'
import type { SizeUnit, Technique } from '../../domain/grid'
import {
  formatImageLimits,
  imageInputAccept,
  validateImageFile,
  type ImageRejection,
  type PixelData,
  ImageConversionError,
  type DecodeImage,
} from '../../domain/imageConversion'
import { isSlowFramingSize, SLOW_FRAMING_CELLS } from '../../domain/imageFraming'
import { MAX_MAKER_NAME } from '../../domain/makerName'
import { estimatedSizeMm, formatSizeConversion, formatSizeMm, gridFromSize } from '../../domain/projectSize'
import { useTourFormReset } from '../../composables/tour/useTour'
import { TOUR_COLUMNS, TOUR_ROWS } from '../../domain/tour'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import FieldSelect from '../ui/form/FieldSelect.vue'
import FileButton from '../ui/form/FileButton.vue'
import FormField from '../ui/form/FormField.vue'
import LoadingState from '../ui/LoadingState.vue'
import NumberField from '../ui/form/NumberField.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'
import TextField from '../ui/form/TextField.vue'

const { t, locale } = useI18n()

const props = withDefaults(
  defineProps<{
    /**
     * How a chosen picture is turned into pixels (ticket 58). The app shell hands over the browser's own decoding
     * (ADR 0020); a test hands over synthetic pixel data instead, since jsdom decodes no image bytes.
     */
    decodeImage: DecodeImage
    /**
     * The per-Technique cell-count thresholds the slow-framing hint (ticket 61) compares the current grid against.
     * Defaults to the real thresholds; a test overrides them to exercise the per-Technique lookup without the three
     * real constants having to differ from each other.
     */
    slowFramingCellThresholds?: Record<Technique, number>
  }>(),
  {
    slowFramingCellThresholds: () => SLOW_FRAMING_CELLS,
  },
)

const emit = defineEmits<{
  submit: [payload: CreateProjectInput]
  /**
   * The form's current values, emitted whenever any of them change (and once on mount). Convert image's frame is sized
   * from these, and follows them as they are edited during framing (ticket 58).
   */
  draft: [payload: CreateProjectInput]
  /** A picture that passed validation and decoded — the framing step's starting point. */
  'convert-image': [image: PixelData]
}>()

const name = ref('')
const beadId = ref(BEAD_CATALOG[0]!.id)
const technique = ref<Technique>('loom')
const widthText = ref('')
const heightText = ref('')
/** This Project's own maker's name (ticket 182): blank by default regardless of the device-wide value it overrides. */
const makerName = ref('')
/** Beads by default (ADR 0017): a weaver counts beads, and mm/cm are converted to a grid once, through the chosen Bead. */
const unit = ref<SizeUnit>('beads')

/** The Tour's "Back to loom for your first Project" (ticket 80): Loom, the default Bead and the Tour Project's size, with the Name left as typed. */
const tourReset = useTourFormReset()
if (tourReset) {
  watch(tourReset, () => {
    technique.value = 'loom'
    beadId.value = BEAD_CATALOG[0]!.id
    unit.value = 'beads'
    widthText.value = String(TOUR_COLUMNS)
    heightText.value = String(TOUR_ROWS)
  })
}

/** The form's own root, so the Name input can be found and focused without a global id lookup (ticket 181). */
const formEl = ref<HTMLFormElement>()

/** Focused and its text selected as soon as the form opens (ticket 181), to encourage naming — scoped to this form's own root, since a phone and a wider tier can both have one mounted at once (one hidden by CSS). */
onMounted(() => {
  const input = formEl.value?.querySelector<HTMLInputElement>('#name-input')
  input?.focus()
  input?.select()
})

const width = computed(() => Number(widthText.value))
const height = computed(() => Number(heightText.value))
const selectedBead = computed(() => BEAD_CATALOG.find((candidate) => candidate.id === beadId.value))
const namePlaceholder = computed(() => (selectedBead.value ? beadLabel(selectedBead.value) : ''))

/** Whether either size field has been filled: with both empty the Project is an open canvas with no Frame, and with one the other is required. */
const sizeEntered = computed(() => widthText.value.trim() !== '' || heightText.value.trim() !== '')

/** A size in beads is a whole number of them, at least one; mm/cm just have to be positive. */
const isSizeStated = computed(() => {
  const stated = width.value > 0 && height.value > 0
  return unit.value === 'beads' ? stated && Number.isInteger(width.value) && Number.isInteger(height.value) : stated
})

/**
 * The grid the stated size works out to, in whichever unit it was stated: beads are the columns and rows directly, and
 * mm/cm are converted through the chosen Bead. The single source the slow-framing hint and (via the emitted
 * draft, see domain/project's projectGeometry) Convert image's frame all read, so none of them can disagree about it.
 */
const dimensions = computed(() =>
  isSizeStated.value && selectedBead.value
    ? gridFromSize({ width: width.value, height: height.value, unit: unit.value }, selectedBead.value)
    : undefined,
)

/** Create Project waits only for a size that is half-stated or wrong: no size at all is a canvas to draw on anywhere. */
const isValid = computed(() => !sizeEntered.value || isSizeStated.value)

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

/** Beside Unit: the stated size in the other unit (NewProjectForm card), "≈ 64 × 48 mm" or "≈ 40×30 beads". */
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
  // Nothing in either field is an open canvas, not an error; one filled field asks for the other at once.
  if (!sizeEntered.value) return undefined
  const missing = text.trim() === ''
  if (!missing && !touched.value[field]) return undefined
  if (missing || !(value > 0)) return field === 'width' ? t.value.form.enterWidth : t.value.form.enterHeight
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

function currentInput(): CreateProjectInput {
  return {
    name: name.value.trim(),
    technique: technique.value,
    beadId: beadId.value,
    ...(isSizeStated.value ? { size: { width: width.value, height: height.value, unit: unit.value } } : {}),
    makerName: makerName.value.trim(),
  }
}

watch([name, beadId, technique, widthText, heightText, unit, makerName], () => emit('draft', currentInput()), {
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
    // Clear the input so re-picking the same file still counts as a change (the same reason ProjectImport does).
    input.value = ''
  }
}

/** A picked or dropped picture: validated, decoded, and handed over for framing, or turned away with the reason. */
async function convertFile(file: File): Promise<void> {
  convertRejection.value = validateImageFile(file)

  try {
    if (!convertRejection.value) {
      reading.value = true
      emit('convert-image', await props.decodeImage(file))
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
  if (isSizeStated.value) void convertFile(file)
}
</script>

<template>
  <!--
    The New Project form (ticket 149; NewProjectForm card), in the left column's first box: Name (optional), Maker's
    name (ticket 182, also optional and blank by default), Bead, Technique, Width and Height in their Unit with the
    size in the other unit beside it, a computed bead-to-real-world conversion row for both axes (ticket 179), Create
    Project, then "or" and Convert image. Create and Convert both wait for a size; its reason is written at the field.
  -->
  <form ref="formEl" class="new-project-form" data-tour="new-project" novalidate @submit.prevent="onSubmit">
    <FormField :label="t.form.nameLabel" label-for="name-input" :aside="t.form.optional">
      <TextField id="name-input" v-model="name" data-testid="name-input" type="text" :placeholder="namePlaceholder" />
    </FormField>

    <!-- This Project's own maker's name (ticket 182): blank by default, overriding the device-wide one only if set. -->
    <FormField :label="t.form.makerNameLabel" label-for="maker-name-input" :aside="t.form.optional">
      <TextField
        id="maker-name-input"
        v-model="makerName"
        data-testid="maker-name-input"
        type="text"
        autocomplete="name"
        :maxlength="MAX_MAKER_NAME"
        :placeholder="t.form.makerNamePlaceholder"
      />
    </FormField>

    <FormField :label="t.form.beadLabel" label-for="bead-select">
      <FieldSelect id="bead-select" v-model="beadId" data-testid="bead-select">
        <option v-for="bead in BEAD_CATALOG" :key="bead.id" :value="bead.id">
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

    <!-- The Frame is optional (NewProjectForm card): Width and Height with their Unit; empty makes a canvas to draw on anywhere. -->
    <p class="new-project-form__frame-heading" data-testid="new-project-frame-heading">
      <span class="new-project-form__frame-title">{{ t.form.frameLabel }}</span>
      <span class="new-project-form__frame-aside">{{ t.form.optional }}</span>
    </p>

    <FormField :label="t.form.unitLabel" label-id="unit-label">
      <template v-if="estimate" #aside>
        <span class="new-project-form__estimate">
          <span data-testid="new-project-estimate-text">{{ estimate }}</span>
          <span class="new-project-form__estimate-info-wrap">
            <button
              type="button"
              class="new-project-form__estimate-info"
              data-testid="new-project-estimate-info"
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
              class="new-project-form__estimate-tooltip"
              data-testid="new-project-estimate-tooltip"
            >
              {{ t.size.estimateWarning }}
            </span>
          </span>
        </span>
      </template>
      <SegmentedControl v-model="unit" :options="unitOptions" mono labelledby="unit-label" data-testid="unit-select" />
    </FormField>

    <div class="new-project-form__pair">
      <FormField :label="t.form.widthLabel" label-for="width-input" :error="widthError" error-testid="width-error">
        <NumberField
          id="width-input"
          v-model="widthText"
          data-testid="width-input"
          testid-prefix="width-input"
          :whole="unit === 'beads'"
          :invalid="!!widthError"
          :min="unit === 'beads' ? 1 : 0"
          :step="unit === 'beads' ? 1 : 'any'"
          stepper
          digits-only
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
          digits-only
          :placeholder="unit"
          :decrease-label="t.form.decreaseHeightButton"
          :increase-label="t.form.increaseHeightButton"
          @blur="touched.height = true"
        />
      </FormField>
    </div>



    <p v-if="!sizeEntered" class="new-project-form__hint" data-testid="new-project-frame-hint">{{ t.form.frameHint }}</p>

    <p v-if="sizeConversion" class="new-project-form__conversion" data-testid="size-conversion">
      <span>{{ sizeConversion }}</span>
      <AppTooltip :name="t.form.sizeConversionInfo" placement="top">
        <template #default="{ describedby }">
          <button
            type="button"
            class="ui-control new-project-form__conversion-info"
            data-testid="size-conversion-info"
            :aria-label="t.form.sizeConversionInfoButton"
            :aria-describedby="describedby"
          >
            <AppIcon name="info" :size="14" />
          </button>
        </template>
      </AppTooltip>
    </p>

    <AppButton class="new-project-form__submit" type="submit" variant="primary" icon="plus" :disabled="!isValid">
      {{ t.form.submit }}
    </AppButton>

    <!--
      Convert image (CONTEXT.md, ADR 0010) as the form's second way out: a picture instead of an empty grid, at the
      size stated above. It needs that size before there is a frame to fit a picture into, so it waits for one the same
      way Create does, and says so under it. The limits are always written under it too.
    -->
    <p class="new-project-form__or" aria-hidden="true">{{ t.form.or }}</p>
    <div class="new-project-form__convert" :title="limitsHint" data-testid="convert-image-field">
      <FileButton
        id="convert-image-input"
        :label="t.convertImage.fileLabel"
        :aria-label="t.convertImage.fileName"
        icon="image"
        data-testid="convert-image-input"
        :accept="imageInputAccept()"
        :title="limitsHint"
        :disabled="!isSizeStated"
        :disabled-reason="t.form.convertNeedsFrame"
        @change="onConvertImage"
        @drop-file="onDropImage"
      />
      <p class="new-project-form__hint" data-testid="convert-image-limits">{{ limitsHint }}</p>
      <LoadingState v-if="reading" compact :text="t.convertImage.readingPicture" />
      <p v-if="slowFramingWarning" class="new-project-form__warning" data-testid="convert-image-slow-framing-warning">
        <AppIcon name="warning" :size="14" />
        <span>{{ slowFramingWarning }}</span>
      </p>
      <p v-if="convertError" class="new-project-form__error" role="alert" data-testid="convert-image-error">
        <AppIcon name="warning" :size="14" />
        <span>{{ convertError }}</span>
      </p>
    </div>
  </form>
</template>

<style scoped>
/* The Frame group's heading: the label in `control`, "optional" beside it in `meta-small` (FormField's own label row). */
.new-project-form__frame-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: 0 0 calc(var(--space-16) * -0.5);
}

.new-project-form__frame-title {
  font: var(--type-control);
  color: var(--ink);
}

.new-project-form__frame-aside {
  font: var(--type-meta-small);
  color: var(--muted);
}

.new-project-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.new-project-form__pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-10);
}

.new-project-form__submit {
  width: 100%;
  height: var(--field-height);
}

/* The Unit picker's conversion row (ticket 179): the same muted meta line as the hint/warning/error rows below Convert image, plus an inline info tooltip trigger right after the text. */
.new-project-form__conversion {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  margin: calc(-1 * var(--space-8)) 0 0;
  font: var(--type-meta);
  font-family: var(--font-sans);
  color: var(--muted);
}

.new-project-form__conversion-info {
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
  .new-project-form__conversion-info:hover {
    color: var(--ink);
    background: var(--hover-fill);
  }
}

.new-project-form__conversion-info:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

/* "or", between two rules. */
.new-project-form__or {
  display: flex;
  align-items: center;
  gap: var(--space-10);
  margin: 0;
  font: var(--type-meta-small);
  color: var(--muted);
}

.new-project-form__or::before,
.new-project-form__or::after {
  flex: 1;
  height: 1px;
  content: '';
  background: var(--panel-rule);
}

.new-project-form__convert {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.new-project-form__hint,
.new-project-form__warning,
.new-project-form__error {
  display: flex;
  gap: var(--space-6);
  align-items: flex-start;
  margin: 0;
  font: var(--type-meta);
  font-family: var(--font-sans);
  color: var(--muted);
}

.new-project-form__warning {
  color: var(--body);
}

.new-project-form__warning > .icon {
  margin-top: var(--space-2);
  color: var(--warning);
}

.new-project-form__error {
  color: var(--danger);
}

.new-project-form__error > .icon {
  margin-top: var(--space-2);
}

/* The Unit field's aside (ticket 170): the size in the other unit, plus Size's own "estimate, not a measurement" info tooltip. */
.new-project-form__estimate {
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
}

.new-project-form__estimate-info-wrap {
  position: relative;
  display: inline-flex;
}

.new-project-form__estimate-info {
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
  .new-project-form__estimate-info:hover {
    color: var(--ink);
    background: var(--hover-fill);
  }
}

.new-project-form__estimate-info:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

.new-project-form__estimate-tooltip {
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
