<script setup lang="ts">
import { computed, reactive, ref, useId } from 'vue'
import MarkedDoneLine from '../project/MarkedDoneLine.vue'
import FrameShapeSettings from './FrameShapeSettings.vue'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import InfoButton from '../ui/InfoButton.vue'
import TextField from '../ui/form/TextField.vue'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import { useHoldRepeat } from '../../composables/ui/useHoldRepeat'
import { useLabelsThatFit } from '../../composables/ui/useLabelsThatFit'
import { FEWEST_SIDE, FRAME_EDGES, MAX_TYPED_SIDE, frameWithEdgeStep, type FrameEdge } from '../../domain/frame'
import { fillBlanks } from '../../domain/fillBlanks'
import { ownEdge, seenSize } from '../../domain/frameOrientation'
import { settingValuesOf, type FrameSettings } from '../../domain/frameShape'
import type { FrameId } from '../../domain/grid'
import { frameById, layerOf } from '../../domain/layerRecord'
import { rowProgressStarted } from '../../domain/rowProgress'
import type { Project } from '../../domain/project'
import { estimatedSizeMm, formatSizeMm } from '../../domain/projectSize'
import { useI18n } from '../../i18n/useI18n'
import { frameWeave } from '../../domain/layerWeave'

// A Frame's size, in its settings popover (tickets 473, 0854, 0978, 1016, 1222; MarginSheet card): Width and Height and
// the four edge steppers, the edges named as the Frame lies on screen (a Frame turned by Rotate Frame has its own edges
// swapped), the Estimated size, and, while a row is marked done, the line saying why they are off. It only asks.
const props = defineProps<{
  project: Project
  /** The Frame whose size it is. */
  frame: FrameId
}>()

const emit = defineEmits<{
  step: [edge: FrameEdge, step: 1 | -1]
  resize: [columns: number, rows: number]
  /** A Custom frame's shape setting (tickets 0592, 0640, 1222). */
  'set-settings': [change: FrameSettings]
  /** Reset progress, from the line under a size that rows marked done hold (ticket 0848); the caller asks. */
  'reset-progress': []
}>()

const { t, locale } = useI18n()
const deps = computed(() => controlDeps({ activeProject: () => props.project, frame: () => props.frame }))
const locked = computed(() => rowProgressStarted(props.project, props.frame))
const frame = computed(() => frameById(props.project, props.frame))
/** Whether the size fields are off: finished rows. A turned Frame is sized as seen (ticket 1016). */
const sizeHeld = computed(() => locked.value)
/** A Custom frame is sized by its shape's settings in place of Width, Height and the edges (ticket 0670). */
const custom = computed(() => !!frame.value && settingValuesOf(frame.value).length > 0)

/** The edge the last press stepped, lit in its cell. */
const lastEdge = ref<FrameEdge>()

const cells = FRAME_EDGES.map((edge) => {
  const hold = useHoldRepeat((direction) => {
    const current = frame.value
    if (!current || sizeHeld.value || frameWithEdgeStep(frameWeave(props.project, props.frame), current, ownEdge(current, edge), direction) === current) return false
    lastEdge.value = edge
    emit('step', edge, direction)
    return true
  })
  return { edge, out: controlAction(`frame-edge-${edge}-out`), in: controlAction(`frame-edge-${edge}-in`), shrink: hold.handlers(-1), grow: hold.handlers(1) }
})

/** The width and height fields hold the Frame's size as values, selected on focus so typing replaces it (ticket 0854);
 * what is typed (`null` while untouched) stands in for it. They take whole numbers (ticket 0978); Enter or leaving both takes
 * them, an empty one keeps its side (its placeholder still reads the size), Escape puts the size back. */
type SizeSide = 'width' | 'height'
const typedWidth = ref<string | null>(null)
const typedHeight = ref<string | null>(null)
const sizeEdited = computed(() => typedWidth.value !== null || typedHeight.value !== null)
const counted = computed(() => (frame.value ? seenSize(frame.value) : { columns: 0, rows: 0 }))
const shownWidth = computed(() => typedWidth.value ?? String(counted.value.columns))
const shownHeight = computed(() => typedHeight.value ?? String(counted.value.rows))

/** A side's range line (ticket 0978) under the fields, shown when a key is refused or a typed number brought into range,
 * gone with that side's next valid entry: the field's error (forms-and-states), its count its key, so a refusal that comes
 * again puts it in afresh and a screen reader reads it again (ticket 0995). 0 is no line. */
const refusals = reactive<Record<SizeSide, number>>({ width: 0, height: 0 })
const rangeIds = { width: useId(), height: useId() }
const rangeLines = computed(() => ({
  width: fillBlanks(t.value.frame.widthRange, { min: FEWEST_SIDE, max: MAX_TYPED_SIDE }),
  height: fillBlanks(t.value.frame.heightRange, { min: FEWEST_SIDE, max: MAX_TYPED_SIDE }),
}))
const refuse = (side: SizeSide): void => void refusals[side]++
const inRange = (number: number): boolean => number >= FEWEST_SIDE && number <= MAX_TYPED_SIDE
/** After a refused "." or ",", the digits typed straight after it are its fraction, refused too, so "12.5" is 12, never
 * 125; a caret moved, a deletion or a press ends it. */
const afterPoint = ref<SizeSide | null>(null)

function clearSize(): void {
  typedWidth.value = null
  typedHeight.value = null
  afterPoint.value = null
}
/** Escape puts the size back, and its range line goes with it. */
function putSizeBack(): void {
  clearSize()
  refusals.width = refusals.height = 0
}
function commitSize(): void {
  const [typedColumns, typedRows] = [Number(typedWidth.value ?? ''), Number(typedHeight.value ?? '')]
  if (typedColumns && !inRange(typedColumns)) refuse('width')
  if (typedRows && !inRange(typedRows)) refuse('height')
  const columns = typedColumns || counted.value.columns
  const rows = typedRows || counted.value.rows
  // The size it already has is no step: re-centring it would shift a Frame whose rows alternate by a pair.
  if (sizeEdited.value && columns && rows && (columns !== counted.value.columns || rows !== counted.value.rows)) emit('resize', columns, rows)
  clearSize()
}
const MAX_DIGITS = String(MAX_TYPED_SIDE).length
/** Keeps the whole number, as typed or pasted: digits only, up to a "." or "," (a pasted "12.5" is 12), no leading zero. */
const onlyDigits = (text: string): string =>
  text
    .split(/[.,]/)[0]!
    .replace(/\D/g, '')
    .replace(/^0+/, '')
    .slice(0, MAX_DIGITS)
function setSize(side: SizeSide, text: string): void {
  const kept = onlyDigits(text)
  if (side === 'width') typedWidth.value = kept
  else typedHeight.value = kept
  if (kept !== text) refuse(side)
  else if (inRange(Number(kept))) refusals[side] = 0
}
/** A refused character leaves the state as it was, so the field is put back to the state by hand. */
function cleanSizeInput(event: Event): void {
  const input = event.target as HTMLInputElement
  input.value = onlyDigits(input.value)
}
/** Refuses at the key what a size can't hold (ticket 0978): ".", ",", "-", a letter, a digit past three or a fraction's
 * digit, saying the range. A paste, whose text comes with the input event, is cleaned there. */
function onSizeBeforeInput(event: InputEvent, side: SizeSide): void {
  const text = event.data
  if (!event.inputType.startsWith('insert') || text === null) return
  const input = event.target as HTMLInputElement
  const left = input.value.length - ((input.selectionEnd ?? 0) - (input.selectionStart ?? 0))
  if (/^\d+$/.test(text) && afterPoint.value !== side && left + text.length <= MAX_DIGITS) return
  if (/[.,]/.test(text)) afterPoint.value = side
  event.preventDefault()
  refuse(side)
}
/** The keys that move the caret or delete, which end a refused point's fraction (a phone's "Unidentified" key does not). */
const CARET_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Backspace', 'Delete', 'Tab'])
function onSizeKey(event: KeyboardEvent): void {
  event.stopPropagation()
  if (event.key === 'Enter') commitSize()
  else if (CARET_KEYS.has(event.key)) afterPoint.value = null
}
/** Focus moving from one field to the other is no end of editing. */
function onSizeFocusOut(event: FocusEvent): void {
  if (!(event.relatedTarget instanceof Node && (event.currentTarget as HTMLElement).contains(event.relatedTarget))) commitSize()
}

/** The Estimated size as "≈ 3.8 × 3.9 cm" (the Bead's size × beads across and down), in the unit the margin's title
 * block gives the same size (cm from 10 mm up, ticket 0992), or nothing for an unknown Bead. */
const estimate = computed(() => {
  const bead = layerOf(props.project, props.frame)?.bead
  const units = { mm: t.value.form.unitMm, cm: t.value.form.unitCm }
  return bead && frame.value ? `≈ ${formatSizeMm(estimatedSizeMm(frame.value, bead, frame.value.technique), units, locale.value)}` : ''
})
/** The Tooltip over the off size fields. */
const lockedTip = computed(() => ({ name: t.value.frame.title, disabled: true as const, disabledBody: t.value.tooltips.frameSizeLocked, announce: false }))

// Top, Bottom, Left, Right is the cell order whatever the edges' own order is.
const ordered = (['top', 'bottom', 'left', 'right'] as const).map((edge) => cells.find((cell) => cell.edge === edge)!)
/** The edges whose name has no room in its cell (ticket 0864): the cell keeps its glyph, which then holds the name in
 * its Tooltip, on hover or a tap. */
const edgesEl = ref<HTMLElement>()
const edgeNameCut = useLabelsThatFit(edgesEl, () => t.value.frame.edgeName)
</script>


<template>
  <div class="frame-size" role="group" :aria-label="t.frame.sizeHeading" data-testid="frame-size">
    <!-- A Custom frame is sized by its shape's settings (ticket 0670). -->
    <FrameShapeSettings v-if="custom && frame" :frame="frame" :locked="locked" @set-settings="emit('set-settings', $event)" @reset-progress="emit('reset-progress')" />
    <template v-else>
          <component
            :is="sizeHeld ? AppTooltip : 'div'"
            v-bind="sizeHeld ? lockedTip : {}"
            class="frame-size__size"
            :class="{ 'frame-size__size--locked': sizeHeld }"
            :data-handles-escape="sizeEdited || undefined"
            @panel-escape="putSizeBack"
            @focusout="onSizeFocusOut"
          >
            <TextField
              :model-value="shownWidth"
              compact
              select-on-focus
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              autocomplete="off"
              :aria-label="t.frame.widthLabel"
              :placeholder="String(counted.columns)"
              :disabled="sizeHeld"
              class="frame-size__field"
              :invalid="refusals.width > 0"
              :aria-describedby="refusals.width ? rangeIds.width : undefined"
              data-testid="frame-size-width"
              @update:model-value="setSize('width', String($event))"
              @beforeinput="onSizeBeforeInput($event, 'width')"
              @input="cleanSizeInput"
              @keydown="onSizeKey"
              @pointerdown="afterPoint = null"
            />
            <span class="frame-size__times" aria-hidden="true">×</span>
            <TextField
              :model-value="shownHeight"
              compact
              select-on-focus
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              autocomplete="off"
              :aria-label="t.frame.heightLabel"
              :placeholder="String(counted.rows)"
              :disabled="sizeHeld"
              class="frame-size__field"
              :invalid="refusals.height > 0"
              :aria-describedby="refusals.height ? rangeIds.height : undefined"
              data-testid="frame-size-height"
              @update:model-value="setSize('height', String($event))"
              @beforeinput="onSizeBeforeInput($event, 'height')"
              @input="cleanSizeInput"
              @keydown="onSizeKey"
              @pointerdown="afterPoint = null"
            />
            <span class="frame-size__unit">{{ t.frame.sizeUnit }}</span>
          </component>
          <template v-for="side in (['width', 'height'] as const)" :key="side">
            <p v-if="refusals[side]" :id="rangeIds[side]" :key="refusals[side]" class="frame-size__range" role="alert" :data-testid="`frame-${side}-range`">
              <AppIcon name="warning" :size="14" />
              <span>{{ rangeLines[side] }}</span>
            </p>
          </template>

          <MarkedDoneLine v-if="locked" class="frame-size__line" testid="frame-size-locked" @reset-progress="emit('reset-progress')" />
          <div v-else ref="edgesEl" class="frame-size__edges">
            <div v-for="cell in ordered" :key="cell.edge" class="frame-size__cell" :data-testid="`frame-size-cell-${cell.edge}`">
              <component
                :is="edgeNameCut[cell.edge] ? AppTooltip : 'span'"
                class="frame-size__glyph-hold"
                v-bind="edgeNameCut[cell.edge] ? { name: t.frame.edgeName[cell.edge], opensOnClick: true, announce: false } : {}"
                :data-testid="`frame-edge-${cell.edge}-glyph`"
              >
                <span class="frame-size__glyph" :class="[`frame-size__glyph--${cell.edge}`, { 'frame-size__glyph--last': lastEdge === cell.edge }]" aria-hidden="true" />
              </component>
              <span class="frame-size__edge-name" :class="{ 'frame-size__edge-name--cut': edgeNameCut[cell.edge] }" :data-fit-label="cell.edge">{{ t.frame.edgeName[cell.edge] }}</span>
              <span class="frame-size__pair">
                <AppButton
                  class="frame-size__step frame-size__step--in"
                  variant="secondary"
                  :action="cell.in"
                  :deps="deps"
                  :aria-label="cell.in.name(t)"
                  :data-testid="`frame-edge-${cell.edge}-in`"
                  v-on="cell.shrink"
                >−</AppButton>
                <AppButton
                  class="frame-size__step frame-size__step--out"
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


    </template>
    <div v-if="estimate" class="frame-size__estimate" data-testid="frame-estimate">
      <AppIcon name="ruler" :size="16" />
      <span class="frame-size__estimate-label">{{ t.size.estimateLabel }}</span>
      <span class="frame-size__estimate-value">{{ estimate }}</span>
      <InfoButton :label="t.size.estimateLabel" :body="t.frame.estimateInfo" data-testid="frame-estimate-info" />
    </div>
  </div>
</template>

<style scoped>
.frame-size {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  color: var(--ink);
}

.frame-size__size {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  min-width: 0;
}

/* A side's range under the fields (ticket 0978): the TextField card's error line. */
.frame-size__range {
  display: flex;
  gap: var(--space-6);
  align-items: center;
  margin: 0;
  font: var(--type-meta);
  font-family: var(--font-sans);
  color: var(--danger);
}

.frame-size__size--locked {
  color: var(--faint);
  cursor: not-allowed;
}

.frame-size__size :deep(.frame-size__field) {
  flex: none;
  width: 56px;
  padding: 0 var(--space-4);
  font: var(--type-meta);
  text-align: center;
}

.frame-size__size :deep(.frame-size__field input) {
  text-align: center;
}

.frame-size__times,
.frame-size__unit {
  font: var(--type-control);
  color: var(--muted);
}

.frame-size__edges {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4) var(--space-12);
}

/* A narrow window gives each edge a row of its own, so the longest name still fits. */
@media (max-width: 380px) {
  .frame-size__edges {
    grid-template-columns: minmax(0, 1fr);
  }
}

.frame-size__cell {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  min-height: var(--panel-item-height);
}

/* A square with the edge this cell moves ruled thick. */
.frame-size__glyph {
  box-sizing: border-box;
  flex: none;
  width: 14px;
  height: 14px;
  border: 1px solid var(--muted);
  border-radius: var(--radius-2xs);
}

.frame-size__glyph--top {
  border-top: 4px solid var(--ink);
}

.frame-size__glyph--bottom {
  border-bottom: 4px solid var(--ink);
}

.frame-size__glyph--left {
  border-left: 4px solid var(--ink);
}

.frame-size__glyph--right {
  border-right: 4px solid var(--ink);
}

.frame-size__glyph--last {
  border-color: var(--accent-strong);
}

.frame-size__glyph-hold {
  display: flex;
  flex: none;
  align-self: stretch;
  align-items: center;
}

/* Never cut short: with no room the name leaves the row (still laid out, to be measured) for the glyph's Tooltip. */
.frame-size__edge-name {
  flex: 1 1 auto;
  min-width: 0;
  font: var(--type-control);
  white-space: nowrap;
}

.frame-size__edge-name--cut {
  position: absolute;
  width: 0;
  overflow: hidden;
  visibility: hidden;
}

/* The − | + pair is one joined control (Stepper card): the halves share a square seam, the outer ends take the buttons'
 * `radius-md`. Each half is shaped by its own class, as each button sits in its own Tooltip wrapper (ticket 0878). */
.frame-size__pair {
  display: flex;
  flex: none;
  margin-left: auto;
}

.frame-size__cell :deep(.frame-size__step) {
  width: 26px;
  min-width: 0;
  height: var(--picker-height);
  padding: 0;
  font: var(--type-control);
  line-height: 1;
}

.frame-size__cell :deep(.frame-size__step--in) {
  border-radius: var(--radius-md) 0 0 var(--radius-md);
}

.frame-size__cell :deep(.frame-size__step--out) {
  margin-left: -1px;
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
}

.frame-size__cell :deep(.frame-size__step[aria-disabled='true']) {
  color: var(--faint);
  background: var(--surface);
}

/* Touch (ticket 0933): each half is `touch-target` wide and its hit area is its own box, as tall as the row, so neither
 * half's pad lies over the other's drawing (the 44px pad of controls.css, centred, made + take the middle of −). */
@media (pointer: coarse) {
  .frame-size__cell :deep(.frame-size__step) {
    width: var(--touch-target);
    height: var(--picker-height-touch);
  }

  .frame-size__cell :deep(.frame-size__step::before) {
    width: 100%;
    height: var(--panel-item-height, 100%);
  }
}

.frame-size__estimate {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-4);
  min-height: var(--panel-item-height);
  color: var(--muted);
}

.frame-size__estimate-label {
  flex: 1 1 auto;
  min-width: 0;
  font: var(--type-control);
  color: var(--ink);
}

.frame-size__estimate-value {
  flex: none;
  font: var(--type-meta);
  white-space: nowrap;
}
</style>
