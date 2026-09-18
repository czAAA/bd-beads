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
import { useI18n } from '../i18n/useI18n'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    beads?: readonly Bead[]
    /**
     * How a chosen picture is turned into pixels (ticket 58). Defaults to the browser's own decoding; a test hands
     * over synthetic pixel data instead, since jsdom decodes no image bytes. Resolved where it is called rather than
     * through withDefaults, where a function default would be taken as the value itself.
     */
    decodeImage?: DecodeImage
  }>(),
  {
    beads: () => BEAD_CATALOG,
    decodeImage: undefined,
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
const unit = ref<SizeUnit>('mm')

const width = computed(() => Number(widthText.value))
const height = computed(() => Number(heightText.value))
const isValid = computed(() => width.value > 0 && height.value > 0)
const namePlaceholder = computed(() => {
  const bead = props.beads.find((candidate) => candidate.id === beadId.value)
  return bead ? beadLabel(bead) : ''
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
    // Clear the input so re-picking the same file still counts as a change (the same reason PatternTransfer does).
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
        min="0"
        step="any"
      />
    </div>

    <div class="field">
      <label for="height-input">{{ t.form.heightLabel }}</label>
      <input
        id="height-input"
        v-model="heightText"
        data-testid="height-input"
        type="number"
        min="0"
        step="any"
      />
    </div>

    <div class="field">
      <label for="unit-select">{{ t.form.unitLabel }}</label>
      <select id="unit-select" v-model="unit" data-testid="unit-select">
        <option value="mm">{{ t.form.unitMm }}</option>
        <option value="cm">{{ t.form.unitCm }}</option>
      </select>
    </div>

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
