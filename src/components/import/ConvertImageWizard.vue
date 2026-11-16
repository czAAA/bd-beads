<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { provideConvertImageWizard, type ConvertImageWizard } from '../../composables/import/useConvertImageWizard'
import { useElementSize } from '../../composables/ui/useElementSize'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { convertLayoutFor } from '../../domain/convertLayout'
import { imageLimitsText } from '../../i18n/imageLimits'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from '../ui/AppIcon.vue'
import ConvertColumn from './ConvertColumn.vue'
import ConvertDock from './ConvertDock.vue'
import ConvertImagePreview from './ConvertImagePreview.vue'

// Convert image as an App page (tickets 0756, 0896, 0911; ADR 0086; ConvertImage card DS-1, DS-4): the beads are the page.
// From 1024 px in landscape the preview takes the room beside a short column of decisions, Create Project at its foot;
// otherwise a dock holds the settings and Create Project, one sheet at a time (Phone, Tablet, Side). Escape asks to leave.
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
// The layout follows the page's own size on every resize and turn (DS-4); with no size yet it is the Desktop's.
const { width: pageWidth, height: pageHeight } = useElementSize(rootEl, { box: 'border-box' })
const layout = computed(() => convertLayoutFor(pageWidth.value, pageHeight.value))
/** How far the page's top is below the window's: the notch and the strip, which the half detent leaves out (DS-4). */
const pageTop = computed(() => (pageHeight.value > 0 ? (rootEl.value?.getBoundingClientRect().top ?? 0) : 0))

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
    :data-layout="layout"
    :style="{ '--convert-page-top': `${pageTop}px` }"
    role="region"
    :aria-label="words.title"
    data-testid="convert-image-wizard"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div class="convert-page__preview">
      <ConvertImagePreview :layout="layout" @paste="pasteFromClipboard" />
    </div>

    <ConvertColumn v-if="layout === 'desktop'" class="convert-page__column" @paste="pasteFromClipboard" @create="emit('create')" />
    <ConvertDock v-else :layout="layout" @paste="pasteFromClipboard" @create="emit('create')" />

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
  z-index: var(--convert-layer-dropping);
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

/* A Phone and a Tablet stack the beads over the dock; Side puts the dock's column at the right (DS-4). The preview takes
 * what the dock or its open sheet leaves, so the beads re-fit as a sheet opens. */
.convert-page[data-layout='phone'],
.convert-page[data-layout='tablet'] {
  flex-direction: column;
}

.convert-page[data-layout='phone'] .convert-page__preview,
.convert-page[data-layout='tablet'] .convert-page__preview {
  border-bottom: 1px solid var(--panel-rule);
}

/* The half rule (DS-4): while a sheet is open on a Phone the beads keep half the window's height, whatever stands above
 * the page; the dock and its sheet give way and the sheet scrolls inside. */
.convert-page[data-layout='phone']:has(.convert-sheet) .convert-page__preview {
  box-sizing: border-box;
  min-height: 50dvh;
}

.convert-page[data-layout='side'] {
  padding-inline-start: env(safe-area-inset-left);
}
</style>
