<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { ConvertImageStart } from '../../composables/import/useConvertImageFlow'
import { CONVERT_SHEET_QUERY, provideConvertImageWizard, useConvertImageWizard } from '../../composables/import/useConvertImageWizard'
import { useConvertResult } from '../../composables/import/useConvertResult'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'
import { useRovingFocus } from '../../composables/ui/useRovingFocus'
import { estimatedGrams, formatGrams } from '../../domain/beadQuantities'
import { formFactorName, offeredBeads } from '../../domain/beads'
import type { ColorCatalog } from '../../domain/colorCatalog'
import { formatImageLimits, type DecodeImage } from '../../domain/imageConversion'
import type { Project } from '../../domain/project'
import { techniqueName } from '../../i18n/techniqueName'
import { plural } from '../../i18n/plural'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import AppModal from '../ui/AppModal.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import IconButton from '../ui/IconButton.vue'
import FormField from '../ui/form/FormField.vue'
import BeadSection from '../project/BeadSection.vue'
import TechniqueSection from '../project/TechniqueSection.vue'
import ConvertColorsSection from './ConvertColorsSection.vue'
import ConvertImagePreview from './ConvertImagePreview.vue'
import ConvertPictureSection from './ConvertPictureSection.vue'
import ConvertReviewSection from './ConvertReviewSection.vue'
import ConvertSection from './ConvertSection.vue'
import ConvertSizeSection from './ConvertSizeSection.vue'

// The Convert image wizard (spec 0645; ConvertImage, PhoneForms and Modal cards): the live preview beside five numbered
// sections, all open; the large Modal from 1024 px in landscape, else a sheet under a sticky, shrinking preview. Its setup
// is its own copy of the form's; Cancel, Close and Escape with a picture set ask in the footer first.
const props = defineProps<{
  start: ConvertImageStart
  decodeImage: DecodeImage
  loadCatalog: (id: string) => Promise<ColorCatalog>
  readClipboardImage: () => Promise<File | undefined>
}>()

const emit = defineEmits<{ create: [project: Project]; cancel: [] }>()

const { t, locale } = useI18n()
const words = computed(() => t.value.convertImage.wizard)
const wizard = useConvertImageWizard({ start: props.start.draft, decodeImage: props.decodeImage, loadCatalog: props.loadCatalog })
provideConvertImageWizard(wizard)
const result = useConvertResult(wizard)
const sheet = useMediaQuery(CONVERT_SHEET_QUERY)

onMounted(() => {
  if (props.start.file) void wizard.setFile(props.start.file)
})

// --- Ways in on the popup: Paste (the button and Ctrl/Cmd+V) and a drop ---------------------------------------------

const pasteEmpty = ref(false)

async function pasteFromClipboard() {
  const file = await props.readClipboardImage()
  pasteEmpty.value = !file
  if (file) await wizard.setFile(file)
}

/** The first picture a clipboard or drop hands over, if any. */
function pictureIn(transfer: DataTransfer | null | undefined): File | undefined {
  return [...(transfer?.files ?? [])].find((file) => file.type.startsWith('image/') || file.type === '') ?? transfer?.files[0]
}

// Ctrl/Cmd+V anywhere in the popup: a picture on the clipboard is taken; text pastes into a field as usual.
function onPaste(event: ClipboardEvent) {
  const file = pictureIn(event.clipboardData)
  if (!file) return
  event.preventDefault()
  pasteEmpty.value = false
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

// --- Sections and the step rail -------------------------------------------------------------------------------------

type Step = 'picture' | 'bead' | 'size' | 'colors' | 'review'
const STEPS: readonly Step[] = ['picture', 'bead', 'size', 'colors', 'review']

const summaries = computed<Record<Step, string | undefined>>(() => {
  const bead = wizard.bead.value
  const grid = wizard.dimensions.value
  const used = wizard.usedColorCount.value
  const weight = wizard.draftProject.value && estimatedGrams(wizard.found.value.reduce((sum, color) => sum + (color.result ? color.count : 0), 0), bead)
  const source = { 'bead-colors': words.value.beadColors, default: words.value.defaultPalette, exact: words.value.exact }[wizard.source.value]
  return {
    picture: undefined,
    bead: `${formFactorName(bead.formFactor, t.value.formFactors)} ${bead.size} · ${techniqueName(t.value, wizard.technique.value)}`,
    size: `${grid.columns}×${grid.rows}${wizard.mode.value === 'ratio' ? ` · ${wizard.ratio.value.pixels}:${wizard.ratio.value.beads}` : ''}`,
    colors: `${source} · ${used}`,
    review: weight === undefined ? undefined : `≈ ${formatGrams(weight, t.value.quantities.gramsUnit, locale.value)}`,
  }
})

const scrollEl = ref<HTMLElement>()
const railEl = ref<HTMLElement>()
const roving = useRovingFocus(railEl, { selector: '.convert-wizard__step', axis: () => 'horizontal' })
const current = ref<Step>('picture')
const shrunk = ref(false)
/** All five labels show on the rail when all five fit; otherwise numbers only, each label its Tooltip. */
const railCompact = ref(false)
const compact = computed(() => sheet.value || railCompact.value)

function sectionEl(step: Step): HTMLElement | null | undefined {
  return scrollEl.value?.querySelector<HTMLElement>(`[data-testid="convert-section-${step}"]`)
}

/** The section in view: the last one whose top has reached the rail. */
function onScroll(event: Event) {
  const scroller = event.currentTarget as HTMLElement
  shrunk.value = sheet.value && scroller.scrollTop > 0
  const railBottom = railEl.value?.getBoundingClientRect().bottom ?? 0
  current.value = [...STEPS].reverse().find((step) => (sectionEl(step)?.getBoundingClientRect().top ?? Infinity) <= railBottom + 1) ?? 'picture'
}

async function goTo(step: Step) {
  current.value = step
  sectionEl(step)?.scrollIntoView?.({ block: 'start' })
  await nextTick()
  sectionEl(step)?.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true })
}

let railObserver: ResizeObserver | undefined
async function measureRail() {
  railCompact.value = false
  await nextTick()
  const rail = railEl.value
  railCompact.value = !!rail && rail.scrollWidth > rail.clientWidth + 1
}
onMounted(() => {
  void measureRail()
  railObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(() => void measureRail())
  if (railEl.value) railObserver?.observe(railEl.value)
})
onBeforeUnmount(() => railObserver?.disconnect())

// --- Footer: Create, Cancel and Cancel's question ------------------------------------------------------------------

const confirming = ref(false)
const keepButton = ref<InstanceType<typeof AppButton>>()
const footerLine = computed(() =>
  result.value ? `${result.value.grid} · ${result.value.measured} · ${plural(locale.value, wizard.usedColorCount.value, words.value.colorsCount)}` : words.value.noPicture,
)

/** Cancel, Close and Escape: with a picture set they ask first, in the footer (one modal at a time). */
async function onCancelAsked() {
  if (confirming.value) {
    confirming.value = false
    return
  }
  if (!wizard.hasPicture.value) {
    emit('cancel')
    return
  }
  confirming.value = true
  await nextTick()
  ;(keepButton.value?.$el as HTMLElement | undefined)?.focus()
}

function onCreate() {
  const project = wizard.createProject()
  if (project) emit('create', project)
}
</script>

<template>
  <AppModal :title="words.title" size="large" data-testid="convert-image-wizard" @cancel="onCancelAsked">
    <template #header>
      <IconButton variant="plain" icon="close" :icon-size="18" :label="words.close" data-testid="convert-close" @click="onCancelAsked" />
    </template>

    <div
      ref="scrollEl"
      class="convert-wizard"
      :class="{ 'convert-wizard--shrunk': shrunk }"
      @scroll="onScroll"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <div class="convert-wizard__preview-pane">
        <div class="convert-wizard__preview">
          <ConvertImagePreview :shrunk="shrunk" />
        </div>
      </div>

      <div class="convert-wizard__sections" @scroll="onScroll">
        <nav ref="railEl" class="convert-wizard__rail" :class="{ 'convert-wizard__rail--compact': compact }" :aria-label="words.railLabel" @keydown="roving.onKeydown">
          <template v-for="(step, index) in STEPS" :key="step">
            <span v-if="index > 0" class="convert-wizard__hairline" aria-hidden="true" />
            <component :is="compact ? AppTooltip : 'span'" v-bind="compact ? { name: words.rail[step], announce: false } : {}" class="convert-wizard__step-wrap">
              <button
                type="button"
                class="convert-wizard__step"
                :class="{ 'convert-wizard__step--current': current === step }"
                :aria-current="current === step ? 'step' : undefined"
                :aria-label="compact ? words.rail[step] : undefined"
                :tabindex="roving.tabIndexFor(current === step)"
                :data-testid="`convert-step-${step}`"
                @click="goTo(step)"
              >
                <span class="convert-wizard__disc">{{ index + 1 }}</span>
                <span v-if="!compact" class="convert-wizard__step-label">{{ words.rail[step] }}</span>
              </button>
            </component>
          </template>
        </nav>

        <ConvertSection :step="1" :title="words.sections.picture" :done="wizard.hasPicture.value" testid="convert-section-picture">
          <ConvertPictureSection @paste="pasteFromClipboard" />
          <p v-if="pasteEmpty" class="convert-wizard__notice" role="status" data-testid="convert-nothing-to-paste">{{ words.nothingToPaste }}</p>
        </ConvertSection>
        <ConvertSection
          :step="2"
          :title="words.sections.bead"
          :summary="summaries.bead"
          :disabled="!wizard.hasPicture.value"
          :disabled-summary="words.addPictureFirst"
          testid="convert-section-bead"
        >
          <FormField :label="t.form.beadLabel">
            <BeadSection v-model:bead-shape="wizard.beadShape.value" :bead="wizard.bead.value" :candidates="offeredBeads()" @pick="wizard.beadId.value = $event" />
          </FormField>
          <TechniqueSection v-model:technique="wizard.technique.value" :settings="wizard.settings.value" testid="convert" @set-setting="wizard.setSetting" />
        </ConvertSection>
        <ConvertSection
          :step="3"
          :title="words.sections.size"
          :summary="summaries.size"
          :disabled="!wizard.hasPicture.value"
          :disabled-summary="words.addPictureFirst"
          testid="convert-section-size"
        >
          <ConvertSizeSection />
        </ConvertSection>
        <ConvertSection
          :step="4"
          :title="words.sections.colors"
          :summary="summaries.colors"
          :disabled="!wizard.hasPicture.value"
          :disabled-summary="words.addPictureFirst"
          testid="convert-section-colors"
        >
          <ConvertColorsSection />
        </ConvertSection>
        <ConvertSection
          :step="5"
          :title="words.sections.review"
          :summary="summaries.review"
          :disabled="!wizard.hasPicture.value"
          :disabled-summary="words.addPictureFirst"
          testid="convert-section-review"
        >
          <ConvertReviewSection />
        </ConvertSection>
      </div>

      <div v-if="dropping" class="convert-wizard__dropping" data-testid="convert-dropping">
        <AppIcon name="image" :size="34" />
        <span class="convert-wizard__dropping-title">{{ words.dropToUse }}</span>
        <span class="convert-wizard__dropping-limits">{{ dropLimits }}</span>
      </div>
    </div>

    <template #actions>
      <div v-if="confirming" class="convert-wizard__footer" data-testid="convert-discard">
        <span class="convert-wizard__question">
          <AppIcon name="warning" :size="16" />
          <span>{{ words.discardQuestion }}</span>
        </span>
        <span class="convert-wizard__buttons">
          <AppButton ref="keepButton" variant="secondary" data-testid="convert-discard-keep" @click="confirming = false">{{ t.convertImage.cancelButton }}</AppButton>
          <AppButton variant="danger" data-testid="convert-discard-confirm" @click="emit('cancel')">{{ words.discard }}</AppButton>
        </span>
      </div>
      <div v-else class="convert-wizard__footer">
        <AppButton class="convert-wizard__cancel" variant="secondary" data-testid="convert-image-cancel" @click="onCancelAsked">{{ t.convertImage.cancelButton }}</AppButton>
        <span class="convert-wizard__line" :class="{ 'convert-wizard__line--empty': !result }" role="status" data-testid="convert-footer-line">{{ footerLine }}</span>
        <AppButton
          class="convert-wizard__create"
          variant="primary"
          :disabled="!wizard.hasPicture.value"
          :label="t.convertImage.createButton"
          :disabled-body="words.addPictureFirst"
          data-testid="convert-image-create"
          @click="onCreate"
        >
          {{ t.convertImage.createButton }}
        </AppButton>
      </div>
    </template>
  </AppModal>
</template>

<style scoped>
/* Two panes from 1024 px in landscape (ConvertImage card): the preview takes the rest, the sections their width. */
.convert-wizard {
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
}

.convert-wizard__preview-pane {
  flex: 1 1 auto;
  min-width: 0;
}

.convert-wizard__preview {
  height: 100%;
}

.convert-wizard__sections {
  position: relative;
  flex: none;
  width: var(--convert-sections-width);
  overflow-y: auto;
  overscroll-behavior: contain;
  border-left: 1px solid var(--panel-rule);
}

@media (max-width: 68.75rem) {
  .convert-wizard__sections {
    width: var(--convert-sections-width-narrow);
  }
}

.convert-wizard__rail {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: var(--space-4);
  box-sizing: border-box;
  height: var(--step-rail);
  padding: 0 var(--space-16);
  overflow: hidden;
  background: var(--overlay-fill);
  border-bottom: 1px solid var(--panel-rule);
}

.convert-wizard__hairline {
  flex: 1 1 var(--space-8);
  min-width: var(--space-4);
  height: 1px;
  background: var(--line);
}

.convert-wizard__step-wrap {
  display: inline-flex;
  flex: none;
}

.convert-wizard__step {
  display: inline-flex;
  align-items: center;
  gap: var(--space-6);
  padding: var(--space-2);
  font: var(--type-label);
  color: var(--muted);
  white-space: nowrap;
  background: none;
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.convert-wizard__step:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

.convert-wizard__disc {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: var(--step-disc);
  height: var(--step-disc);
  font: var(--type-meta-small);
  color: var(--ink);
  background: var(--overlay-fill);
  border: 1px solid var(--line-strong);
  border-radius: 50%;
}

.convert-wizard__step--current {
  color: var(--ink);
}

.convert-wizard__step--current .convert-wizard__disc {
  box-shadow: 0 0 0 2px var(--overlay-fill), 0 0 0 4px var(--ink);
}

.convert-wizard__notice {
  margin: 0;
  font: var(--type-meta);
  color: var(--muted);
}

/* A picture dragged over the popup: the drop look over all of it. */
.convert-wizard__dropping {
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

.convert-wizard__dropping-title {
  font: var(--type-control);
}

.convert-wizard__dropping-limits {
  font: var(--type-meta);
  color: var(--muted);
}

.convert-wizard__footer {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--space-12);
  min-width: 0;
}

.convert-wizard__line {
  flex: 1;
  min-width: 0;
  font: var(--type-meta);
  color: var(--body);
  text-align: center;
}

.convert-wizard__line--empty {
  color: var(--muted);
}

.convert-wizard__cancel,
.convert-wizard__create {
  flex: none;
  height: var(--field-height);
}

.convert-wizard__question {
  display: inline-flex;
  flex: 1;
  align-items: center;
  gap: var(--space-8);
  font: var(--type-control);
  color: var(--ink);
}

.convert-wizard__question > .icon {
  color: var(--warning);
}

.convert-wizard__buttons {
  display: inline-flex;
  gap: var(--space-8);
}

/* Under 1024 px or in portrait (PhoneForms card): one long scroll, the preview sticky on top, shrinking (by transform,
 * so the sections never reflow) once they scroll under it, the rail under it. */
@media (max-width: 63.99rem), (orientation: portrait) {
  .convert-wizard {
    flex-direction: column;
    overflow-y: auto;
    overscroll-behavior: contain;
    /* As the panels do (AppPanel): the sheet is scrolled by a finger, and a bar would take the sections' room. */
    scrollbar-width: none;
    --preview-height: var(--convert-preview-phone);
    --preview-shrunk: var(--convert-preview-phone-shrunk);
    /* The shrunk height over the full one (132 / 300): calc cannot divide one length by another. */
    --preview-shrink: 0.44;
  }

  .convert-wizard__preview-pane {
    position: sticky;
    top: 0;
    z-index: 3;
    flex: none;
    height: var(--preview-height);
    pointer-events: none;
  }

  /* The band behind the preview, full width, at the height the preview takes now: the scaled preview is narrower than
   * the sheet, and nothing may show through beside it. Absolutely placed, so its height changes nothing else. */
  .convert-wizard__preview-pane::before {
    position: absolute;
    inset: 0 0 auto;
    height: var(--preview-height);
    content: '';
    background: var(--box);
    border-bottom: 1px solid var(--panel-rule);
    transition: height var(--duration-base) var(--ease-out);
  }

  .convert-wizard--shrunk .convert-wizard__preview-pane::before {
    height: var(--preview-shrunk);
  }

  .convert-wizard__preview {
    position: relative;
    height: var(--preview-height);
    pointer-events: auto;
    transform-origin: top center;
    transition: transform var(--duration-base) var(--ease-out);
  }

  .convert-wizard--shrunk .convert-wizard__preview {
    transform: scale(var(--preview-shrink));
  }

  .convert-wizard__sections {
    width: auto;
    overflow: visible;
    border-left: 0;
  }

  .convert-wizard__sections > :not(.convert-wizard__rail) {
    box-sizing: border-box;
    width: 100%;
    max-width: 40rem;
    margin-inline: auto;
  }

  .convert-wizard__rail {
    top: var(--preview-height);
    height: var(--step-rail-phone);
  }

  .convert-wizard--shrunk .convert-wizard__rail {
    top: var(--preview-shrunk);
  }

  .convert-wizard__footer {
    flex-wrap: wrap;
  }

  .convert-wizard__line {
    flex-basis: 100%;
    order: -1;
  }

  .convert-wizard__cancel,
  .convert-wizard__create {
    flex: 1;
    height: var(--field-height-phone);
  }
}

@media (min-width: 40rem) and (orientation: portrait) {
  .convert-wizard {
    --preview-height: var(--convert-preview-tablet);
    --preview-shrunk: var(--convert-preview-tablet-shrunk);
    /* 200 / 440. */
    --preview-shrink: 0.4545;
  }
}

@media (prefers-reduced-motion: reduce) {
  .convert-wizard__preview,
  .convert-wizard__preview-pane::before {
    transition: none;
  }
}
</style>
