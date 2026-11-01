<script setup lang="ts">
import { computed, ref, useId, watchPostEffect } from 'vue'
import { useConvertImageWizardState, type ConvertWeave, type CutOut } from '../../composables/import/useConvertImageWizard'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'
import { fillBlanks } from '../../domain/fillBlanks'
import { formatImageLimits, imageInputAccept } from '../../domain/imageConversion'
import { MAX_TOLERANCE, MIN_TOLERANCE } from '../../domain/subjectMask'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppMessage from '../ui/AppMessage.vue'
import AppNote from '../ui/AppNote.vue'
import LoadingState from '../ui/LoadingState.vue'
import FileButton from '../ui/form/FileButton.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'
import ValueSlider from '../ui/form/ValueSlider.vue'

// Convert image's Picture step (ConvertImage card, 1 Picture): every way in through the wizard's one decode, the
// thumbnail and facts with Turn 90° and Flip, weave (ticket 0747), Cut out with Simple's Tolerance and Fit to subject
// (ticket 0765), the Note of every way in until the first picture, and the app's message for a refused file.
const emit = defineEmits<{ paste: [] }>()

const { t } = useI18n()
const wizard = useConvertImageWizardState()
const touch = useMediaQuery('(pointer: coarse)')
const accept = imageInputAccept()
const weaveLabelId = useId()
const cutOutLabelId = useId()

const weaveOptions = computed(() => [
  { value: 'whole' as const, label: t.value.convertImage.wizard.wholePicture },
  { value: 'part' as const, label: t.value.convertImage.wizard.aPart },
])
const weave = computed({ get: () => wizard.weave.value, set: (next: ConvertWeave) => wizard.setWeave(next) })

const cutOutWords = computed(() => t.value.convertImage.wizard.cutOut)
const cutOutOptions = computed(() => [
  { value: 'off' as const, label: cutOutWords.value.off },
  { value: 'simple' as const, label: cutOutWords.value.simple },
])
const cutOut = computed({ get: () => wizard.cutOut.value, set: (next: CutOut) => wizard.setCutOut(next) })
const toleranceValue = computed(() => String(wizard.tolerance.value))
const toleranceMaxLabel = computed(() => fillBlanks(t.value.convertImage.wizard.maxLabel, { value: String(MAX_TOLERANCE) }))

const note = computed(() => formatImageLimits(touch.value ? t.value.convertImage.wizard.pictureNoteTouch : t.value.convertImage.wizard.pictureNote))
const error = computed(() => (wizard.rejection.value ? formatImageLimits(t.value.convertImage.errors[wizard.rejection.value]) : undefined))
const facts = computed(() => {
  const image = wizard.image.value
  return image ? fillBlanks(t.value.convertImage.wizard.pictureSize, { width: image.width, height: image.height, format: wizard.fileFormat.value }) : ''
})

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  try {
    if (file) await wizard.setFile(file)
  } finally {
    // Clear the input so picking the same file again still counts as a change.
    input.value = ''
  }
}

const thumbEl = ref<HTMLCanvasElement>()
/** The thumbnail is the picture's own pixels, scaled into the 64 × 48 box. */
watchPostEffect(() => {
  const canvas = thumbEl.value
  const image = wizard.image.value
  const context = canvas?.getContext('2d')
  if (!canvas || !image || !context || typeof ImageData === 'undefined') return
  const source = document.createElement('canvas')
  source.width = image.width
  source.height = image.height
  source.getContext('2d')?.putImageData(new ImageData(Uint8ClampedArray.from(image.data), image.width, image.height), 0, 0)
  const scale = Math.min(canvas.width / image.width, canvas.height / image.height)
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.imageSmoothingEnabled = scale < 1
  const width = image.width * scale
  const height = image.height * scale
  context.drawImage(source, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height)
})
</script>

<template>
  <div class="convert-picture" data-testid="convert-picture">
    <div v-if="!wizard.hasPicture.value" class="convert-picture__ways">
      <FileButton
        :label="t.convertImage.wizard.chooseFile"
        icon="import"
        accent
        :accept="accept"
        data-autofocus
        data-testid="convert-choose-file"
        @change="onFileChange"
        @drop-file="wizard.setFile"
      />
      <AppButton icon="paste" data-testid="convert-paste" @click="emit('paste')">{{ t.convertImage.wizard.paste }}</AppButton>
      <FileButton
        v-if="touch"
        :label="t.convertImage.wizard.takePhoto"
        :accept="accept"
        capture="environment"
        data-testid="convert-take-photo"
        @change="onFileChange"
      />
    </div>

    <template v-else>
      <div class="convert-picture__set">
        <canvas ref="thumbEl" class="convert-picture__thumb" width="64" height="48" aria-hidden="true" />
        <div class="convert-picture__facts">
          <span class="convert-picture__name" data-user-text data-testid="convert-file-name">{{ wizard.fileName.value }}</span>
          <span class="convert-picture__size" data-testid="convert-picture-size">{{ facts }}</span>
        </div>
      </div>
      <!-- Two aligned rows, never wrapping sideways (ticket 0756): Turn and Flip, then replace with Choose file and Paste. -->
      <div class="convert-picture__actions">
        <AppButton variant="in-box" size="sm" icon="rotate" data-testid="convert-turn" @click="wizard.turn">{{ t.convertImage.wizard.turn }}</AppButton>
        <AppButton variant="in-box" size="sm" data-testid="convert-flip" @click="wizard.flip">{{ t.convertImage.wizard.flip }}</AppButton>
      </div>
      <div class="convert-picture__replace">
        <span class="convert-picture__replace-label">{{ t.convertImage.wizard.replace }}</span>
        <div class="convert-picture__actions">
          <FileButton small :label="t.convertImage.wizard.chooseFile" :accept="accept" data-testid="convert-replace-file" @change="onFileChange" @drop-file="wizard.setFile" />
          <AppButton variant="in-box" size="sm" data-testid="convert-replace-paste" @click="emit('paste')">{{ t.convertImage.wizard.paste }}</AppButton>
        </div>
      </div>
      <div class="convert-picture__row">
        <span :id="weaveLabelId" class="convert-picture__label">{{ t.convertImage.wizard.weave }}</span>
        <SegmentedControl v-model="weave" :options="weaveOptions" small :labelledby="weaveLabelId" data-testid="convert-weave" />
      </div>
      <p v-if="wizard.weave.value === 'part'" class="convert-picture__hint" data-testid="convert-part-hint">{{ t.convertImage.wizard.partHint }}</p>
      <div class="convert-picture__row convert-picture__row--wraps">
        <span :id="cutOutLabelId" class="convert-picture__label">{{ cutOutWords.label }}</span>
        <SegmentedControl v-model="cutOut" :options="cutOutOptions" small :labelledby="cutOutLabelId" class="convert-picture__cut-out" data-testid="convert-cut-out" />
      </div>
      <ValueSlider
        v-if="wizard.cutOut.value === 'simple'"
        :label="cutOutWords.tolerance"
        :model-value="wizard.tolerance.value"
        :min="MIN_TOLERANCE"
        :max="MAX_TOLERANCE"
        :value="toleranceValue"
        :valuetext="toleranceValue"
        :min-label="String(MIN_TOLERANCE)"
        :max-label="toleranceMaxLabel"
        :hint="cutOutWords.toleranceHint"
        testid="convert-tolerance-slider"
        @update:model-value="wizard.setTolerance"
      />
      <AppButton
        v-if="wizard.cutOut.value !== 'off'"
        variant="in-box"
        size="sm"
        icon="cut-out"
        class="convert-picture__fit"
        :label="cutOutWords.fitToSubject"
        :tooltip="cutOutWords.fitToSubjectBody"
        :disabled="!wizard.subjectBounds.value"
        :disabled-body="cutOutWords.fitToSubjectNothing"
        data-testid="convert-fit-to-subject"
        @click="wizard.fitToSubject"
        >{{ cutOutWords.fitToSubject }}</AppButton
      >
    </template>

    <LoadingState v-if="wizard.reading.value" compact :text="t.convertImage.readingPicture" />
    <AppMessage v-if="error" tone="danger" placement="notice" :closable="false" data-testid="convert-image-error">{{ error }}</AppMessage>
    <AppNote v-if="!wizard.hasPicture.value" data-testid="convert-picture-note">{{ note }}</AppNote>
  </div>
</template>

<style scoped>
.convert-picture {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.convert-picture__ways,
.convert-picture__actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: var(--space-8);
}

/* A button fills its cell, so the rows line up whatever the label's width. */
.convert-picture__ways > *,
.convert-picture__actions > *,
.convert-picture__ways :deep(.app-button),
.convert-picture__actions :deep(.app-button) {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
}

.convert-picture__set {
  display: flex;
  align-items: center;
  gap: var(--space-12);
  min-width: 0;
}

.convert-picture__thumb {
  flex: none;
  width: var(--convert-thumb-width);
  height: var(--convert-thumb-height);
  background: var(--box);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
}

.convert-picture__facts {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.convert-picture__name {
  overflow: hidden;
  font: var(--type-control);
  color: var(--ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.convert-picture__size {
  font: var(--type-meta);
  color: var(--muted);
}

.convert-picture__replace {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.convert-picture__replace-label {
  font: var(--type-label);
  color: var(--muted);
  text-transform: lowercase;
}

.convert-picture__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-12);
  min-height: var(--panel-row);
}

.convert-picture__row--wraps {
  flex-wrap: wrap;
}

/* Every chip one width, whatever its word, so the control is one width in every language (ConvertImage card). */
.convert-picture__cut-out {
  flex: none;
  flex-wrap: nowrap;
}

.convert-picture__cut-out :deep(.segmented__option) {
  flex: none;
  width: var(--cut-out-chip);
}

.convert-picture__fit {
  align-self: flex-start;
}

.convert-picture__label {
  font: var(--type-label);
  color: var(--muted);
}

.convert-picture__hint {
  margin: 0;
  font: var(--type-small);
  color: var(--muted);
}
</style>
