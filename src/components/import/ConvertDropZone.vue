<script setup lang="ts">
import { computed } from 'vue'
import { useConvertFileInput } from '../../composables/import/useConvertFileInput'
import { useConvertImageWizardState } from '../../composables/import/useConvertImageWizard'
import { useHelpDevice } from '../../composables/ui/useKeyHints'
import { fillBlanks } from '../../domain/fillBlanks'
import { imageLimitsText } from '../../i18n/imageLimits'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import AppMessage from '../ui/AppMessage.vue'
import InfoButton from '../ui/InfoButton.vue'
import LoadingState from '../ui/LoadingState.vue'
import FileButton from '../ui/form/FileButton.vue'

// The preview with no picture yet (ConvertImage card DS-1, ticket 0896): the drop zone holding every way in, Choose file,
// Paste and (on touch) Take photo, with what pictures work behind an Info button and a refused file's Message between
// the lines and the buttons. A picture being read shows the Loading card's beads after 300 ms, with its file and size.
const emit = defineEmits<{ paste: [] }>()

const { t, locale } = useI18n()
const wizard = useConvertImageWizardState()
const words = computed(() => t.value.convertImage.wizard)
/** The help lines speak to the device by one rule (ticket 0846): nothing to drop on touch, else the paste key. */
const help = useHelpDevice()
const { accept, touch, error, onFileChange } = useConvertFileInput(wizard)

const lines = computed(() =>
  help.device.value === 'touch'
    ? { title: words.value.emptyTouchTitle, line: words.value.emptyTouchLine }
    : { title: words.value.dropHere, line: fillBlanks(words.value.dropOrPaste, { pasteKey: help.modKey('V') }) },
)
const note = computed(() =>
  help.device.value === 'touch' ? imageLimitsText(locale.value, words.value.pictureNoteTouch) : imageLimitsText(locale.value, words.value.pictureNote, { pasteKey: help.modKey('V') }),
)
/** The file being read and its size ("img_2041.jpg · 9.6 MB"). */
const readingDetail = computed(() => {
  const file = wizard.readingFile.value
  if (!file) return undefined
  const mb = new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }).format(file.bytes / 1024 / 1024)
  return fillBlanks(words.value.readingDetail, { file: file.name, mb })
})

</script>

<template>
  <div class="convert-drop" data-testid="convert-drop-zone">
    <LoadingState v-if="wizard.reading.value" :text="t.convertImage.readingPicture" :detail="readingDetail" />
    <template v-else>
      <AppIcon name="image" :size="34" class="convert-drop__icon" />
      <span class="convert-drop__title">
        <span class="convert-drop__title-text">{{ lines.title }}</span>
        <InfoButton :label="words.whatPictures" :body="note" data-testid="convert-picture-note" />
      </span>
      <span class="convert-drop__line">{{ lines.line }}</span>
      <AppMessage v-if="error" tone="danger" placement="notice" :closable="false" class="convert-drop__error" data-testid="convert-image-error">{{ error }}</AppMessage>
      <div class="convert-drop__ways">
        <FileButton
          :label="words.chooseFile"
          icon="import"
          accent
          :accept="accept"
          data-autofocus
          data-testid="convert-choose-file"
          @change="onFileChange"
          @drop-file="wizard.setFile"
        />
        <AppButton icon="paste" data-testid="convert-paste" @click="emit('paste')">{{ words.paste }}</AppButton>
        <FileButton
          v-if="touch"
          :label="words.takePhoto"
          icon="camera"
          :accept="accept"
          capture="environment"
          data-testid="convert-take-photo"
          @change="onFileChange"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.convert-drop {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-8);
  margin: var(--space-24);
  padding: var(--space-16);
  color: var(--muted);
  text-align: center;
  border: 1.5px dashed var(--line-strong);
  border-radius: var(--radius-lg);
}

.convert-drop__title {
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
  font: var(--type-control);
  color: var(--ink);
}

.convert-drop__line {
  font: var(--type-meta);
}

.convert-drop__error {
  max-width: var(--convert-message-width);
  text-align: left;
}

.convert-drop__ways {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-8);
  margin-top: var(--space-8);
}

.convert-drop__ways :deep(.app-button) {
  height: var(--field-height);
}

@media (max-width: 63.99rem), (orientation: portrait) {
  .convert-drop {
    margin: var(--space-16);
  }
}
</style>
