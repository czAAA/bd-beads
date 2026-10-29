<script setup lang="ts">
import { computed } from 'vue'
import PanelItem from '../shell/PanelItem.vue'
import QualitySlider from '../ui/QualitySlider.vue'
import LoadingState from '../ui/LoadingState.vue'
import { useExportQuality } from '../../composables/export/useExportQuality'
import type { Project } from '../../domain/project'
import { EXPORT_QUALITIES, PNG_DPI_BY_QUALITY, parseExportQuality, shownMegabytes } from '../../domain/exportQuality'
import { decimalSign } from '../../domain/formatNumber'
import { estimatePdf, estimatePng, exportFacts, type SizeEstimate } from '../../rendering/exportEstimate'
import { pdfPageDpi, pngDpiFor } from '../../rendering/exportDpi'
import { plural } from '../../i18n/plural'
import { printText } from '../../rendering/printText'
import { useI18n } from '../../i18n/useI18n'
import { fillBlanks } from '../../domain/fillBlanks'

// The export rows (tickets 568, 576, 0588, 0652; ExportPanel and QualitySlider cards): Picture and Printable chart with
// their File size estimates, then Export quality. One component for the Frame panel's Export section and the Export panel;
// the slot holds what a panel adds under the slider (the Frame panel's Letters).
const props = defineProps<{
  project: Project
  /** A PNG or PDF is being drawn: those two wait, so a second press doesn't start a second one. */
  exporting?: 'png' | 'pdf'
}>()

const emit = defineEmits<{
  'export-png': []
  'export-pdf': []
}>()

const QUALITY_WORDS = { low: 'qualityLow', medium: 'qualityMedium', high: 'qualityHigh' } as const
const { t, locale } = useI18n()
const frame = computed(() => props.project.frame)
/** The Export quality on this device (ticket 576): one choice for the picture and the chart. */
const quality = useExportQuality()
/** What an export is made of, for its File size estimate (ticket 0588): read once for the buttons and every stop. */
const exportFactsNow = computed(() => exportFacts(props.project, printText(props.project, t.value, locale.value, new Date())))
/** A size as the buttons and stops show it: "≈ 1.4 MB" (up to 0.1 MB, whole MB from 10 MB) or "< 0.1 MB". */
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
const pngValue = computed(() => exportValue('PNG', exportFactsNow.value && estimatePng(exportFactsNow.value, pngDpiFor(quality.value))))
const pdfValue = computed(() => exportValue('PDF', exportFactsNow.value && estimatePdf(exportFactsNow.value, pdfPageDpi())))
/** Each stop's words, its dpi and the PNG size it would make for the open Frame (tickets 571, 572, 0583, 0588). */
const qualityStops = computed(() => {
  const facts = exportFactsNow.value
  return EXPORT_QUALITIES.map((id) => {
    const word = t.value.frame[QUALITY_WORDS[id]]
    if (!facts) return { id, word }
    const dpi = pngDpiFor(id)
    const size = sizeText(estimatePng(facts, dpi).bytes)
    const detail = fillBlanks(t.value.frame.qualityDpi, { n: dpi })
    return { id, word, detail, lines: [size], spoken: `${word}, ${detail}, ${size}` }
  })
})
/** The dpi High draws the PNG at when the device cannot allocate a page that large, else nothing. */
const highPngDpi = computed(() => {
  const dpi = pngDpiFor('high')
  return dpi < PNG_DPI_BY_QUALITY.high ? dpi : undefined
})
const qualityHint = computed(() => ({ label: t.value.frame.qualityHintLabel, body: t.value.frame.qualityHint }))
const exportBusy = computed(() => !!props.exporting)
const exportingText = computed(() => fillBlanks(props.exporting === 'pdf' ? t.value.saveBox.makingPdf : t.value.saveBox.makingPng, { name: props.project.name }))
</script>

<template>
  <PanelItem icon="image" :value="pngValue" stays :disabled="!frame || exportBusy" data-testid="export-png" @select="emit('export-png')">{{ t.frame.exportPicture }}</PanelItem>
  <PanelItem icon="pdf" :value="pdfValue" stays :disabled="!frame || exportBusy" data-testid="export-pdf" @select="emit('export-pdf')">{{ t.frame.exportChart }}</PanelItem>
  <QualitySlider
    class="export-section__quality"
    :label="t.frame.exportQuality"
    :stops="qualityStops"
    :hint="qualityHint"
    :model-value="quality"
    :disabled="exportBusy"
    @update:model-value="quality = parseExportQuality($event) ?? quality"
  />
  <p v-if="highPngDpi" class="export-section__line" data-testid="quality-pdf-capped">{{ fillBlanks(t.frame.qualityPdfCapped, { n: highPngDpi }) }}</p>
  <slot />
  <LoadingState v-if="exporting" class="export-section__loading" compact :text="exportingText" />
</template>

<style scoped>
.export-section__quality {
  padding: 0 var(--space-10);
}

.export-section__line {
  margin: 0;
  padding: var(--space-4) var(--space-10);
  font: var(--type-meta-small);
  color: var(--muted);
}

.export-section__loading {
  margin: var(--space-4) var(--space-10);
}
</style>
