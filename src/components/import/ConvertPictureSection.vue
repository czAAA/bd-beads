<script setup lang="ts">
import { computed, ref, watch, watchPostEffect } from 'vue'
import { useConvertFileInput } from '../../composables/import/useConvertFileInput'
import { useConvertImageWizardState } from '../../composables/import/useConvertImageWizard'
import { useMiddleCut } from '../../composables/ui/useMiddleCut'
import { fillBlanks } from '../../domain/fillBlanks'
import { useI18n } from '../../i18n/useI18n'
import AppMenuItem from '../ui/AppMenuItem.vue'
import AppMessage from '../ui/AppMessage.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import MenuButton from '../ui/MenuButton.vue'
import FileButton from '../ui/form/FileButton.vue'
import ConvertLightingRow from './ConvertLightingRow.vue'

// The column's picture section (ConvertImage card DS-1, ticket 0896): the thumbnail, the file's name and size, Replace
// (Choose file, Paste, Take photo on touch), "More for the picture" (Turn 90°, Flip) and Auto-fix lighting's row (DS-3,
// 0907). With no picture yet it says so, and while one is read, that it is being read; the ways in are the drop zone's.
const emit = defineEmits<{ paste: [] }>()

const { t } = useI18n()
const wizard = useConvertImageWizardState()
const { accept, touch, error, onFileChange } = useConvertFileInput(wizard)
const words = computed(() => t.value.convertImage.wizard)

const replaceEl = ref<HTMLElement>()
/** Replace's Choose file and Take photo open the pickers of the file inputs kept beside the menu. */
const pick = (testid: string) => replaceEl.value?.querySelector<HTMLInputElement>(`input[data-testid="${testid}"]`)?.click()

/** The picture's own size, also when it was read smaller (ticket 0931). */
const size = computed(() => {
  const own = wizard.pictureSize.value
  return own ? fillBlanks(words.value.pictureSize, { width: own.width, height: own.height }) : ''
})
/** The file's name, on a line of its own under the label (ticket 0929): cut in the middle when long, whole in its Tooltip. */
const fileName = computed(() => (wizard.hasPicture.value ? wizard.fileName.value : wizard.reading.value ? (wizard.readingFile.value?.name ?? '') : ''))
const nameLine = ref<HTMLElement>()
const name = useMiddleCut(nameLine, () => fileName.value)
const replaceItems = computed(() => [words.value.chooseFile, words.value.paste, ...(touch.value ? [words.value.takePhoto] : [])])

/** Once the first picture is read, the drop zone's button that had focus is gone: focus goes to Replace, the column's
 * first control (ticket 0939), unless it is already somewhere else. */
watch(
  () => wizard.hasPicture.value,
  (has, had) => {
    const lost = document.activeElement === null || document.activeElement === document.body
    if (has && !had && lost) replaceEl.value?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true })
  },
  { flush: 'post' },
)


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
    <div class="convert-picture__head">
      <span class="convert-picture__label">{{ words.pictureLabel }}</span>
      <div v-if="fileName" ref="nameLine" class="convert-picture__name-line">
        <component :is="name.cut.value ? AppTooltip : 'span'" v-bind="name.cut.value ? { name: fileName, announce: false } : {}">
          <span class="convert-picture__name" data-user-text data-testid="convert-file-name" :aria-hidden="name.cut.value || undefined">{{ name.shown.value }}</span>
          <span v-if="name.cut.value" class="convert-picture__whole">{{ fileName }}</span>
        </component>
      </div>
    </div>

    <div v-if="wizard.reading.value && !wizard.hasPicture.value" class="convert-picture__set">
      <span class="convert-picture__thumb" aria-hidden="true" />
      <span class="convert-picture__size">{{ words.readingLine }}</span>
    </div>
    <p v-else-if="!wizard.hasPicture.value" class="convert-picture__none" data-testid="convert-no-picture">{{ words.bandEmpty }}</p>

    <div v-else class="convert-picture__set">
      <canvas ref="thumbEl" class="convert-picture__thumb" :width="THUMB_BITMAP.width" :height="THUMB_BITMAP.height" aria-hidden="true" />
      <div class="convert-picture__facts">
        <span class="convert-picture__size" data-testid="convert-picture-size">{{ size }}</span>
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
    </div>
    <ConvertLightingRow v-if="wizard.hasPicture.value" />

    <AppMessage v-if="error && wizard.hasPicture.value" tone="danger" placement="notice" :closable="false" data-testid="convert-image-error">{{ error }}</AppMessage>
  </div>
</template>

<style scoped>
.convert-picture {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

/* The label with the file's name right under it, as a label and its value. */
.convert-picture__head {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
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

/* One line, never wider than the column: a long name is cut in the middle to fit it (useMiddleCut). */
.convert-picture__name-line {
  position: relative;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  font: var(--type-control);
  color: var(--ink);
}

/* The whole name, for a screen reader, while the line shows it cut. */
.convert-picture__whole {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

/* Beside the thumbnail: the size over Replace and ···, so the size has the column's room. */
.convert-picture__facts {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
  min-width: 0;
}

/* The size never breaks inside its number. */
.convert-picture__size {
  white-space: nowrap;
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
