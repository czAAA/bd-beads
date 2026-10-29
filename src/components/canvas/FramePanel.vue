<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import BeadQuantities from '../palette/BeadQuantities.vue'
import EditableLine from '../project/EditableLine.vue'
import ExportSection from './ExportSection.vue'
import MarginSection from './MarginSection.vue'
import PanelItem from '../shell/PanelItem.vue'
import PanelSection from '../shell/PanelSection.vue'
import { PANEL_CONTEXT } from '../shell/panelContext'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import AppSwitch from '../ui/AppSwitch.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import IconButton from '../ui/IconButton.vue'
import InfoButton from '../ui/InfoButton.vue'
import TextField from '../ui/form/TextField.vue'
import AppStepper from '../ui/form/AppStepper.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import { useHoldRepeat } from '../../composables/ui/useHoldRepeat'
import { FRAME_EDGES, fitToDrawing, frameWithEdgeStep, type FrameEdge } from '../../domain/frame'
import { seenSize } from '../../domain/frameOrientation'
import { FRINGE_STYLES, frameAllows, fringeStyleOf, settingValuesOf, type FrameSettings, type FringeStyle } from '../../domain/frameShape'
import { MAX_PIECE_NAME } from '../../domain/pieceNames'
import { frameOf, layerOf, lettersOn } from '../../domain/layerRecord'
import { rowProgressStarted } from '../../domain/rowProgress'
import type { Project } from '../../domain/project'
import { estimatedSizeMm, formatSizeMm } from '../../domain/projectSize'
import { plural } from '../../i18n/plural'
import { useI18n } from '../../i18n/useI18n'
import { frameWeave } from '../../domain/layerWeave'

// The Frame panel (tickets 473, 475, 555, 568; Frame card): title with Rotate and Remove, Export (off with no Frame), the
// name, size, Beads needed and the margin (ticket 0656); with no Frame, Frame from starter, Select a frame and Fit. A panel like Menu and Project
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
  'set-settings': [change: FrameSettings]
}>()

const { t, locale } = useI18n()
const context = inject(PANEL_CONTEXT, undefined)
const deps = computed(() => controlDeps({ activeProject: () => props.project }))
const rotateAction = controlAction('rotate-frame')
const removeAction = controlAction('remove-frame')
const locked = computed(() => rowProgressStarted(props.project))
const frame = computed(() => frameOf(props.project))
/** A Frame without a shape lying turned (ticket 0667) keeps its size until it is turned upright: its fields show it as seen, off. */
const turned = computed(() => !!frame.value && !frameAllows(frame.value, 'resize') && !locked.value)
/** Whether the size fields are off, and why: finished rows, or a turned Frame. */
const sizeHeld = computed(() => locked.value || turned.value)

/** A Custom frame's settings in place of Width and Height (tickets 0592, 0593, 0597), each its value, its range now and
 * its words: Rounds, Part size or Rows, or a Fringe earring's Top width, Top rows and Fringe length; none for a
 * Frame without a Frame shape. */
const settings = computed(() => (frame.value ? settingValuesOf(frame.value).map((setting) => ({ ...setting, words: t.value.frame.sizeSettings[setting.name] })) : []))
/** A Fringe earring's Fringe style and its options, the setup's names (ticket 0597); none for any other Frame. */
const fringeStyle = computed(() => frame.value && fringeStyleOf(frame.value))
const fringeOptions = computed(() => FRINGE_STYLES.map((value) => ({ value, label: t.value.starters.picks.fringeStyle.options[value] })))
/** Whether the Frame can be turned a quarter: it allows it (a Custom frame too, ticket 0594). */
const rotatable = computed(() => frameAllows(frame.value, 'rotate'))

/** The edge the last press stepped, lit in its cell. */
const lastEdge = ref<FrameEdge>()

const cells = FRAME_EDGES.map((edge) => {
  const hold = useHoldRepeat((direction) => {
    const current = frame.value
    if (!current || sizeHeld.value || frameWithEdgeStep(frameWeave(props.project), current, edge, direction) === current) return false
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
const counted = computed(() => (frame.value ? seenSize(frame.value) : { columns: 0, rows: 0 }))
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
  const bead = layerOf(props.project, 'frame')?.bead
  return bead && frame.value ? `≈ ${formatSizeMm(estimatedSizeMm(frame.value, bead), { mm: t.value.form.unitMm, cm: t.value.form.unitCm }, locale.value)}` : ''
})
const sizeSummary = computed(() =>
  [settings.value[0] ? plural(locale.value, settings.value[0].value, settings.value[0].words.summary) : `${counted.value.columns} × ${counted.value.rows}`, estimate.value].filter(Boolean).join(' · '),
)
/** Fit a frame to the drawing needs something drawn. */
const nothingToFit = computed(() => fitToDrawing(props.project) === undefined)
/** The Tooltip over the off size fields. */
const lockedTip = computed(() => ({ name: t.value.frame.title, disabled: true as const, disabledBody: turned.value ? t.value.tooltips.frameSizeTurned : t.value.tooltips.frameSizeLocked, announce: false }))

// Top, Bottom, Left, Right is the cell order whatever the edges' own order is.
const ordered = (['top', 'bottom', 'left', 'right'] as const).map((edge) => cells.find((cell) => cell.edge === edge)!)
</script>

<template>
  <div class="frame-panel" role="group" :aria-label="t.frame.title" data-testid="frame-panel" @keydown="emit('key', $event)">
    <div class="frame-panel__title">
      <span class="frame-panel__label">{{ t.frame.titleLabel }}</span>
      <span v-if="frame" class="frame-panel__tools">
        <IconButton
          v-if="rotatable"
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

    <!-- With no Frame, the ways to get one come first (ticket 0650), above Export. -->
    <div v-if="!frame" class="frame-panel__none">
      <p class="frame-panel__line" data-testid="export-needs-frame">{{ t.frame.exportNeedsFrame }}</p>
      <PanelItem icon="frame" accent accent-icon sub stays data-testid="frame-from-starter" @select="context?.openSub(t.starters.title, { opener: 'frame-from-starter' })">{{ t.frame.fromStarter }}</PanelItem>
      <PanelItem icon="select" data-testid="frame-select" @select="emit('select-frame')">{{ t.frame.selectAFrame }}</PanelItem>
      <PanelItem icon="fit" stays :disabled="nothingToFit" :name="t.frame.fitAFrame" :disabled-body="t.frame.fitNothing" data-testid="frame-fit" @select="emit('fit')">{{ t.frame.fitAFrame }}</PanelItem>
      <p class="frame-panel__line" data-testid="frame-none-line">{{ t.frame.noFrameLine }}</p>
    </div>

    <!-- Export always shown (ticket 568), off with no Frame. -->
    <PanelSection id="frame:export" :label="t.panels.project.exportHeading">
      <ExportSection :project="project" :exporting="exporting" @export-png="emit('export-png')" @export-pdf="emit('export-pdf')">
        <!-- Letters (ticket 0573): the Swatch letter on the Frame's beads, the PNG and the PDF; saved with the Project. -->
        <template v-if="frame">
          <div class="frame-panel__letters">
            <span class="frame-panel__letters-label">
              {{ t.frame.lettersLabel }}
              <InfoButton :label="t.frame.lettersInfoLabel" :body="t.frame.lettersLine" data-testid="frame-letters-info" />
            </span>
            <AppSwitch :model-value="lettersOn(project)" :label="t.frame.lettersLabel" data-testid="frame-letters" @update:model-value="emit('set-letters', $event)" />
          </div>
        </template>
      </ExportSection>
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
        <!-- A Custom frame is sized by its settings (tickets 0592, 0593, 0597): growing adds empty rounds, rows or
             beads outside, shrinking folds what it leaves out (ticket 0640). -->
        <div v-if="settings.length" class="frame-panel__body">
          <div v-for="setting in settings" :key="setting.name" class="frame-panel__setting" :data-testid="`frame-setting-${setting.name}`">
            <span class="frame-panel__setting-label">{{ setting.words.label }}</span>
            <AppStepper
              :model-value="setting.value"
              :min="setting.min"
              :max="setting.max"
              :decrease-label="setting.words.less"
              :increase-label="setting.words.more"
              :value-label="setting.words.label"
              :disabled="locked"
              tooltip
              :disabled-body="t.tooltips.frameSizeLocked"
              :decrease-testid="`frame-setting-${setting.name}-less`"
              :increase-testid="`frame-setting-${setting.name}-more`"
              :value-testid="`frame-setting-${setting.name}-value`"
              @update:model-value="emit('set-settings', { [setting.name]: $event })"
            />
          </div>
          <div v-if="fringeStyle" class="frame-panel__style">
            <span id="frame-fringe-style-label" class="frame-panel__setting-label">{{ t.frame.fringeStyle.label }}</span>
            <SegmentedControl
              :model-value="fringeStyle"
              :options="fringeOptions"
              labelledby="frame-fringe-style-label"
              :disabled="locked"
              data-testid="frame-fringe-style"
              @update:model-value="emit('set-settings', { fringeStyle: $event as FringeStyle })"
            />
          </div>
          <p v-if="locked" class="frame-panel__line" data-testid="frame-size-locked">{{ t.frame.sizeLockedLine }}</p>
          <div v-if="estimate" class="frame-panel__estimate" data-testid="frame-estimate">
            <AppIcon name="ruler" :size="16" />
            <span class="frame-panel__estimate-label">{{ t.size.estimateLabel }}</span>
            <span class="frame-panel__estimate-value">{{ estimate }}</span>
            <InfoButton :label="t.size.estimateLabel" :body="t.frame.estimateInfo" data-testid="frame-estimate-info" />
          </div>
        </div>
        <div v-else class="frame-panel__body">
          <!-- Escape during an edit in a field clears it; otherwise it closes the panel (PanelHost). -->
          <!-- Once a pass is done, or while the Frame lies turned, the fields are shown but off, and a Tooltip says why and how to unblock. -->
          <component
            :is="sizeHeld ? AppTooltip : 'div'"
            v-bind="sizeHeld ? lockedTip : {}"
            class="frame-panel__size"
            :class="{ 'frame-panel__size--locked': sizeHeld }"
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
              :disabled="sizeHeld"
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
              :disabled="sizeHeld"
              class="frame-panel__field"
              data-testid="frame-panel-height"
              @update:model-value="setSize('height', String($event))"
              @input="cleanSizeInput"
              @keydown="onSizeKey"
            />
            <span class="frame-panel__unit">{{ t.frame.sizeUnit }}</span>
          </component>

          <p v-if="locked" class="frame-panel__line" data-testid="frame-size-locked">{{ t.frame.sizeLockedLine }}</p>
          <p v-else-if="turned" class="frame-panel__line" data-testid="frame-size-turned">{{ t.frame.sizeTurnedLine }}</p>
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
            <InfoButton :label="t.size.estimateLabel" :body="t.frame.estimateInfo" data-testid="frame-estimate-info" />
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

    <BeadQuantities v-if="frame" :project="settledProject ?? project" />
    <MarginSection v-if="frame" />
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

.frame-panel__style {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
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
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
  font: var(--type-control);
}
.frame-panel__line {
  margin: 0;
  padding: var(--space-4) var(--space-10);
  font: var(--type-meta-small);
  color: var(--muted);
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
</style>
