<script setup lang="ts">
import { computed, ref, watchPostEffect } from 'vue'
import { useConvertFileInput } from '../../composables/import/useConvertFileInput'
import { useConvertImageWizardState } from '../../composables/import/useConvertImageWizard'
import { fillBlanks } from '../../domain/fillBlanks'
import { useI18n } from '../../i18n/useI18n'
import AppMenuItem from '../ui/AppMenuItem.vue'
import AppMessage from '../ui/AppMessage.vue'
import MenuButton from '../ui/MenuButton.vue'
import FileButton from '../ui/form/FileButton.vue'

// The column's picture section (ConvertImage card DS-1, ticket 0896): the thumbnail, the file's name and size, Replace
// (Choose file, Paste, and Take photo on touch) and "More for the picture" (Turn 90°, Flip left to right). With no
// picture yet it says so, and while one is read, that it is being read; the ways in are the drop zone's then.
const emit = defineEmits<{ paste: [] }>()

const { t } = useI18n()
const wizard = useConvertImageWizardState()
const { accept, touch, error, onFileChange } = useConvertFileInput(wizard)
const words = computed(() => t.value.convertImage.wizard)

const replaceEl = ref<HTMLElement>()
/** Replace's Choose file and Take photo open the pickers of the file inputs kept beside the menu. */
const pick = (testid: string) => replaceEl.value?.querySelector<HTMLInputElement>(`input[data-testid="${testid}"]`)?.click()

const size = computed(() => {
  const image = wizard.image.value
  return image ? fillBlanks(words.value.pictureSize, { width: image.width, height: image.height }) : ''
})
const replaceItems = computed(() => [words.value.chooseFile, words.value.paste, ...(touch.value ? [words.value.takePhoto] : [])])


/** The thumbnail's bitmap, twice its box (`--convert-thumb-width` × `--convert-thumb-height`, 44 × 54) for a sharp picture. */
const THUMB_BITMAP = { width: 88, height: 108 }
const thumbEl = ref<HTMLCanvasElement>()
/** The thumbnail is the picture's own pixels, covering its box. */
watchPostEffect(() => {
  const canvas = thumbEl.value
  const image = wizard.image.value
  const context = canvas?.getContext('2d')
  if (!canvas || !image || !context || typeof ImageData === 'undefined') return
  const source = document.createElement('canvas')
  source.width = image.width
  source.height = image.height
  source.getContext('2d')?.putImageData(new ImageData(Uint8ClampedArray.from(image.data), image.width, image.height), 0, 0)
  const scale = Math.max(canvas.width / image.width, canvas.height / image.height)
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.imageSmoothingEnabled = scale < 1
  const width = image.width * scale
  const height = image.height * scale
  context.drawImage(source, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height)
})
</script>

<template>
  <div class="convert-picture" data-testid="convert-picture">
    <span class="convert-picture__label">{{ words.pictureLabel }}</span>

    <div v-if="wizard.reading.value && !wizard.hasPicture.value" class="convert-picture__set">
      <span class="convert-picture__thumb" aria-hidden="true" />
      <div class="convert-picture__facts">
        <span class="convert-picture__name" data-user-text>{{ wizard.readingFile.value?.name }}</span>
        <span class="convert-picture__size">{{ words.readingLine }}</span>
      </div>
    </div>
    <p v-else-if="!wizard.hasPicture.value" class="convert-picture__none" data-testid="convert-no-picture">{{ words.bandEmpty }}</p>

    <div v-else class="convert-picture__set">
      <canvas ref="thumbEl" class="convert-picture__thumb" :width="THUMB_BITMAP.width" :height="THUMB_BITMAP.height" aria-hidden="true" />
      <div class="convert-picture__facts">
        <span class="convert-picture__name" data-user-text data-testid="convert-file-name">{{ wizard.fileName.value }}</span>
        <span class="convert-picture__size" data-testid="convert-picture-size">{{ size }}</span>
      </div>
      <span ref="replaceEl" class="convert-picture__menus">
        <MenuButton :label="words.replace" :items="replaceItems" variant="in-box" align="end" data-testid="convert-replace">
          <AppMenuItem icon="import" data-testid="convert-replace-file" @select="pick('convert-replace-input')">{{ words.chooseFile }}</AppMenuItem>
          <AppMenuItem icon="paste" data-testid="convert-replace-paste" @select="emit('paste')">{{ words.paste }}</AppMenuItem>
          <AppMenuItem v-if="touch" icon="camera" data-testid="convert-replace-photo" @select="pick('convert-replace-photo-input')">{{ words.takePhoto }}</AppMenuItem>
        </MenuButton>
        <MenuButton :label="t.referenceImage.bar.more" icon="more" icon-only variant="in-box" align="end" :items="[words.turn, words.flipLeftRight]" data-testid="convert-picture-more">
          <AppMenuItem icon="rotate" data-testid="convert-turn" @select="wizard.turn">{{ words.turn }}</AppMenuItem>
          <AppMenuItem icon="flip" data-testid="convert-flip" @select="wizard.flip">{{ words.flipLeftRight }}</AppMenuItem>
        </MenuButton>
        <span class="convert-picture__inputs" hidden>
          <FileButton :label="words.chooseFile" :accept="accept" tabindex="-1" data-testid="convert-replace-input" @change="onFileChange" />
          <FileButton v-if="touch" :label="words.takePhoto" :accept="accept" capture="environment" tabindex="-1" data-testid="convert-replace-photo-input" @change="onFileChange" />
        </span>
      </span>
    </div>

    <AppMessage v-if="error && wizard.hasPicture.value" tone="danger" placement="notice" :closable="false" data-testid="convert-image-error">{{ error }}</AppMessage>
  </div>
</template>

<style scoped>
.convert-picture {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.convert-picture__label {
  font: var(--type-label);
  color: var(--muted);
}

.convert-picture__none {
  margin: 0;
  font: var(--type-meta);
  color: var(--muted);
}

.convert-picture__set {
  display: flex;
  align-items: center;
  gap: var(--space-10);
  min-width: 0;
}

.convert-picture__thumb {
  flex: none;
  box-sizing: border-box;
  width: var(--convert-thumb-width);
  height: var(--convert-thumb-height);
  background: var(--surface);
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

/* The name wraps anywhere, never cut. */
.convert-picture__name {
  overflow-wrap: anywhere;
  font: var(--type-control);
  color: var(--ink);
}

.convert-picture__size {
  overflow-wrap: anywhere;
  font: var(--type-meta);
  color: var(--muted);
}

.convert-picture__menus {
  display: flex;
  flex: none;
  gap: var(--space-4);
}

/* Replace is kept compact, so the name keeps room: padding 0 8 0 12 (DS-1). */
.convert-picture__menus :deep(.app-button) {
  padding: 0 var(--space-8) 0 var(--space-12);
}

/* The file inputs Replace's items open: kept, not shown. */
.convert-picture__inputs {
  display: none;
}
</style>
