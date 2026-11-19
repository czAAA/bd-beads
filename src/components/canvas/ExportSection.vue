<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import EditableLine from '../project/EditableLine.vue'
import AppButton from '../ui/AppButton.vue'
import PanelSwitchRow from '../shell/PanelSwitchRow.vue'
import QualitySlider from '../ui/QualitySlider.vue'
import LoadingState from '../ui/LoadingState.vue'
import { controlAction } from '../../composables/shell/controlRegistry'
import { useExportQuality } from '../../composables/export/useExportQuality'
import { usePrintChoices } from '../../composables/export/usePrintChoices'
import type { Project } from '../../domain/project'
import { EXPORT_QUALITIES, PNG_DPI_BY_QUALITY, parseExportQuality, shownMegabytes } from '../../domain/exportQuality'
import { decimalSign } from '../../domain/formatNumber'
import type { SizeEstimate } from '../../rendering/exportEstimate'
import { pdfPageDpi, pngDpiFor } from '../../rendering/exportDpi'
import { loadPrintCode, type PrintCode } from '../../rendering/loadPrintCode'
import { plural } from '../../i18n/plural'
import { useI18n } from '../../i18n/useI18n'
import { fillBlanks } from '../../domain/fillBlanks'
import { frameOf, projectNameOf } from '../../domain/layerRecord'
import type { ExportChoice } from '../../composables/shell/openPanel'
import { namedChoices, pdfFileName } from '../../composables/export/pdfFileName'
import { MAX_PDF_FILE_NAME, typedPdfFileName } from '../../domain/projectFile'

// The export rows (tickets 568, 0652, 0916, 1095, 1096, 1121; ExportPanel card): PNG, PDF and File (the .openbeads) in one
// row, each saying on hover what it gives, "Saves as" (the PDF's name with its pencil), Export quality folded, Cover page, Large beads, Row by row. One component for the Frame panel's Export
// section and the Export panel; the slot holds what a panel adds under the switches (the Frame panel's Letters).
const props = defineProps<{
  project: Project
  /** A PNG or PDF is being drawn: those two wait, so a second press doesn't start a second one. */
  exporting?: ExportChoice
  /** The row its panel opens on (ticket 0843), marked as the panel's entry so it takes the focus. */
  opensOn?: ExportChoice
}>()

const emit = defineEmits<{
  'export-png': []
  'export-pdf': [typedName?: string]
  /** File (ticket 1121): the Project's .openbeads file, as the Project panel's Save Project file. */
  'save-project-file': []
}>()

/** Save Project file (ADR 0090): File runs it, so its name and Ctrl/⌘ S are the action's. */
const saveFile = controlAction('save-project-file')
const QUALITY_WORDS = { low: 'qualityLow', medium: 'qualityMedium', high: 'qualityHigh' } as const
const QUALITY_CAPTIONS = { low: 'qualityLowCaption', medium: 'qualityMediumCaption', high: 'qualityHighCaption' } as const
const { t, locale } = useI18n()
const frame = computed(() => frameOf(props.project))
/** The Export quality on this device (ticket 576): one choice for the picture and the chart. */
const quality = useExportQuality()
/** Cover page, Large beads and Row by row on this device (tickets 0916, 1096): the PDF's pages and its count follow them at once. */
const { cover, largeBeads, rowByRow, choices } = usePrintChoices()
/** The print code the estimate is worked out with (ticket 0991): asked for as the rows first show, not with the page. */
const printCode = shallowRef<PrintCode>()
loadPrintCode().then(
  (code) => (printCode.value = code),
  // Not arrived (offline before the offline copy had it): the rows show their formats without an estimate.
  () => undefined,
)
/** What an export is made of, for its File size estimate (ticket 0588) and the PDF's page count: read once for the
 * buttons; none until the print code is here. */
const wordsNow = computed(() => printCode.value?.printText(props.project, t.value, locale.value, new Date(), choices.value))
const exportFactsNow = computed(() => wordsNow.value && printCode.value?.exportFacts(props.project, wordsNow.value))
/** Large beads is offered only where it makes the chart's beads bigger (ticket 1125); hidden, it keeps its remembered state. */
const largeBeadsShown = computed(() => !!exportFactsNow.value?.largeBeadsActs)
/** A size as the buttons show it: "≈ 1.4 MB" (up to 0.1 MB, whole MB from 10 MB) or "< 0.1 MB". */
function sizeText(bytes: number): string {
  const megabytes = shownMegabytes(bytes)
  if (megabytes === undefined) return t.value.frame.qualitySizeUnder
  const figure = (megabytes < 10 ? megabytes.toFixed(1) : String(megabytes)).replace('.', decimalSign(locale.value))
  return fillBlanks(t.value.frame.qualitySizeAbout, { size: fillBlanks(t.value.frame.qualitySizeMb, { n: figure }) })
}
/** The button's value: its format, size and how many files or pages ("PNG ≈ 1.4 MB · 2 files"), or the extension with no Frame. */
function exportValue(format: 'PNG' | 'PDF', estimate: SizeEstimate | undefined): string {
  if (!estimate) return `.${format.toLowerCase()}`
  const count = plural(locale.value, estimate.count, format === 'PNG' ? t.value.frame.exportFiles : t.value.frame.exportPages)
  return fillBlanks(t.value.frame.exportSizeValue, { format, size: sizeText(estimate.bytes), count })
}
/** A button's accessible name: its file and what it gives ("Picture, PNG ≈ 1.4 MB · 1 file"), the Tooltip's two lines. */
const spoken = (name: string, value: string) => `${name}, ${value}`
const pngValue = computed(() => exportValue('PNG', exportFactsNow.value && printCode.value?.estimatePng(exportFactsNow.value, pngDpiFor(quality.value))))
const pdfValue = computed(() => exportValue('PDF', exportFactsNow.value && printCode.value?.estimatePdf(exportFactsNow.value, pdfPageDpi())))
/** Each stop's word and its caption in a crafter's words (tickets 571, 0957); the dpi is in the Info note. */
const qualityStops = computed(() => {
  return EXPORT_QUALITIES.map((id) => {
    const word = t.value.frame[QUALITY_WORDS[id]]
    const detail = t.value.frame[QUALITY_CAPTIONS[id]]
    return { id, word, detail, spoken: `${word}, ${detail}` }
  })
})
/** The dpi High draws the PNG at when the device cannot allocate a page that large, else nothing. */
const highPngDpi = computed(() => {
  const dpi = pngDpiFor('high')
  return dpi < PNG_DPI_BY_QUALITY.high ? dpi : undefined
})
/** The Info note: the dpi each stop draws the picture at on this device (ticket 0957). */
const qualityHint = computed(() => ({
  label: t.value.frame.qualityHintLabel,
  body: fillBlanks(t.value.frame.qualityHint, { low: pngDpiFor('low'), medium: pngDpiFor('medium'), high: pngDpiFor('high') }),
}))
/** A name typed for the PDF (ticket 1096): saved as it is, with no switch's word added. It lives while the rows are
 * shown, so closing the panel forgets it. */
const typedName = ref<string>()
/** The PDF's file name as it will be saved, changing at once with each switch. */
const pdfName = computed(() => typedName.value ?? pdfFileName(props.project, namedChoices(choices.value, wordsNow.value), t.value))
const fileLine = computed(() => ({
  label: t.value.frame.savesAs,
  value: pdfName.value,
  editLabel: t.value.frame.fileNameEdit,
  editTooltip: t.value.frame.fileNameTooltip,
  maxlength: MAX_PDF_FILE_NAME,
  normalize: (raw: string) => typedPdfFileName(raw) ?? '',
  fileName: true,
  testid: 'export-file-name',
}))
/** Empty brings the made name back. */
function onRename(name: string) {
  typedName.value = name || undefined
}
const exportBusy = computed(() => !!props.exporting)
const exportingText = computed(() => fillBlanks(props.exporting === 'pdf' ? t.value.saveBox.makingPdf : t.value.saveBox.makingPng, { name: projectNameOf(props.project) }))
</script>

<template>
  <div class="export-section__files" data-testid="export-files">
    <AppButton
      variant="accent-2"
      icon="image"
      :label="t.frame.exportPicture"
      :tooltip="{ body: pngValue }"
      :aria-label="spoken(t.frame.exportPicture, pngValue)"
      :disabled="!frame || exportBusy"
      :data-panel-entry="opensOn === 'png' || undefined"
      data-testid="export-png"
      @click="emit('export-png')"
    >
      PNG
    </AppButton>
    <AppButton
      variant="accent-2"
      icon="pdf"
      :label="t.frame.exportChart"
      :tooltip="{ body: pdfValue }"
      :aria-label="spoken(t.frame.exportChart, pdfValue)"
      :disabled="!frame || exportBusy"
      :data-panel-entry="opensOn === 'pdf' || undefined"
      data-testid="export-pdf"
      @click="emit('export-pdf', typedName)"
    >
      PDF
    </AppButton>
    <AppButton
      variant="accent-2"
      :action="saveFile"
      :tooltip="{ body: t.frame.exportProjectFileBody }"
      :aria-label="spoken(saveFile.name(t), t.frame.exportProjectFileBody)"
      data-testid="export-project-file"
      @click="emit('save-project-file')"
    >
      {{ t.frame.exportProjectFile }}
    </AppButton>
  </div>
  <div class="export-section__file">
    <EditableLine v-bind="fileLine" @save="onRename" />
  </div>
  <div class="export-section__quality">
    <QualitySlider
      :label="t.frame.exportQuality"
      :stops="qualityStops"
      :hint="qualityHint"
      :model-value="quality"
      :disabled="exportBusy"
      foldable
      @update:model-value="quality = parseExportQuality($event) ?? quality"
    />
    <p v-if="highPngDpi" class="export-section__line" data-testid="quality-pdf-capped">{{ fillBlanks(t.frame.qualityPdfCapped, { n: highPngDpi }) }}</p>
  </div>
  <PanelSwitchRow v-model="cover" :label="t.frame.coverPageLabel" :info-label="t.frame.coverPageInfoLabel" :body="t.frame.coverPageLine" testid="export-cover-page" />
  <PanelSwitchRow v-if="largeBeadsShown" v-model="largeBeads" :label="t.frame.largeBeadsLabel" :info-label="t.frame.largeBeadsInfoLabel" :body="t.frame.largeBeadsLine" testid="export-large-beads" />
  <PanelSwitchRow v-model="rowByRow" :label="t.frame.rowByRowLabel" :info-label="t.frame.rowByRowInfoLabel" :body="t.frame.rowByRowLine" testid="export-row-by-row" />
  <slot />
  <LoadingState v-if="exporting" class="export-section__loading" compact :text="exportingText" />
</template>

<style scoped>
/* PNG, PDF and File side by side, a third of the row each (ticket 1121). */
.export-section__files {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-8);
  padding: var(--space-4) var(--space-10);
}

.export-section__files > *,
.export-section__files :deep(.app-button) {
  width: 100%;
}

.export-section__quality {
  padding: 0 var(--space-10);
}

.export-section__line {
  margin: 0;
  padding: var(--space-4) 0 0;
  font: var(--type-meta-small);
  color: var(--muted);
}

.export-section__file {
  padding: 0 var(--space-10);
}

.export-section__loading {
  margin: var(--space-4) var(--space-10);
}
</style>
