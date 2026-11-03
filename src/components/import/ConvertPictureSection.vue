<script setup lang="ts">
import { computed, ref, watchPostEffect } from 'vue'
import { useConvertImageWizardState, type ConvertWeave } from '../../composables/import/useConvertImageWizard'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'
import { fillBlanks } from '../../domain/fillBlanks'
import { formatImageLimits, imageInputAccept } from '../../domain/imageConversion'
import { offeredBeads } from '../../domain/beads'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppMenuItem from '../ui/AppMenuItem.vue'
import AppMessage from '../ui/AppMessage.vue'
import AppNote from '../ui/AppNote.vue'
import LoadingState from '../ui/LoadingState.vue'
import MenuButton from '../ui/MenuButton.vue'
import FileButton from '../ui/form/FileButton.vue'
import FormField from '../ui/form/FormField.vue'
import BeadSection from '../project/BeadSection.vue'
import TechniqueSection from '../project/TechniqueSection.vue'

// Convert image's Picture & bead step (ConvertImage card; tickets 0747, 0780): every way in through the wizard's one
// validation and decode, then the file's row with Replace, the Bead and Technique (open before a picture too), and weave:
// Whole picture or A part of the picture. Turn 90° and Flip are on the preview's floating bar.
const emit = defineEmits<{ paste: [] }>()

const { t } = useI18n()
const wizard = useConvertImageWizardState()
const touch = useMediaQuery('(pointer: coarse)')
const accept = imageInputAccept()
const words = computed(() => t.value.convertImage.wizard)

const weaveOptions = computed(() => [
  { value: 'whole' as const, title: words.value.wholePicture, line: words.value.wholePictureLine },
  { value: 'part' as const, title: words.value.aPart, line: words.value.aPartLine },
])

/** The weave choices are a radio group: the arrows move the choice, and the chosen card is the one Tab stop. */
function onWeaveKey(event: KeyboardEvent) {
  const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight'
  if (!forward && event.key !== 'ArrowUp' && event.key !== 'ArrowLeft') return
  event.preventDefault()
  const values: ConvertWeave[] = ['whole', 'part']
  const next = values[(values.indexOf(wizard.weave.value) + (forward ? 1 : values.length - 1)) % values.length]!
  wizard.setWeave(next)
  ;(event.currentTarget as HTMLElement).querySelector<HTMLElement>(`[data-value="${next}"]`)?.focus()
}

const replaceEl = ref<HTMLElement>()
/** Replace's Choose file opens the picker of the file input kept beside the menu. */
const chooseReplacement = () => replaceEl.value?.querySelector<HTMLInputElement>('input[type="file"]')?.click()

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

    <div v-else class="convert-picture__set">
      <canvas ref="thumbEl" class="convert-picture__thumb" width="64" height="48" aria-hidden="true" />
      <div class="convert-picture__facts">
        <span class="convert-picture__name" data-user-text data-testid="convert-file-name">{{ wizard.fileName.value }}</span>
        <span class="convert-picture__size" data-testid="convert-picture-size">{{ facts }}</span>
      </div>
      <span ref="replaceEl" class="convert-picture__replace">
        <MenuButton :label="words.replace" :items="[words.chooseFile, words.paste]" variant="in-box" align="end" data-testid="convert-replace">
          <AppMenuItem icon="import" data-testid="convert-replace-file" @select="chooseReplacement">{{ words.chooseFile }}</AppMenuItem>
          <AppMenuItem icon="paste" data-testid="convert-replace-paste" @select="emit('paste')">{{ words.paste }}</AppMenuItem>
        </MenuButton>
        <span class="convert-picture__replace-input" hidden>
          <FileButton :label="words.chooseFile" :accept="accept" tabindex="-1" data-testid="convert-replace-input" @change="onFileChange" />
        </span>
      </span>
    </div>

    <LoadingState v-if="wizard.reading.value" compact :text="t.convertImage.readingPicture" />
    <AppMessage v-if="error" tone="danger" placement="notice" :closable="false" data-testid="convert-image-error">{{ error }}</AppMessage>
    <AppNote v-if="!wizard.hasPicture.value" data-testid="convert-picture-note">{{ note }}</AppNote>

    <FormField :label="t.form.beadLabel">
      <BeadSection :bead="wizard.bead.value" :candidates="offeredBeads()" @pick="wizard.beadId.value = $event" />
    </FormField>
    <TechniqueSection v-model:technique="wizard.technique.value" :settings="wizard.settings.value" testid="convert" @set-setting="wizard.setSetting" />

    <div v-if="wizard.hasPicture.value" class="convert-picture__weave">
      <span class="convert-picture__label">{{ words.weave }}</span>
      <div class="convert-picture__choices" role="radiogroup" :aria-label="words.weave" data-testid="convert-weave" @keydown="onWeaveKey">
        <button
          v-for="option in weaveOptions"
          :key="option.value"
          type="button"
          role="radio"
          class="convert-picture__choice"
          data-wrap-ok
          :aria-checked="wizard.weave.value === option.value"
          :tabindex="wizard.weave.value === option.value ? 0 : -1"
          :data-value="option.value"
          :data-testid="`convert-weave-${option.value}`"
          @click="wizard.setWeave(option.value)"
        >
          <span class="convert-picture__radio" aria-hidden="true" />
          <span class="convert-picture__choice-text">
            <span class="convert-picture__choice-title">{{ option.title }}</span>
            <span class="convert-picture__choice-line">{{ option.line }}</span>
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.convert-picture {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.convert-picture__ways {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: var(--space-8);
}

/* A button fills its cell, so the rows line up whatever the label's width. */
.convert-picture__ways > *,
.convert-picture__ways :deep(.app-button) {
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
  flex: 1 1 auto;
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
  flex: none;
}

/* The file input Replace's Choose file opens: kept, not shown. */
.convert-picture__replace-input {
  display: none;
}

.convert-picture__weave {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.convert-picture__label {
  font: var(--type-label);
  color: var(--muted);
  text-transform: lowercase;
}

.convert-picture__choices {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

/* A radio card (ConvertImage card, weave): the chosen one has its ink edge doubled inside and its radio filled. */
.convert-picture__choice {
  display: flex;
  align-items: flex-start;
  gap: var(--space-10);
  padding: var(--space-10) var(--space-12);
  font: inherit;
  color: var(--ink);
  text-align: left;
  background: var(--elevated);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.convert-picture__choice:hover {
  border-color: var(--line-strong);
}

.convert-picture__choice[aria-checked='true'] {
  border-color: var(--ink);
  box-shadow: inset 0 0 0 1px var(--ink);
}

.convert-picture__choice:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

.convert-picture__radio {
  display: grid;
  flex: none;
  place-items: center;
  box-sizing: border-box;
  width: var(--space-16);
  height: var(--space-16);
  margin-top: var(--space-2);
  border: 1.5px solid var(--field-line);
  border-radius: 50%;
}

.convert-picture__choice[aria-checked='true'] .convert-picture__radio {
  border-color: var(--ink);
}

.convert-picture__choice[aria-checked='true'] .convert-picture__radio::after {
  width: var(--space-8);
  height: var(--space-8);
  content: '';
  background: var(--ink);
  border-radius: 50%;
}

.convert-picture__choice-text {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.convert-picture__choice-title {
  font: var(--type-control);
}

.convert-picture__choice-line {
  font: var(--type-small);
  color: var(--muted);
}
</style>
