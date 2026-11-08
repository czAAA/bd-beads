<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { provideConvertImageWizard, type ConvertImageWizard } from '../../composables/import/useConvertImageWizard'
import { useConvertResult } from '../../composables/import/useConvertResult'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { formFactorName } from '../../domain/beads'
import { CONVERT_STEPS, type ConvertStep } from '../../domain/convertSize'
import { fillBlanks } from '../../domain/fillBlanks'
import { formatImageLimits } from '../../domain/imageConversion'
import { scrollPosition, stepAnchors } from '../../domain/scrollSteps'
import { plural } from '../../i18n/plural'
import { techniqueName } from '../../i18n/techniqueName'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from '../ui/AppIcon.vue'
import ConvertBackgroundSection from './ConvertBackgroundSection.vue'
import ConvertColorsSection from './ConvertColorsSection.vue'
import ConvertImagePreview from './ConvertImagePreview.vue'
import ConvertPictureSection from './ConvertPictureSection.vue'
import ConvertReviewSection from './ConvertReviewSection.vue'
import ConvertSection from './ConvertSection.vue'
import ConvertSizeSection from './ConvertSizeSection.vue'

// Convert image as an App page (tickets 0756, 0780; ADR 0086; ConvertImage and PhoneForms cards): the live preview beside
// one scrolling pane of every step (above it under 1024 px or in portrait), filling the canvas box. The pane's scroll is
// what the Progress bar (ConvertStepBar) follows, and a dot, Back or Next scrolls it. Close and Escape ask to leave.
const props = defineProps<{
  wizard: ConvertImageWizard
  readClipboardImage: () => Promise<File | undefined>
}>()

const emit = defineEmits<{ close: [] }>()

const { t, locale } = useI18n()
const words = computed(() => t.value.convertImage.wizard)
const { wizard } = props
provideConvertImageWizard(wizard)
const result = useConvertResult(wizard)
const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

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
const dropLimits = computed(() => formatImageLimits(words.value.dropLimits))

// --- The steps' headers ------------------------------------------------------------------------------------------------

const summaries = computed<Record<ConvertStep, string>>(() => {
  if (!wizard.hasPicture.value) {
    const shut = words.value.shutSummary
    return { picture: beadSummary.value, background: shut, size: shut, colors: shut, review: shut }
  }
  const whole = wizard.dimensions.value
  const kept = wizard.kept.value
  const found = wizard.backgroundFound.value
  const empty = wizard.emptyColorCount.value
  const backgroundStage = wizard.background.value
  return {
    picture: beadSummary.value,
    background:
      backgroundStage === 'off' || !found
        ? words.value.summaryOff
        : fillBlanks(backgroundStage === 'removed' ? words.value.summaryRemoved : words.value.summaryFound, { n: found.percent }),
    size: kept
      ? fillBlanks(words.value.summaryKept, { columns: kept.columns, rows: kept.rows, wholeColumns: whole.columns, wholeRows: whole.rows })
      : `${whole.columns}×${whole.rows}${result.value ? ` · ${result.value.measured}` : ''}`,
    colors: [plural(locale.value, wizard.usedColorCount.value, words.value.colorsCount), ...(empty > 0 ? [fillBlanks(words.value.emptyCount, { n: empty })] : [])].join(' · '),
    review: plural(locale.value, wizard.beadCount.value, words.value.beadsCount),
  }
})
const beadSummary = computed(() => {
  const bead = wizard.bead.value
  return `${formFactorName(bead.formFactor)} ${bead.size} · ${techniqueName(t.value, wizard.technique.value)}`
})

// --- The one scrolling pane --------------------------------------------------------------------------------------------

const paneEl = ref<HTMLElement>()
/** Which step's header is pinned at the pane's top now, so it shows its edge. */
const stuck = ref(-1)

const sectionsIn = (pane: HTMLElement) => [...pane.querySelectorAll<HTMLElement>(':scope > .convert-section')]
function anchorsOf(pane: HTMLElement) {
  return stepAnchors(sectionsIn(pane).map((section) => section.offsetTop), pane.scrollHeight - pane.clientHeight)
}

/** The pane scrolled: the Progress bar follows it between the steps, and the step nearest the top is current. */
function onPaneScroll() {
  const pane = paneEl.value
  if (!pane) return
  wizard.setScroll(wizard.hasPicture.value ? scrollPosition(anchorsOf(pane), pane.scrollTop) : 0)
  const top = pane.scrollTop
  stuck.value = top <= 0 ? -1 : sectionsIn(pane).findIndex((section) => section.offsetTop <= top && section.offsetTop + section.offsetHeight > top)
}

/** A dot, Back or Next: the pane scrolls to the step (smooth, a jump under reduced motion) and focus moves to its heading. */
watch(wizard.scrollRequest, async (request) => {
  const pane = paneEl.value
  if (!request || !pane) return
  await nextTick()
  const index = CONVERT_STEPS.indexOf(request.step)
  const top = anchorsOf(pane)[index] ?? 0
  if (pane.scrollTo && !reducedMotion.value) pane.scrollTo({ top, behavior: 'smooth' })
  else {
    pane.scrollTop = top
    onPaneScroll()
  }
  sectionsIn(pane)[index]?.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true })
})
// A picture set opens the later steps: the bar and the pinned header follow the new layout.
watch(wizard.hasPicture, () => nextTick(onPaneScroll))
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
      <ConvertImagePreview />
    </div>

    <div ref="paneEl" class="convert-page__step" data-testid="convert-step-pane" @scroll.passive="onPaneScroll">
      <ConvertSection
        :step="1"
        :title="words.sections.picture"
        :summary="summaries.picture"
        :done="wizard.hasPicture.value"
        :stuck="stuck === 0"
        testid="convert-section-picture"
      >
        <ConvertPictureSection @paste="pasteFromClipboard" />
      </ConvertSection>
      <ConvertSection
        :step="2"
        :title="words.sections.background"
        :summary="summaries.background"
        :shut="!wizard.hasPicture.value"
        :stuck="stuck === 1"
        testid="convert-section-background"
      >
        <ConvertBackgroundSection />
      </ConvertSection>
      <ConvertSection :step="3" :title="words.sections.size" :summary="summaries.size" :shut="!wizard.hasPicture.value" :stuck="stuck === 2" testid="convert-section-size">
        <ConvertSizeSection />
      </ConvertSection>
      <ConvertSection
        :step="4"
        :title="words.sections.colors"
        :summary="summaries.colors"
        :shut="!wizard.hasPicture.value"
        :stuck="stuck === 3"
        testid="convert-section-colors"
      >
        <ConvertColorsSection />
      </ConvertSection>
      <ConvertSection
        :step="5"
        :title="words.sections.review"
        :summary="summaries.review"
        :shut="!wizard.hasPicture.value"
        :stuck="stuck === 4"
        testid="convert-section-review"
      >
        <ConvertReviewSection />
      </ConvertSection>
    </div>

    <div v-if="dropping" class="convert-page__dropping" data-testid="convert-dropping">
      <AppIcon name="image" :size="34" />
      <span class="convert-page__dropping-title">{{ words.dropToUse }}</span>
      <span class="convert-page__dropping-limits">{{ dropLimits }}</span>
    </div>
  </div>
</template>

<style scoped>
/* Beside each other from 1024 px in landscape (ConvertImage card): the preview takes the rest, the step its width. It
 * fills the canvas box between the strip and the Progress bar. */
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

.convert-page__step {
  position: relative;
  flex: none;
  width: var(--convert-sections-width);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  background: var(--canvas);
  border-left: 1px solid var(--panel-rule);
}

@media (max-width: 68.75rem) {
  .convert-page__step {
    width: var(--convert-sections-width-narrow);
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

/* Under 1024 px or in portrait (PhoneForms card): the preview above the step, the step scrolling under it. On a short
 * page (a phone on its side, the Homepage's demo) the preview takes at most half and the step keeps room (ticket 0820). */
@media (max-width: 63.99rem), (orientation: portrait) {
  .convert-page {
    flex-direction: column;
  }

  .convert-page__preview {
    flex: 0 1 min(var(--convert-preview-phone), 50%);
    min-height: min(var(--convert-preview-min), 40%);
    border-bottom: 1px solid var(--panel-rule);
  }

  .convert-page__step {
    flex: 1 1 0;
    width: auto;
    min-height: 0;
    border-left: 0;
  }

  .convert-page__step > :deep(*) {
    box-sizing: border-box;
    width: 100%;
    max-width: 40rem;
    margin-inline: auto;
  }
}

@media (min-width: 40rem) and (orientation: portrait) {
  .convert-page__preview {
    flex-basis: min(var(--convert-preview-tablet), 50%);
  }
}
</style>
