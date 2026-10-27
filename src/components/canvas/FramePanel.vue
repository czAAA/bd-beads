<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import BeadQuantities from '../palette/BeadQuantities.vue'
import EditableLine from '../project/EditableLine.vue'
import PanelItem from '../shell/PanelItem.vue'
import PanelSection from '../shell/PanelSection.vue'
import { PANEL_CONTEXT } from '../shell/panelContext'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import AppSwitch from '../ui/AppSwitch.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import IconButton from '../ui/IconButton.vue'
import QualitySlider from '../ui/QualitySlider.vue'
import LoadingState from '../ui/LoadingState.vue'
import TextField from '../ui/form/TextField.vue'
import AppStepper from '../ui/form/AppStepper.vue'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import { useExportQuality } from '../../composables/export/useExportQuality'
import { useHoldRepeat } from '../../composables/ui/useHoldRepeat'
import { COFFEE_URL } from '../../data/coffeeLink'
import { FRAME_EDGES, fitToDrawing, frameWithEdgeStep, type FrameEdge } from '../../domain/frame'
import { frameAllows, frameSizeOf, sizeSettingOf } from '../../domain/frameKind'
import { MAX_PIECE_NAME } from '../../domain/pieceNames'
import { frameWeave, resolveProjectBead, rowProgressStarted, type Project } from '../../domain/project'
import { estimatedSizeMm, formatSizeMm } from '../../domain/projectSize'
import { describeWeave } from '../../domain/weave'
import { hasWordChart } from '../../domain/wordChart'
import { EXPORT_QUALITIES, PNG_DPI_BY_QUALITY, shownMegabytes, type ExportQuality } from '../../domain/exportQuality'
import { decimalSign } from '../../domain/formatNumber'
import { estimatePdf, estimatePng, exportFacts, type SizeEstimate } from '../../rendering/exportEstimate'
import { pdfPageDpi, pngDpiFor } from '../../rendering/exportDpi'
import { plural } from '../../i18n/plural'
import { printText } from '../../rendering/printText'
import { useI18n } from '../../i18n/useI18n'

// The Frame panel (tickets 473, 475, 555, 568; Frame card): title with Rotate and Remove, Export (off with no Frame), the
// name, size and Beads needed; with no Frame, Frame from starter, Select a frame and Fit. A panel like Menu and Project
// (AppPanels, PanelHost), opened from the strip's Frame button only; a press outside or Escape closes it.
const props = defineProps<{
  project: Project
  /** The Project as summaries see it while a stroke is going on (useSettledProject), for Beads needed. */
  settledProject?: Project
  /** A PNG or PDF is being drawn: those two wait, so a second press doesn't start a second one. */
  exporting?: 'png' | 'pdf'
}>()

const emit = defineEmits<{
  step: [edge: FrameEdge, step: 1 | -1]
  resize: [columns: number, rows: number]
  rotate: []
  remove: []
  rename: [name: string]
  fit: []
  'select-frame': []
  'export-png': []
  'export-pdf': []
  'set-letters': [on: boolean]
  key: [event: KeyboardEvent]
  'set-size': [size: number]
}>()

const QUALITY_WORDS = { low: 'qualityLow', medium: 'qualityMedium', high: 'qualityHigh' } as const
const { t, locale } = useI18n()
const context = inject(PANEL_CONTEXT, undefined)
const deps = computed(() => controlDeps({ activeProject: () => props.project }))
const rotateAction = controlAction('rotate-frame')
const removeAction = controlAction('remove-frame')
const locked = computed(() => rowProgressStarted(props.project))
const frame = computed(() => props.project.frame)

/** A Custom frame's size, its range and its setting's words (Rounds, Part size or Rows; tickets 0592, 0593), in place
 * of Width and Height; none for a Rectangular Frame. */
const size = computed(() => {
  const setting = frame.value && sizeSettingOf(frame.value)
  return setting && { value: frameSizeOf(frame.value!)!, min: setting.min, max: setting.max, words: t.value.frame.sizeSettings[setting.name] }
})
/** Whether the Frame can be turned a quarter: its kind allows it (a Custom frame too, ticket 0594). */
const rotatable = computed(() => frameAllows(frame.value, 'rotate'))

/** The edge the last press stepped, lit in its cell. */
const lastEdge = ref<FrameEdge>()

const cells = FRAME_EDGES.map((edge) => {
  const hold = useHoldRepeat((direction) => {
    const current = frame.value
    if (!current || locked.value || frameWithEdgeStep(props.project, current, edge, direction) === current) return false
    lastEdge.value = edge
    emit('step', edge, direction)
    return true
  })
  return { edge, out: controlAction(`frame-edge-${edge}-out`), in: controlAction(`frame-edge-${edge}-in`), shrink: hold.handlers(-1), grow: hold.handlers(1) }
})
/** The width and height fields start empty (their placeholders show the current size), so a tablet's keyboard only opens
 * on a tap. They take whole numbers from 1 up; Enter or leaving both takes them, an empty one keeps its side, Escape clears. */
const typedWidth = ref('')
const typedHeight = ref('')
const sizeEdited = computed(() => typedWidth.value !== '' || typedHeight.value !== '')
/** Whether a quarter turn is offered: not in Netting, where a turned diamond row isn't a row (ticket 486). */
const turnable = computed(() => describeWeave(frameWeave(props.project)).quarterTurn)
const counted = computed(() => describeWeave(frameWeave(props.project)).unitsOf(frame.value ?? { columns: 0, rows: 0 }))
const sizeUnit = computed(() => (describeWeave(frameWeave(props.project)).countsUnits ? t.value.frame.sizeUnitUnits : t.value.frame.sizeUnit))
function clearSize(): void {
  typedWidth.value = ''
  typedHeight.value = ''
}
function commitSize(): void {
  const columns = Number(typedWidth.value) || counted.value.columns
  const rows = Number(typedHeight.value) || counted.value.rows
  // The size it already has is no step: re-centring it would shift a Frame whose rows alternate by a pair.
  if (sizeEdited.value && columns && rows && (columns !== counted.value.columns || rows !== counted.value.rows)) emit('resize', columns, rows)
  clearSize()
}
/** Keeps digits only, as typed or pasted, and no leading zero. */
const onlyDigits = (text: string): string => text.replace(/\D/g, '').replace(/^0+/, '').slice(0, 3)
function setSize(side: 'width' | 'height', text: string): void {
  if (side === 'width') typedWidth.value = onlyDigits(text)
  else typedHeight.value = onlyDigits(text)
}
/** A refused character leaves the state as it was, so the field is put back to the state by hand. */
function cleanSizeInput(event: Event): void {
  const input = event.target as HTMLInputElement
  input.value = onlyDigits(input.value)
}
function onSizeKey(event: KeyboardEvent): void {
  event.stopPropagation()
  if (event.key === 'Enter') commitSize()
}
/** Focus moving from one field to the other is no end of editing. */
function onSizeFocusOut(event: FocusEvent): void {
  if (!(event.relatedTarget instanceof Node && (event.currentTarget as HTMLElement).contains(event.relatedTarget))) commitSize()
}

/** The Estimated size as "≈ 3.8 × 3.9 cm" (the Bead's size × beads across and down), or nothing for an unknown Bead. */
const estimate = computed(() => {
  const bead = resolveProjectBead(props.project)
  return bead && frame.value ? `≈ ${formatSizeMm(estimatedSizeMm(frame.value, bead), { mm: t.value.form.unitMm, cm: t.value.form.unitCm }, locale.value)}` : ''
})
const sizeSummary = computed(() =>
  [size.value ? plural(locale.value, size.value.value, size.value.words.summary) : `${counted.value.columns} × ${counted.value.rows}`, estimate.value].filter(Boolean).join(' · '),
)
/** Fit a frame to the drawing needs something drawn. */
const nothingToFit = computed(() => fitToDrawing(props.project) === undefined)
/** The Export quality on this device (ticket 576): one choice for the picture and the chart. */
const quality = useExportQuality()
/** What an export is made of, for its File size estimate (ticket 0588): read once for the buttons and every stop. */
const exportFactsNow = computed(() => exportFacts(props.project, printText(props.project, t.value, locale.value, new Date())))
/** A size as the buttons and stops show it: "≈ 1.4 MB" (up to 0.1 MB, whole MB from 10 MB) or "< 0.1 MB". */
function sizeText(bytes: number): string {
  const megabytes = shownMegabytes(bytes)
  if (megabytes === undefined) return t.value.frame.qualitySizeUnder
  const figure = (megabytes < 10 ? megabytes.toFixed(1) : String(megabytes)).replace('.', decimalSign(locale.value))
  return t.value.frame.qualitySizeAbout.replace('{size}', t.value.frame.qualitySizeMb.replace('{n}', figure))
}
/** The button's value: its format, size and how many files or pages ("PNG ≈ 1.4 MB · 2 files"), or the extension with no Frame. */
function exportValue(format: 'PNG' | 'PDF', estimate: SizeEstimate | undefined): string {
  if (!estimate) return `.${format.toLowerCase()}`
  const count = plural(locale.value, estimate.count, format === 'PNG' ? t.value.frame.exportFiles : t.value.frame.exportPages)
  return t.value.frame.exportSizeValue.replace('{format}', format).replace('{size}', sizeText(estimate.bytes)).replace('{count}', count)
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
    const detail = t.value.frame.qualityDpi.replace('{n}', String(dpi))
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
const exportingText = computed(() => (props.exporting === 'pdf' ? t.value.saveBox.makingPdf : t.value.saveBox.makingPng).replace('{name}', props.project.name))

/** The Tooltip over the off size fields. */
const lockedTip = computed(() => ({ name: t.value.frame.title, disabled: true as const, disabledBody: t.value.tooltips.frameSizeLocked, announce: false }))

// Top, Bottom, Left, Right is the cell order whatever the edges' own order is.
const ordered = (['top', 'bottom', 'left', 'right'] as const).map((edge) => cells.find((cell) => cell.edge === edge)!)
</script>

<template>
  <div class="frame-panel" role="group" :aria-label="t.frame.title" data-testid="frame-panel" @keydown="emit('key', $event)">
    <div class="frame-panel__title">
      <span class="frame-panel__label">{{ t.frame.titleLabel }}</span>
      <span v-if="frame" class="frame-panel__tools">
        <IconButton
          v-if="!locked && turnable && rotatable"
          variant="plain"
          :icon-size="16"
          :action="rotateAction"
          :deps="deps"
          data-testid="frame-rotate"
          @click="emit('rotate')"
        />
        <IconButton
          variant="plain"
          :icon-size="16"
          :action="removeAction"
          :deps="deps"
          class="frame-panel__remove"
          data-testid="frame-chrome-remove"
          @click="emit('remove')"
        />
      </span>
    </div>

    <!-- Export first and always shown (ticket 568): off with no Frame, with the way to get one written under it. -->
    <PanelSection id="frame:export" :label="t.panels.project.exportHeading">
      <PanelItem icon="image" :value="pngValue" stays :disabled="!frame || exportBusy" data-testid="export-png" @select="emit('export-png')">{{ t.frame.exportPicture }}</PanelItem>
      <PanelItem icon="pdf" :value="pdfValue" stays :disabled="!frame || exportBusy" data-testid="export-pdf" @select="emit('export-pdf')">{{ t.frame.exportChart }}</PanelItem>
      <QualitySlider
        class="frame-panel__quality"
        :label="t.frame.exportQuality"
        :stops="qualityStops"
        :hint="qualityHint"
        :model-value="quality"
        :disabled="exportBusy"
        @update:model-value="quality = $event as ExportQuality"
      />
      <p v-if="highPngDpi" class="frame-panel__line" data-testid="quality-pdf-capped">{{ t.frame.qualityPdfCapped.replace('{n}', String(highPngDpi)) }}</p>
      <!-- Letters (ticket 0573): the Swatch letter on the Frame's beads, the PNG and the PDF; saved with the Project. -->
      <template v-if="frame">
        <div class="frame-panel__letters">
          <span class="frame-panel__letters-label">{{ t.frame.lettersLabel }}</span>
          <AppSwitch :model-value="project.letters === true" :label="t.frame.lettersLabel" data-testid="frame-letters" @update:model-value="emit('set-letters', $event)" />
        </div>
        <p class="frame-panel__line" data-testid="frame-letters-line">{{ t.frame.lettersLine }}</p>
        <!-- The Word chart follows Letters (ticket 0574) but not in every Technique. -->
        <p v-if="project.letters && !hasWordChart(frameWeave(project).technique)" class="frame-panel__line" data-testid="frame-letters-unavailable">{{ t.frame.lettersUnavailable }}</p>
      </template>
      <p v-if="!frame" class="frame-panel__line" data-testid="export-needs-frame">{{ t.frame.exportNeedsFrame }}</p>
      <LoadingState v-if="exporting" class="frame-panel__loading" compact :text="exportingText" />
      <!-- Buy me a coffee (ticket 560): one plain line, no popup; absent while the Coffee link is empty. -->
      <p v-if="COFFEE_URL" class="frame-panel__line" data-testid="frame-coffee">
        {{ t.frame.exportCoffee }}
        <a class="frame-panel__coffee" :href="COFFEE_URL" target="_blank" rel="noopener" data-testid="frame-coffee-link">{{ t.frame.exportCoffeeLink }}</a>
      </p>
    </PanelSection>

    <template v-if="frame">
      <div class="frame-panel__name">
        <EditableLine
          :label="t.panels.project.nameLabel"
          :value="frame.name ?? ''"
          :edit-label="t.frame.nameEdit"
          :edit-tooltip="t.frame.nameTooltip"
          :empty-text="t.frame.nameEmpty"
          :maxlength="MAX_PIECE_NAME"
          :normalize="(raw) => raw.trim()"
          testid="frame-name"
          @save="emit('rename', $event)"
        />
      </div>

      <PanelSection id="frame:size" :label="t.frame.sizeHeading" :summary="sizeSummary">
        <!-- A Custom frame is sized by its Rounds, Part size or Rows (tickets 0592, 0593): growing adds empty rounds or
             rows outside, shrinking asks first. -->
        <div v-if="size" class="frame-panel__body">
          <div class="frame-panel__setting" data-testid="frame-setting">
            <span class="frame-panel__setting-label">{{ size.words.label }}</span>
            <AppStepper
              :model-value="size.value"
              :min="size.min"
              :max="size.max"
              :decrease-label="size.words.less"
              :increase-label="size.words.more"
              :value-label="size.words.label"
              :disabled="locked"
              tooltip
              :disabled-body="t.tooltips.frameSizeLocked"
              decrease-testid="frame-setting-less"
              increase-testid="frame-setting-more"
              value-testid="frame-setting-value"
              @update:model-value="emit('set-size', $event)"
            />
          </div>
          <p v-if="locked" class="frame-panel__line" data-testid="frame-size-locked">{{ t.frame.sizeLockedLine }}</p>
          <div v-if="estimate" class="frame-panel__estimate" data-testid="frame-estimate">
            <AppIcon name="ruler" :size="16" />
            <span class="frame-panel__estimate-label">{{ t.size.estimateLabel }}</span>
            <span class="frame-panel__estimate-value">{{ estimate }}</span>
            <IconButton variant="plain" icon="info" :icon-size="16" :label="t.size.estimateLabel" :tooltip="{ body: t.frame.estimateInfo }" data-testid="frame-estimate-info" />
          </div>
        </div>
        <div v-else class="frame-panel__body">
          <!-- Escape during an edit in a field clears it; otherwise it closes the panel (PanelHost). -->
          <!-- Once a pass is done the fields are shown but off, and a Tooltip says why and how to unblock. -->
          <component
            :is="locked ? AppTooltip : 'div'"
            v-bind="locked ? lockedTip : {}"
            class="frame-panel__size"
            :class="{ 'frame-panel__size--locked': locked }"
            :data-handles-escape="sizeEdited || undefined"
            @panel-escape="clearSize"
            @focusout="onSizeFocusOut"
          >
            <TextField
              :model-value="typedWidth"
              compact
              select-on-focus
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              autocomplete="off"
              :aria-label="t.frame.widthLabel"
              :placeholder="String(counted.columns)"
              :disabled="locked"
              class="frame-panel__field"
              data-testid="frame-panel-width"
              @update:model-value="setSize('width', String($event))"
              @input="cleanSizeInput"
              @keydown="onSizeKey"
            />
            <span class="frame-panel__times" aria-hidden="true">×</span>
            <TextField
              :model-value="typedHeight"
              compact
              select-on-focus
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              autocomplete="off"
              :aria-label="t.frame.heightLabel"
              :placeholder="String(counted.rows)"
              :disabled="locked"
              class="frame-panel__field"
              data-testid="frame-panel-height"
              @update:model-value="setSize('height', String($event))"
              @input="cleanSizeInput"
              @keydown="onSizeKey"
            />
            <span class="frame-panel__unit">{{ sizeUnit }}</span>
          </component>

          <p v-if="locked" class="frame-panel__line" data-testid="frame-size-locked">{{ t.frame.sizeLockedLine }}</p>
          <div v-else class="frame-panel__edges">
            <div v-for="cell in ordered" :key="cell.edge" class="frame-panel__cell" :data-testid="`frame-panel-cell-${cell.edge}`">
              <span class="frame-panel__glyph" :class="[`frame-panel__glyph--${cell.edge}`, { 'frame-panel__glyph--last': lastEdge === cell.edge }]" aria-hidden="true" />
              <span class="frame-panel__edge-name">{{ t.frame.edgeName[cell.edge] }}</span>
              <span class="frame-panel__pair">
                <AppButton
                  class="frame-panel__step"
                  variant="secondary"
                  :action="cell.in"
                  :deps="deps"
                  :aria-label="cell.in.name(t)"
                  :data-testid="`frame-edge-${cell.edge}-in`"
                  v-on="cell.shrink"
                >−</AppButton>
                <AppButton
                  class="frame-panel__step"
                  variant="secondary"
                  :action="cell.out"
                  :deps="deps"
                  :aria-label="cell.out.name(t)"
                  :data-testid="`frame-edge-${cell.edge}-out`"
                  v-on="cell.grow"
                >+</AppButton>
              </span>
            </div>
          </div>

          <div v-if="estimate" class="frame-panel__estimate" data-testid="frame-estimate">
            <AppIcon name="ruler" :size="16" />
            <span class="frame-panel__estimate-label">{{ t.size.estimateLabel }}</span>
            <span class="frame-panel__estimate-value">{{ estimate }}</span>
            <IconButton variant="plain" icon="info" :icon-size="16" :label="t.size.estimateLabel" :tooltip="{ body: t.frame.estimateInfo }" data-testid="frame-estimate-info" />
          </div>
          <PanelItem icon="select" :disabled="locked" :disabled-body="t.tooltips.frameSizeLocked" data-testid="frame-select" @select="emit('select-frame')">{{ t.frame.selectAFrame }}</PanelItem>
          <!-- Replace Frame (ticket 0596): the Starter gallery, its Frame put in place of this one. -->
          <PanelItem
            icon="frame"
            sub
            stays
            :disabled="locked"
            :disabled-body="t.tooltips.rowProgressLockedFrameFromStarter"
            data-testid="frame-replace-from-starter"
            @select="context?.openSub(t.starters.title, { opener: 'frame-replace-from-starter' })"
          >{{ t.frame.replaceFrame }}</PanelItem>
        </div>
      </PanelSection>
    </template>

    <template v-else>
      <div class="frame-panel__none">
        <PanelItem icon="frame" accent accent-icon sub stays data-testid="frame-from-starter" @select="context?.openSub(t.starters.title, { opener: 'frame-from-starter' })">{{ t.frame.fromStarter }}</PanelItem>
        <PanelItem icon="select" data-testid="frame-select" @select="emit('select-frame')">{{ t.frame.selectAFrame }}</PanelItem>
        <PanelItem icon="fit" stays :disabled="nothingToFit" :name="t.frame.fitAFrame" :disabled-body="t.frame.fitNothing" data-testid="frame-fit" @select="emit('fit')">{{ t.frame.fitAFrame }}</PanelItem>
        <p class="frame-panel__line" data-testid="frame-none-line">{{ t.frame.noFrameLine }}</p>
      </div>
    </template>

    <BeadQuantities v-if="frame" :project="settledProject ?? project" />
  </div>
</template>

<style scoped>
.frame-panel {
  display: flex;
  flex-direction: column;
  color: var(--ink);
}

.frame-panel__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  min-height: var(--panel-item-height);
  padding: var(--space-4) var(--space-10) 0;
}

.frame-panel__label {
  font: var(--type-label);
  color: var(--muted);
}

.frame-panel__tools {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.frame-panel__title :deep(.frame-panel__remove) {
  color: var(--danger);
}

.frame-panel__name {
  padding: var(--space-4) var(--space-10) var(--space-8);
}

.frame-panel__none {
  display: flex;
  flex-direction: column;
}

.frame-panel__setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  min-height: var(--panel-item-height);
}

.frame-panel__setting-label {
  font: var(--type-control);
}

.frame-panel__quality {
  padding: 0 var(--space-10);
}
.frame-panel__letters {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  min-height: var(--panel-item-height);
  padding: 0 var(--space-10);
}
.frame-panel__letters-label {
  font: var(--type-control);
}
.frame-panel__line {
  margin: 0;
  padding: var(--space-4) var(--space-10);
  font: var(--type-meta-small);
  color: var(--muted);
}

.frame-panel__coffee {
  color: var(--accent-strong);
  text-decoration: underline;
}

.frame-panel__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  padding: var(--space-4) var(--space-10);
}

.frame-panel__size {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  min-width: 0;
}

.frame-panel__size--locked {
  color: var(--faint);
  cursor: not-allowed;
}

.frame-panel__size :deep(.frame-panel__field) {
  flex: none;
  width: 56px;
  padding: 0 var(--space-4);
  font: var(--type-meta);
  text-align: center;
}

.frame-panel__size :deep(.frame-panel__field input) {
  text-align: center;
}

.frame-panel__times,
.frame-panel__unit {
  font: var(--type-control);
  color: var(--muted);
}

.frame-panel__edges {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4) var(--space-12);
}

/* A narrow window gives each edge a row of its own, so the longest name still fits. */
@media (max-width: 380px) {
  .frame-panel__edges {
    grid-template-columns: minmax(0, 1fr);
  }
}

.frame-panel__cell {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  min-height: var(--panel-item-height);
}

/* A square with the edge this cell moves ruled thick. */
.frame-panel__glyph {
  box-sizing: border-box;
  flex: none;
  width: 14px;
  height: 14px;
  border: 1px solid var(--muted);
  border-radius: 2px;
}

.frame-panel__glyph--top {
  border-top: 4px solid var(--ink);
}

.frame-panel__glyph--bottom {
  border-bottom: 4px solid var(--ink);
}

.frame-panel__glyph--left {
  border-left: 4px solid var(--ink);
}

.frame-panel__glyph--right {
  border-right: 4px solid var(--ink);
}

.frame-panel__glyph--last {
  border-color: var(--accent-strong);
}

.frame-panel__edge-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  font: var(--type-control);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* The − | + pair is one joined control: the halves share a border. */
.frame-panel__pair {
  display: flex;
  flex: none;
}

.frame-panel__cell :deep(.frame-panel__step) {
  width: 26px;
  min-width: 0;
  height: var(--picker-height);
  padding: 0;
  font: var(--type-control);
  line-height: 1;
  border-radius: 0;
  touch-action: manipulation;
}

.frame-panel__cell :deep(.frame-panel__step:first-child) {
  border-radius: var(--radius-sm) 0 0 var(--radius-sm);
}

.frame-panel__cell :deep(.frame-panel__step:last-child) {
  margin-left: -1px;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

.frame-panel__cell :deep(.frame-panel__step[aria-disabled='true']) {
  color: var(--faint);
  background: var(--surface);
}

@media (pointer: coarse) {
  .frame-panel__cell :deep(.frame-panel__step) {
    height: var(--picker-height-touch);
  }
}

.frame-panel__estimate {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-height: var(--panel-item-height);
  color: var(--muted);
}

.frame-panel__estimate-label {
  flex: 1 1 auto;
  min-width: 0;
  font: var(--type-control);
  color: var(--ink);
}

.frame-panel__estimate-value {
  flex: none;
  font: var(--type-meta);
  white-space: nowrap;
}

.frame-panel__loading {
  margin: var(--space-4) var(--space-10);
}
</style>
