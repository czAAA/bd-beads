<script setup lang="ts">
import { computed, ref } from 'vue'
import AppButton from '../ui/AppButton.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import IconButton from '../ui/IconButton.vue'
import TextField from '../ui/form/TextField.vue'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import { useHoldRepeat } from '../../composables/ui/useHoldRepeat'
import { FRAME_EDGES, frameWithEdgeStep, type FrameEdge } from '../../domain/frame'
import { frameWeave, rowProgressStarted, type Project } from '../../domain/project'
import { describeWeave } from '../../domain/weave'
import { useI18n } from '../../i18n/useI18n'

// The Frame panel (tickets 473, 475; Frame card): the Frame's size (a width and a height field, typeable), Rotate and Remove, and a − and + pair per
// edge. It is the content of a panel like Menu and Project (mounted by PhoneSheets in a PanelHost): from the strip's Frame button only (the edit pencil on the Frame
// shows the handles and is a separate control); a press outside or Escape closes it.
const props = defineProps<{
  project: Project
}>()

const emit = defineEmits<{
  step: [edge: FrameEdge, step: 1 | -1]
  resize: [columns: number, rows: number]
  rotate: []
  remove: []
  key: [event: KeyboardEvent]
}>()

const { t } = useI18n()
const deps = computed(() => controlDeps({ activeProject: () => props.project }))
const rotateAction = controlAction('rotate-frame')
const removeAction = controlAction('remove-frame')
const locked = computed(() => rowProgressStarted(props.project))
const frame = computed(() => props.project.frame)

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

/** The Tooltip over the off size fields. */
const lockedTip = computed(() => ({ name: t.value.frame.title, disabled: true as const, disabledBody: t.value.tooltips.frameSizeLocked, announce: false }))

// Top, Bottom, Left, Right is the cell order whatever the edges' own order is.
const ordered = (['top', 'bottom', 'left', 'right'] as const).map((edge) => cells.find((cell) => cell.edge === edge)!)
</script>

<template>
  <div class="frame-panel" role="group" :aria-label="t.frame.title" data-testid="frame-panel" @keydown="emit('key', $event)">
    <div class="frame-panel__head">
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
          <label class="frame-panel__field">
            <span class="frame-panel__label">{{ t.frame.widthLabel }}</span>
            <TextField
              :model-value="typedWidth"
              compact
              select-on-focus
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              autocomplete="off"
              :placeholder="String(counted.columns)"
              :disabled="locked"
              data-testid="frame-panel-width"
              @update:model-value="setSize('width', String($event))"
              @input="cleanSizeInput"
              @keydown="onSizeKey"
            />
          </label>
        <span class="frame-panel__times" aria-hidden="true">×</span>
          <label class="frame-panel__field">
            <span class="frame-panel__label">{{ t.frame.heightLabel }}</span>
            <TextField
              :model-value="typedHeight"
              compact
              select-on-focus
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              autocomplete="off"
              :placeholder="String(counted.rows)"
              :disabled="locked"
              data-testid="frame-panel-height"
              @update:model-value="setSize('height', String($event))"
              @input="cleanSizeInput"
              @keydown="onSizeKey"
            />
          </label>
        <span class="frame-panel__unit">{{ sizeUnit }}</span>
      </component>
      <IconButton
        v-if="!locked && turnable"
        variant="secondary"
        :icon-size="18"
        :action="rotateAction"
        :deps="deps"
        class="frame-panel__tool"
        data-testid="frame-rotate"
        @click="emit('rotate')"
      />
      <span v-if="!locked && turnable" class="frame-panel__divider" aria-hidden="true" />
      <IconButton
        variant="secondary"
        :icon-size="18"
        :action="removeAction"
        :deps="deps"
        class="frame-panel__tool frame-panel__tool--danger"
        data-testid="frame-chrome-remove"
        @click="emit('remove')"
      />
    </div>
    <div class="frame-panel__edges">
      <div v-for="cell in ordered" :key="cell.edge" class="frame-panel__cell" :class="{ 'frame-panel__cell--last': lastEdge === cell.edge }" :data-testid="`frame-panel-cell-${cell.edge}`">
        <span class="frame-panel__glyph" :class="[`frame-panel__glyph--${cell.edge}`, { 'frame-panel__glyph--last': lastEdge === cell.edge }]" aria-hidden="true" />
        <span class="frame-panel__name">{{ t.frame.edgeName[cell.edge] }}</span>
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
  </div>
</template>

<style scoped>
.frame-panel {
  display: flex;
  flex-direction: column;
  gap: var(--frame-panel-gap);
  color: var(--ink);
}

.frame-panel__head {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.frame-panel__size {
  display: flex;
  flex: 1;
  align-items: flex-end;
  gap: var(--space-4);
  min-width: 0;
}

.frame-panel__field {
  display: flex;
  flex: 1 1 5rem;
  flex-direction: column;
  max-width: 7rem;
  min-width: 0;
}

.frame-panel__label {
  font: var(--type-meta-tiny);
  color: var(--muted);
}

.frame-panel__times {
  padding-bottom: var(--space-4);
  color: var(--muted);
}

.frame-panel__size--locked {
  cursor: not-allowed;
}

.frame-panel__unit {
  padding-bottom: var(--space-4);
  color: var(--muted);
}

.frame-panel__divider {
  align-self: stretch;
  width: 1px;
  margin: 0 var(--space-4);
  background: var(--line-strong);
}

.frame-panel__head :deep(.frame-panel__tool) {
  width: var(--frame-hit);
  height: var(--frame-hit);
  border-radius: var(--radius-md);
}

.frame-panel__head :deep(.frame-panel__tool--danger) {
  color: var(--danger);
}

.frame-panel__edges {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--frame-panel-gap);
}

/* Narrow: the four cells stack two by two. */
@media (max-width: 560px) {
  .frame-panel__edges {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.frame-panel__cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-6);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
}

.frame-panel__cell--last {
  border: 2px solid var(--accent-strong);
  padding: calc(var(--space-6) - 1px);
}

/* A square with the edge this cell moves ruled thick. */
.frame-panel__glyph {
  box-sizing: border-box;
  width: 16px;
  height: 16px;
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
  border-color: var(--accent);
}

.frame-panel__name {
  font: var(--type-small);
  font-weight: 600;
}

.frame-panel__pair {
  display: flex;
  gap: var(--frame-stepper-gap);
}

.frame-panel__cell :deep(.frame-panel__step) {
  width: var(--frame-hit);
  min-width: 0;
  height: var(--frame-hit);
  padding: 0;
  font: var(--type-control);
  font-size: 1.5rem;
  line-height: 1;
  border-radius: var(--radius-md);
  touch-action: manipulation;
}

.frame-panel__cell :deep(.frame-panel__step[aria-disabled='true']) {
  color: var(--faint);
  background: var(--surface);
}
</style>
