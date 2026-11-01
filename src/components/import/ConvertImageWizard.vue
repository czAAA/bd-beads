<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { provideConvertImageWizard, type ConvertImageWizard } from '../../composables/import/useConvertImageWizard'
import { useConvertResult } from '../../composables/import/useConvertResult'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { estimatedGrams, formatGrams } from '../../domain/beadQuantities'
import { formFactorName, offeredBeads } from '../../domain/beads'
import type { ConvertStep } from '../../domain/convertSize'
import { formatImageLimits } from '../../domain/imageConversion'
import { techniqueName } from '../../i18n/techniqueName'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from '../ui/AppIcon.vue'
import FormField from '../ui/form/FormField.vue'
import BeadSection from '../project/BeadSection.vue'
import TechniqueSection from '../project/TechniqueSection.vue'
import ConvertColorsSection from './ConvertColorsSection.vue'
import ConvertImagePreview from './ConvertImagePreview.vue'
import ConvertPictureSection from './ConvertPictureSection.vue'
import ConvertReviewSection from './ConvertReviewSection.vue'
import ConvertSection from './ConvertSection.vue'
import ConvertSizeSection from './ConvertSizeSection.vue'

// Convert image as an App page (ticket 0756, ADR 0086; ConvertImage and PhoneForms cards): the live preview beside the
// step in hand (above it under 1024 px or in portrait), filling the canvas box. The steps themselves are on the Progress
// bar (ConvertStepBar). Its setup is its own copy of the form's, held by the flow's session; Close and Escape ask to leave.
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

// --- The step in hand -------------------------------------------------------------------------------------------------

const summaries = computed<Record<ConvertStep, string | undefined>>(() => {
  const bead = wizard.bead.value
  const grid = wizard.dimensions.value
  const used = wizard.usedColorCount.value
  const weight = wizard.draftProject.value && estimatedGrams(wizard.beadCount.value, bead)
  const source = { 'bead-colors': words.value.beadColors, default: words.value.defaultPalette, exact: words.value.exact }[wizard.source.value]
  return {
    picture: undefined,
    bead: `${formFactorName(bead.formFactor)} ${bead.size} · ${techniqueName(t.value, wizard.technique.value)}`,
    size: `${grid.columns}×${grid.rows}${result.value ? ` · ${result.value.measured}` : ''}`,
    colors: `${source} · ${used}`,
    review: weight === undefined ? undefined : `≈ ${formatGrams(weight, t.value.quantities.gramsUnit, locale.value)}`,
  }
})

const stepEl = ref<HTMLElement>()
/** A new step starts at its top, and focus moves to its heading so a screen reader says where it is. */
watch(
  () => wizard.step.value,
  async () => {
    await nextTick()
    stepEl.value?.scrollTo?.({ top: 0 })
    stepEl.value?.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true })
  },
)
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

    <div ref="stepEl" class="convert-page__step" data-testid="convert-step-pane">
      <ConvertSection
        v-if="wizard.step.value === 'picture'"
        :step="1"
        :title="words.sections.picture"
        :done="wizard.hasPicture.value"
        testid="convert-section-picture"
      >
        <ConvertPictureSection @paste="pasteFromClipboard" />
      </ConvertSection>
      <ConvertSection v-else-if="wizard.step.value === 'bead'" :step="2" :title="words.sections.bead" :summary="summaries.bead" testid="convert-section-bead">
        <FormField :label="t.form.beadLabel">
          <BeadSection :bead="wizard.bead.value" :candidates="offeredBeads()" @pick="wizard.beadId.value = $event" />
        </FormField>
        <TechniqueSection v-model:technique="wizard.technique.value" :settings="wizard.settings.value" testid="convert" @set-setting="wizard.setSetting" />
      </ConvertSection>
      <ConvertSection v-else-if="wizard.step.value === 'size'" :step="3" :title="words.sections.size" :summary="summaries.size" testid="convert-section-size">
        <ConvertSizeSection />
      </ConvertSection>
      <ConvertSection v-else-if="wizard.step.value === 'colors'" :step="4" :title="words.sections.colors" :summary="summaries.colors" testid="convert-section-colors">
        <ConvertColorsSection />
      </ConvertSection>
      <ConvertSection v-else :step="5" :title="words.sections.review" :summary="summaries.review" testid="convert-section-review">
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
  flex: none;
  width: var(--convert-sections-width);
  overflow-y: auto;
  overscroll-behavior: contain;
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

/* Under 1024 px or in portrait (PhoneForms card): the preview above the step, the step scrolling under it. */
@media (max-width: 63.99rem), (orientation: portrait) {
  .convert-page {
    flex-direction: column;
  }

  .convert-page__preview {
    flex: 0 1 var(--convert-preview-phone);
    min-height: var(--convert-preview-min);
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
    flex-basis: var(--convert-preview-tablet);
  }
}
</style>
