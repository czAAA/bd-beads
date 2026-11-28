<script setup lang="ts">
import { computed, ref, shallowRef, useId } from 'vue'
import EditableLine from '../project/EditableLine.vue'
import AppButton from '../ui/AppButton.vue'
import ProjectFileButton from './ProjectFileButton.vue'
import PanelSection from '../shell/PanelSection.vue'
import PanelItem from '../shell/PanelItem.vue'
import PanelSwitchRow from '../shell/PanelSwitchRow.vue'
import QualitySlider from '../ui/QualitySlider.vue'
import ChipRadioGroup from '../ui/form/ChipRadioGroup.vue'
import LoadingState from '../ui/LoadingState.vue'
import { usePanelSection } from '../../composables/shell/usePanelSection'
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
import { frameOf, projectNameOf, firstFrameId } from '../../domain/layerRecord'
import { frameRowOrder, ROW_WAYS } from '../../domain/rowProgress'
import type { ExportChoice } from '../../composables/shell/openPanel'
import { namedChoices, pdfFileName } from '../../composables/export/pdfFileName'
import { MAX_PDF_FILE_NAME, typedPdfFileName } from '../../domain/projectFile'
import { MAX_MAKER_NAME } from '../../domain/makerName'
import BetaChip from '../ui/BetaChip.vue'
import { frameShapeOf } from '../../domain/frameShape'

// The export rows (tickets 568, 0652, 0916, 1095, 1096, 1121; ExportPanel card): PNG, PDF and File (the .openbeads) in one
// row, each saying on hover what it gives, "Saves as" (the PDF's name with its pencil), Export quality folded, Cover page, Black and white, Empty grid, Chart border (ticket 1127), Large beads, Row by row. One component for the Frame panel's Export
// section and the Export panel; the slot holds what a panel adds under the switches (the Frame panel's Letters).
const props = defineProps<{
  project: Project
  /** A PNG or PDF is being drawn: those two wait, so a second press doesn't start a second one. */
  exporting?: ExportChoice
  /** The row its panel opens on (ticket 0843), marked as the panel's entry so it takes the focus. */
  opensOn?: ExportChoice
  /** Unfolded in the expanded sheet's rail (ticket 1260): plain rows, the file's name read only. */
  rail?: boolean
}>()

const emit = defineEmits<{
  'export-png': []
  'export-pdf': [typedName?: string]
  /** File (ticket 1121): the Project's .openbeads file, as the Project panel's Save Project file. */
  'save-project-file': []
  /** Name on exports (ticket 1210): the Project's own maker's name, saved at once. */
  'save-maker-name': [name: string]
}>()

const QUALITY_WORDS = { low: 'qualityLow', medium: 'qualityMedium', high: 'qualityHigh' } as const
const QUALITY_CAPTIONS = { low: 'qualityLowCaption', medium: 'qualityMediumCaption', high: 'qualityHighCaption' } as const
const { t, locale } = useI18n()
const frame = computed(() => frameOf(props.project))
/** Whether the Frame has a Frame shape: PNG and PDF of one still carry the Beta chip (ticket 1198). */
const customFrame = computed(() => !!frame.value && !!frameShapeOf(frame.value))
/** The Export quality on this device (ticket 576): one choice for the picture and the chart. */
const quality = useExportQuality()
/** Cover page, Black and white, Empty grid, Chart border, Large beads and Row by row on this device (tickets 0916, 1096,
 * 1127): the PDF's pages, its count and its look follow them at once. */
const { cover, blackAndWhite, emptyGrid, chartBorder, largeBeads, rowByRow, rowByRowWay, choices } = usePrintChoices()
/** The print code the estimate is worked out with (ticket 0991): asked for as the rows first show, not with the page. */
const printCode = shallowRef<PrintCode>()
loadPrintCode().then(
  (code) => (printCode.value = code),
  // Not arrived (offline before the offline copy had it): the rows show their formats without an estimate.
  () => undefined,
)
/** What an export is made of, for its File size estimate (ticket 0588) and the PDF's page count: read once for the
 * buttons; none until the print code is here. */
const wordsNow = computed(() => printCode.value?.printText(props.project, t.value, locale.value, new Date(), choices.value, firstFrameId(props.project)))
const exportFactsNow = computed(() => wordsNow.value && printCode.value?.exportFacts(props.project, wordsNow.value, firstFrameId(props.project)))
/** Large beads is offered only where it makes the chart's beads bigger (ticket 1125); hidden, it keeps its remembered state. */
const largeBeadsShown = computed(() => !!exportFactsNow.value?.largeBeadsActs)
/** Which way Row by row's rows run is asked only with Row by row on, for a Frame whose weaver may turn its rows (a Custom
 * frame's Row order runs one way); hidden, it keeps its remembered choice. */
const rowWayShown = computed(() => rowByRow.value && !!frame.value && frameRowOrder(props.project, firstFrameId(props.project)).turns)
const WAY_WORDS = { down: 'topToBottom', right: 'leftToRight', up: 'bottomToTop', left: 'rightToLeft' } as const
const rowWayLabelId = useId()
const rowWayOptions = computed(() => [
  { value: 'progress' as const, label: t.value.frame.rowByRowWayProgress, testid: 'export-row-by-row-way-progress', action: { name: () => t.value.frame.rowByRowWayProgress, body: () => t.value.frame.rowByRowWayLine, chords: [] } },
  ...ROW_WAYS.map((way) => ({ value: way, label: t.value.rowProgress[WAY_WORDS[way]], testid: `export-row-by-row-way-${way}`, action: { name: () => t.value.rowProgress[WAY_WORDS[way]], chords: [] } })),
])
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
/** The Project's Name on exports (ticket 1210; NameOnExports card): the row under "Saves as", the same name the margin's
 * pencil edits. */
const makerLine = computed(() => ({
  label: t.value.frame.nameOnExports,
  value: props.project.makerName ?? '',
  editLabel: t.value.panels.project.changeMaker,
  emptyText: t.value.saveBox.yourName,
  placeholder: t.value.saveBox.yourName,
  maxlength: MAX_MAKER_NAME,
  normalize: (raw: string) => raw.trim(),
  testid: 'export-maker-name',
}))
/** Empty brings the made name back. */
function onRename(name: string) {
  typedName.value = name || undefined
}
/** The settings fold, kept on this device as the panel's is: the rail's row and the panel's section are one. */
const settings = usePanelSection(() => 'export:settings', () => true)
/** Name on exports' row in the rail, unfolded to the maker's chip. */
const makerOpen = ref(false)
const exportBusy = computed(() => !!props.exporting)
const exportingText = computed(() => fillBlanks(props.exporting === 'pdf' ? t.value.saveBox.makingPdf : t.value.saveBox.makingPng, { name: projectNameOf(props.project) }))
</script>

<template>
  <div v-if="rail" class="export-section__rows" data-testid="export-files">
    <PanelItem :disabled="!frame || exportBusy" :name="t.frame.exportPicture" :body="pngValue" :disabled-body="pngValue" :aria-label="spoken(t.frame.exportPicture, pngValue)" data-testid="export-png" @select="emit('export-png')">
      PNG
      <BetaChip v-if="customFrame" feature="customFrameExports" name="PNG export" />
    </PanelItem>
    <PanelItem :disabled="!frame || exportBusy" :name="t.frame.exportChart" :body="pdfValue" :disabled-body="pdfValue" :aria-label="spoken(t.frame.exportChart, pdfValue)" data-testid="export-pdf" @select="emit('export-pdf')">
      PDF
      <BetaChip v-if="customFrame" feature="customFrameExports" name="PDF export" />
    </PanelItem>
    <ProjectFileButton row @save-project-file="emit('save-project-file')" />
    <p class="export-section__name" data-user-text data-testid="export-file-name">{{ pdfName }}</p>
    <PanelItem :expanded="makerOpen" data-testid="export-maker-row" @select="makerOpen = !makerOpen">{{ t.frame.nameOnExports }}</PanelItem>
    <div v-if="makerOpen" class="export-section__file">
      <EditableLine v-bind="makerLine" bare @save="emit('save-maker-name', $event)" />
    </div>
    <PanelItem :expanded="settings.open.value" data-testid="export-settings-row" @select="settings.toggle()">{{ t.frame.exportSettings }}</PanelItem>
  </div>
  <div v-if="!rail" class="export-section__files" data-testid="export-files">
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
      <BetaChip v-if="customFrame" feature="customFrameExports" name="PNG export" />
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
      <BetaChip v-if="customFrame" feature="customFrameExports" name="PDF export" />
    </AppButton>
    <ProjectFileButton @save-project-file="emit('save-project-file')" />
  </div>
  <template v-if="!rail">
    <div class="export-section__file">
      <EditableLine v-bind="fileLine" @save="onRename" />
    </div>
    <div class="export-section__file">
      <EditableLine v-bind="makerLine" @save="emit('save-maker-name', $event)" />
    </div>
  </template>
  <!-- The settings fold (ticket 1210): folded until opened, then kept on this device; in the rail its row folds it. -->
  <component :is="rail ? 'div' : PanelSection" v-if="!rail || settings.open.value" v-bind="rail ? { class: 'export-section__settings' } : { id: 'export:settings', folded: true, label: t.frame.exportSettings }">
    <div class="export-section__quality">
      <QualitySlider
        :label="t.frame.exportQuality"
        :stops="qualityStops"
        :hint="qualityHint"
        :model-value="quality"
        :disabled="exportBusy"
        @update:model-value="quality = parseExportQuality($event) ?? quality"
      />
      <p v-if="highPngDpi" class="export-section__line" data-testid="quality-pdf-capped">{{ fillBlanks(t.frame.qualityPdfCapped, { n: highPngDpi }) }}</p>
    </div>
    <PanelSwitchRow v-model="cover" :label="t.frame.coverPageLabel" :info-label="t.frame.coverPageInfoLabel" :body="t.frame.coverPageLine" testid="export-cover-page" />
    <PanelSwitchRow v-model="blackAndWhite" :label="t.frame.blackAndWhiteLabel" :info-label="t.frame.blackAndWhiteInfoLabel" :body="t.frame.blackAndWhiteLine" testid="export-black-and-white" />
    <PanelSwitchRow v-model="emptyGrid" :label="t.frame.emptyGridLabel" :info-label="t.frame.emptyGridInfoLabel" :body="t.frame.emptyGridLine" testid="export-empty-grid" />
    <PanelSwitchRow v-model="chartBorder" :label="t.frame.chartBorderLabel" :info-label="t.frame.chartBorderInfoLabel" :body="t.frame.chartBorderLine" testid="export-chart-border" />
    <PanelSwitchRow v-if="largeBeadsShown" v-model="largeBeads" :label="t.frame.largeBeadsLabel" :info-label="t.frame.largeBeadsInfoLabel" :body="t.frame.largeBeadsLine" testid="export-large-beads" />
    <PanelSwitchRow v-model="rowByRow" :label="t.frame.rowByRowLabel" :info-label="t.frame.rowByRowInfoLabel" :body="t.frame.rowByRowLine" testid="export-row-by-row" />
    <div v-if="rowWayShown" class="export-section__way" data-testid="export-row-by-row-way">
      <span :id="rowWayLabelId" class="export-section__way-label">{{ t.frame.rowByRowWayLabel }}</span>
      <ChipRadioGroup
        :model-value="rowByRowWay"
        :options="rowWayOptions"
        :labelledby="rowWayLabelId"
        @update:model-value="rowByRowWay = $event ?? rowByRowWay"
      />
    </div>
  </component>
  <slot />
  <LoadingState v-if="exporting" class="export-section__loading" compact :text="exportingText" />
</template>

<style scoped>
/* In the expanded sheet's rail (ticket 1260): rows indented under Export, the settings a step further. */
.export-section__rows > * {
  --panel-item-indent: calc(var(--space-6) + var(--space-16) + var(--space-8));
}

.export-section__rows :deep(.panel-item) {
  padding-inline: var(--panel-item-indent) var(--space-6);
}

.export-section__rows .export-section__file {
  padding-inline: var(--panel-item-indent) var(--space-6);
}

.export-section__name {
  margin: 0;
  padding: var(--space-4) var(--space-6) var(--space-4) var(--panel-item-indent);
  font: var(--type-meta);
  color: var(--muted);
  overflow-wrap: anywhere;
}

.export-section__settings {
  padding-inline-start: var(--space-16);
}

/* A long word breaks inside its stop, and the chosen one's name goes under the label, in a narrow rail. */
.export-section__settings :deep(.qs-head) {
  flex-wrap: wrap;
}

.export-section__settings :deep(.qs-chosen) {
  margin-inline-start: auto;
}

.export-section__settings :deep(.qs-stop > *) {
  max-width: 100%;
  overflow-wrap: anywhere;
}

.export-section__settings .export-section__quality,
.export-section__settings .export-section__way,
.export-section__settings :deep(.panel-switch-row) {
  padding-inline: var(--space-4) var(--space-6);
}

/* PNG, PDF and File side by side, a third of the row each (ticket 1121). */
.export-section__files {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-8);
  padding: var(--space-4) var(--space-10);
  container-type: inline-size;
}

/* A third of a narrow row has no room for the icon, the name and a Beta chip: the buttons that carry the chip drop their
   icon, so the chip stays inside the button's edge (ticket 1198). */
@container (max-width: 400px) {
  .export-section__files :deep(.app-button:has(> .beta-chip) > .icon) {
    display: none;
  }
}

/* Narrower still (a phone's longest Beta word): the button and the chip squeeze their padding too. */
@container (max-width: 300px) {
  .export-section__files :deep(.app-button:has(> .beta-chip)) {
    gap: var(--space-2);
    padding-inline: var(--space-6) var(--space-4);
  }

  .export-section__files :deep(.app-button > .beta-chip .beta-chip__label) {
    padding-inline: var(--space-2);
  }
}

.export-section__files > *,
.export-section__files :deep(.app-button) {
  width: 100%;
}

.export-section__way {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-10);
}

.export-section__way-label {
  font: var(--type-meta);
  color: var(--muted);
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
