<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { provideConvertImageWizard, type ConvertImageWizard } from '../../composables/import/useConvertImageWizard'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { imageLimitsText } from '../../i18n/imageLimits'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from '../ui/AppIcon.vue'
import ConvertColumn from './ConvertColumn.vue'
import ConvertImagePreview from './ConvertImagePreview.vue'

// Convert image as an App page (tickets 0756, 0896; ADR 0086; ConvertImage card DS-1): the beads are the page, the
// preview taking the room beside a short column of the decisions most pictures need, with Create Project at its foot
// (under 1024 px or in portrait the column stacks under the preview). Close and Escape ask to leave.
const props = defineProps<{
  wizard: ConvertImageWizard
  readClipboardImage: () => Promise<File | undefined>
}>()

const emit = defineEmits<{ close: []; create: [] }>()

const { t, locale } = useI18n()
const words = computed(() => t.value.convertImage.wizard)
const { wizard } = props
provideConvertImageWizard(wizard)

const rootEl = ref<HTMLElement>()

// The page is the top layer while it shows, so Escape asks to leave; a press elsewhere (the strip's Menu) goes through.
useOverlayLayer({ isOpen: () => true, root: () => rootEl.value, close: () => emit('close'), outside: 'through', onOutsidePress: () => undefined })

onMounted(() => rootEl.value?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true }))

// --- Ways in: Paste (the button and Ctrl/Cmd+V) and a drop ---------------------------------------------------------

async function pasteFromClipboard() {
  const file = await props.readClipboardImage()
  if (file) await wizard.setFile(file)
}

/** The first picture a clipboard or drop hands over, if any. */
function pictureIn(transfer: DataTransfer | null | undefined): File | undefined {
  return [...(transfer?.files ?? [])].find((file) => file.type.startsWith('image/') || file.type === '') ?? transfer?.files[0]
}

// Ctrl/Cmd+V anywhere on the page: a picture on the clipboard is taken; text pastes into a field as usual.
function onPaste(event: ClipboardEvent) {
  const file = pictureIn(event.clipboardData)
  if (!file) return
  event.preventDefault()
  void wizard.setFile(file)
}
onMounted(() => document.addEventListener('paste', onPaste))
onBeforeUnmount(() => document.removeEventListener('paste', onPaste))

const dropping = ref(false)
const carriesFiles = (event: DragEvent) => [...(event.dataTransfer?.types ?? [])].includes('Files')
function onDragOver(event: DragEvent) {
  if (!carriesFiles(event)) return
  event.preventDefault()
  dropping.value = true
}
function onDragLeave(event: DragEvent) {
  if (!(event.relatedTarget instanceof Node && (event.currentTarget as Node).contains(event.relatedTarget))) dropping.value = false
}
function onDrop(event: DragEvent) {
  dropping.value = false
  const file = pictureIn(event.dataTransfer)
  if (!file) return
  event.preventDefault()
  void wizard.setFile(file)
}
const dropLimits = computed(() => imageLimitsText(locale.value, words.value.dropLimits))

</script>

<template>
  <div
    ref="rootEl"
    class="convert-page"
    role="region"
    :aria-label="words.title"
    data-testid="convert-image-wizard"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div class="convert-page__preview">
      <ConvertImagePreview @paste="pasteFromClipboard" />
    </div>

    <ConvertColumn class="convert-page__column" @paste="pasteFromClipboard" @create="emit('create')" />

    <div v-if="dropping" class="convert-page__dropping" data-testid="convert-dropping">
      <AppIcon name="image" :size="34" />
      <span class="convert-page__dropping-title">{{ words.dropToUse }}</span>
      <span class="convert-page__dropping-limits">{{ dropLimits }}</span>
    </div>
  </div>
</template>

<style scoped>
/* Beside each other from 1024 px in landscape (ConvertImage card DS-1): the preview takes the rest, the column its width.
 * It fills the canvas box between the strip and the bottom of the window. */
.convert-page {
  position: relative;
  display: flex;
  box-sizing: border-box;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--box);
}

.convert-page__preview {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}

.convert-page__column {
  flex: none;
  width: var(--convert-column-width);
}

@media (max-width: 74.99rem) {
  .convert-page__column {
    width: var(--convert-column-width-narrow);
  }
}

/* A picture dragged over the page: the drop look over all of it. */
.convert-page__dropping {
  position: absolute;
  inset: var(--space-12);
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-8);
  color: var(--accent-strong);
  pointer-events: none;
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  border: 2px dashed var(--accent-strong);
  border-radius: var(--radius-lg);
}

.convert-page__dropping-title {
  font: var(--type-control);
}

.convert-page__dropping-limits {
  font: var(--type-meta);
  color: var(--muted);
}

/* Under 1024 px or in portrait the column stacks under the preview in the same order, nothing cut (DS-1; the phone's
 * own layout is ticket 0911). On a short page the preview takes at most half and the column keeps room (ticket 0820). */
@media (max-width: 63.99rem), (orientation: portrait) {
  .convert-page {
    flex-direction: column;
  }

  .convert-page__preview {
    flex: 0 1 min(var(--convert-preview-phone), 50%);
    min-height: min(var(--convert-preview-min), 40%);
    border-bottom: 1px solid var(--panel-rule);
  }

  .convert-page__column {
    flex: 1 1 0;
    width: auto;
  }
}

@media (min-width: 40rem) and (orientation: portrait) {
  .convert-page__preview {
    flex-basis: min(var(--convert-preview-tablet), 50%);
  }
}
</style>
