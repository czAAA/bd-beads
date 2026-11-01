<script setup lang="ts">
import { computed, ref, useId, watchPostEffect } from 'vue'
import { useConvertImageWizardState, type ConvertWeave, type CutOut } from '../../composables/import/useConvertImageWizard'
import { controlAction } from '../../composables/shell/controlRegistry'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'
import { megabytes } from '../../domain/cutOutModel'
import { fillBlanks } from '../../domain/fillBlanks'
import { formatImageLimits, imageInputAccept } from '../../domain/imageConversion'
import { MAX_TOLERANCE, MIN_TOLERANCE } from '../../domain/subjectMask'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppMessage from '../ui/AppMessage.vue'
import AppNote from '../ui/AppNote.vue'
import IconButton from '../ui/IconButton.vue'
import LoadingState from '../ui/LoadingState.vue'
import FileButton from '../ui/form/FileButton.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'
import ValueSlider from '../ui/form/ValueSlider.vue'
import CutOutDownloadNote from './CutOutDownloadNote.vue'

// Convert image's Picture step (ConvertImage card, 1 Picture): the ways in, the thumbnail, Turn 90° and Flip, weave (0747),
// Cut out with Simple's Tolerance and Fit to subject (0765), the AI chip's note, Loading and failure (0767) and its tap
// chips and Reset (0769), the Note of every way in until the first picture, and the message for a refused file.
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
/** A run that stopped with the tab last time (ticket 0768): the AI chip's warning dot, its reason in its Tooltip. */
const aiWarning = computed(() => (wizard.cutOutStopped.value ? cutOutWords.value.stopped : undefined))
const cutOutOptions = computed(() => [
  { value: 'off' as const, label: cutOutWords.value.off },
  { value: 'simple' as const, label: cutOutWords.value.simple },
  { value: 'ai' as const, label: cutOutWords.value.ai, icon: 'cut-out-ai' as const, iconOnly: true, tooltip: { name: cutOutWords.value.ai, body: aiWarning.value }, warning: aiWarning.value },
])
const cutOut = computed({ get: () => wizard.cutOut.value, set: (next: CutOut) => wizard.setCutOut(next) })
const tapActions = { add: controlAction('cut-out-tap-add'), remove: controlAction('cut-out-tap-remove') } as const

// The AI choice's wait (Loading card, AI variant): the MB downloaded, then the model at work; the count isn't read out
// as it climbs, so a screen reader hears the line once, as it starts.
const ai = computed(() => wizard.aiCutOut.value)
const aiLoading = computed(() => {
  const status = ai.value
  if (status.kind === 'downloading') {
    const total = megabytes(status.total)
    return {
      text: fillBlanks(cutOutWords.value.downloading, { done: Math.min(total, megabytes(status.done, true)), total }),
      share: status.done / status.total,
      spoken: fillBlanks(cutOutWords.value.downloading, { done: 0, total }),
    }
  }
  if (status.kind === 'thinking') return { text: status.longer ? cutOutWords.value.takingLonger : cutOutWords.value.finding }
  return undefined
})
/** Fit to subject shows while Cut out has a subject to fit to (the AI one while a tap is worked out too), or is working
 * one out with Simple. */
const fitShown = computed(() => wizard.cutOut.value === 'simple' || (wizard.cutOut.value === 'ai' && !!wizard.subjectMask.value))

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
      <div class="convert-picture__row convert-picture__row--wraps" :class="{ 'convert-picture__row--taps': wizard.cutOutTapsShown.value }">
        <span :id="cutOutLabelId" class="convert-picture__label">{{ cutOutWords.label }}</span>
        <div class="convert-picture__cut-out-choice">
          <SegmentedControl v-model="cutOut" :options="cutOutOptions" small :labelledby="cutOutLabelId" class="convert-picture__cut-out" data-testid="convert-cut-out" />
          <!-- Under the AI chip once the subject is found (ticket 0769): tap add, tap remove, then Reset. -->
          <div v-if="wizard.cutOutTapsShown.value" class="convert-picture__taps" data-testid="cut-out-taps">
            <IconButton
              v-for="kind in ['add', 'remove'] as const"
              :key="kind"
              variant="in-box"
              :icon-size="16"
              :action="tapActions[kind]"
              :selected="wizard.cutOutTapMode.value === kind"
              class="convert-picture__tap"
              :data-testid="`cut-out-tap-${kind}`"
              @click="wizard.toggleCutOutTap(kind)"
            />
            <AppButton
              variant="in-box"
              size="sm"
              class="convert-picture__reset"
              :label="cutOutWords.reset"
              :tooltip="cutOutWords.resetBody"
              :disabled="wizard.cutOutTaps.value.length === 0"
              :disabled-body="cutOutWords.resetNothing"
              data-testid="cut-out-reset"
              @click="wizard.resetCutOutTaps"
              >{{ cutOutWords.reset }}</AppButton
            >
          </div>
        </div>
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
      <CutOutDownloadNote
        v-if="ai.kind === 'asking'"
        :bytes="ai.bytes"
        :low-memory="ai.lowMemory"
        :low-space="ai.lowSpace"
        @download="wizard.downloadCutOutModel" @cancel="wizard.cancelAiCutOut" />
      <LoadingState v-else-if="aiLoading" ai :text="aiLoading.text" :share="aiLoading.share" :spoken="aiLoading.spoken">
        <AppButton variant="text" size="sm" data-testid="cut-out-ai-cancel" @click="wizard.cancelAiCutOut">{{ cutOutWords.cancel }}</AppButton>
      </LoadingState>
      <AppMessage v-if="ai.kind === 'failed'" tone="danger" placement="notice" :closable="false" data-testid="cut-out-ai-failed">{{ cutOutWords.failed }}</AppMessage>
      <AppButton
        v-if="fitShown"
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

/* With the tap row under the chips, the label stays level with the chips. */
.convert-picture__row--taps {
  align-items: flex-start;
}

.convert-picture__row--taps .convert-picture__label {
  display: flex;
  align-items: center;
  min-height: var(--control-height);
}

.convert-picture__cut-out-choice {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-8);
}

/* Tap add and tap remove 4 apart, then 8 to Reset (ConvertImage card, under the AI chip). */
.convert-picture__taps {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.convert-picture__taps :deep(.convert-picture__tap) {
  width: var(--control-height-small);
  height: var(--control-height-small);
  border-radius: var(--radius-sm);
}

.convert-picture__taps :deep(.convert-picture__tap:not([aria-pressed='true'])) {
  border-color: var(--line-strong);
}

/* On, the chip is `ink` and its whole icon `canvas`, mark included, as the chosen AI chip. */
.convert-picture__taps :deep(.convert-picture__tap[aria-pressed='true'] .ai-mark) {
  stroke: currentColor;
}

.convert-picture__reset {
  margin-left: var(--space-4);
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
