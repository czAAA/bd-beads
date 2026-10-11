<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { BEAD_CATALOG, beadLabel } from '../../domain/beads'
import type { CreateProjectInput } from '../../domain/project'
import type { Technique } from '../../domain/grid'
import {
  formatImageLimits,
  imageInputAccept,
  validateImageFile,
  type ImageRejection,
  type PixelData,
  ImageConversionError,
  type DecodeImage,
} from '../../domain/imageConversion'
import { SLOW_FRAMING_CELLS } from '../../domain/imageFraming'
import { MAX_MAKER_NAME } from '../../domain/makerName'
import type { StatedSize } from '../../domain/projectSize'
import { useTourFormReset } from '../../composables/tour/useTour'
import { controlAction } from '../../composables/shell/controlRegistry'
import { useI18n } from '../../i18n/useI18n'
import ConvertImageSizeDialog from '../import/ConvertImageSizeDialog.vue'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import FieldSelect from '../ui/form/FieldSelect.vue'
import FileButton from '../ui/form/FileButton.vue'
import FormField from '../ui/form/FormField.vue'
import LoadingState from '../ui/LoadingState.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'
import TextField from '../ui/form/TextField.vue'

const { t } = useI18n()

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
/** This Project's own maker's name (ticket 182): blank by default regardless of the device-wide value it overrides. */
const makerName = ref('')
/** The Tour's "Back to loom for your first Project" (ticket 80): Loom and the default Bead, with the Name left as typed. */
const tourReset = useTourFormReset()
if (tourReset) {
  watch(tourReset, () => {
    technique.value = 'loom'
    beadId.value = BEAD_CATALOG[0]!.id
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

const selectedBead = computed(() => BEAD_CATALOG.find((candidate) => candidate.id === beadId.value))
const namePlaceholder = computed(() => (selectedBead.value ? beadLabel(selectedBead.value) : ''))

const techniqueOptions = computed(() => [
  { value: 'loom' as const, label: t.value.form.techniqueLoom },
  { value: 'peyote' as const, label: t.value.form.techniquePeyote },
  { value: 'brick' as const, label: t.value.form.techniqueBrick },
])

/** What Create Project makes: an open canvas, its size set later in the Frame section (ticket 342). */
function currentInput(): CreateProjectInput {
  return {
    name: name.value.trim(),
    technique: technique.value,
    beadId: beadId.value,
    makerName: makerName.value.trim(),
  }
}

/** The size Convert image's size step was given; only the framing step reads it, so Create never carries it. */
const convertSize = ref<StatedSize>()

/** The draft Convert image's frame follows: the form's values plus the size stated in the size step, once there is one. */
function draftInput(): CreateProjectInput {
  return { ...currentInput(), ...(convertSize.value ? { size: convertSize.value } : {}) }
}

watch([name, beadId, technique, makerName, convertSize], () => emit('draft', draftInput()), { immediate: true })

function onSubmit() {
  emit('submit', currentInput())
}

/** A decoded picture waiting for its Pattern size (ticket 342, ADR 0026); the size step is open while there is one. */
const pendingImage = ref<PixelData>()

/** The size is stated: the draft carries it first, so the frame the shell builds has a size to follow, then framing starts. */
function onSizeConfirm(size: StatedSize) {
  const image = pendingImage.value
  if (!image) return
  convertSize.value = size
  pendingImage.value = undefined
  emit('draft', draftInput())
  emit('convert-image', image)
}

/** Why the last chosen picture was turned away, if it was — one of domain/imageConversion's ImageRejection reasons. */
const convertRejection = ref<ImageRejection | undefined>()

const convertAction = controlAction('convert-image')

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
      pendingImage.value = await props.decodeImage(file)
    }
  } catch (error) {
    convertRejection.value = error instanceof ImageConversionError ? error.reason : 'decodeFailed'
  } finally {
    reading.value = false
  }
}

/** Whether a chosen picture is being read: a big one takes a moment, and says so once it does (ticket 158). */
const reading = ref(false)

/** A picture dropped on Convert image: the same as picking one. */
function onDropImage(file: File) {
  void convertFile(file)
}
</script>

<template>
  <!--
    The New Project form (ticket 149; NewProjectForm card), in the left column's first box: Name (optional), Maker's
    name (ticket 182, also optional and blank by default), Bead, Technique, Create Project, then "or" and Convert image.
    It states no size (ticket 342): a Project starts as an open canvas and its size is set in the Toolbox's Frame
    section. Convert image still needs one, so choosing a picture opens its own size step before framing.
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

    <AppButton class="new-project-form__submit" type="submit" variant="primary" icon="plus">
      {{ t.form.submit }}
    </AppButton>

    <!--
      Convert image (CONTEXT.md, ADR 0010) as the form's second way out: a picture instead of an empty canvas. It needs
      a size before there is a frame to fit the picture into, so a chosen picture opens the size step (ticket 342). The
      limits are always written under it.
    -->
    <p class="new-project-form__or" aria-hidden="true">{{ t.form.or }}</p>
    <div class="new-project-form__convert" data-testid="convert-image-field">
      <AppTooltip
        class="new-project-form__convert-tip"
        :name="convertAction.name(t)"
        :body="convertAction.body?.(t)"
        placement="top"
        :announce="false"
      >
        <FileButton
          id="convert-image-input"
          :label="t.convertImage.fileLabel"
          :aria-label="t.convertImage.fileName"
          icon="image"
          data-testid="convert-image-input"
          :accept="imageInputAccept()"
          @change="onConvertImage"
          @drop-file="onDropImage"
        />
      </AppTooltip>
      <p class="new-project-form__hint" data-testid="convert-image-limits">{{ limitsHint }}</p>
      <LoadingState v-if="reading" compact :text="t.convertImage.readingPicture" />
      <p v-if="convertError" class="new-project-form__error" role="alert" data-testid="convert-image-error">
        <AppIcon name="warning" :size="14" />
        <span>{{ convertError }}</span>
      </p>
    </div>

    <ConvertImageSizeDialog
      v-if="pendingImage && selectedBead"
      :bead="selectedBead"
      :technique="technique"
      :slow-framing-cell-thresholds="slowFramingCellThresholds"
      @confirm="onSizeConfirm"
      @cancel="pendingImage = undefined"
    />
  </form>
</template>

<style scoped>
.new-project-form__convert-tip {
  flex-direction: column;
}

.new-project-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.new-project-form__submit {
  width: 100%;
  height: var(--field-height);
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
.new-project-form__error {
  display: flex;
  gap: var(--space-6);
  align-items: flex-start;
  margin: 0;
  font: var(--type-meta);
  font-family: var(--font-sans);
  color: var(--muted);
}

.new-project-form__error {
  color: var(--danger);
}

.new-project-form__error > .icon {
  margin-top: var(--space-2);
}

</style>
