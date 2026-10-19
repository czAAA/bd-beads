<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import AppButton from '../ui/AppButton.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import IconButton from '../ui/IconButton.vue'
import PanelHost from '../shell/PanelHost.vue'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'
import { useElementSize } from '../../composables/ui/useElementSize'
import { useHoldRepeat } from '../../composables/ui/useHoldRepeat'
import { FRAME_EDGES, frameWithEdgeStep, type FrameEdge } from '../../domain/frame'
import { frameWeave, rowProgressStarted, type Project } from '../../domain/project'
import { describeWeave } from '../../domain/weave'
import { carriedFrameBarSpot, frameBarSpot, type BarBox, type FrameAnchor } from '../../composables/tools/selectionBarPlacement'
import { useI18n } from '../../i18n/useI18n'

// The Frame bar (tickets 473, 475; Frame card): the Frame's size (a width and a height field, typeable), Rotate and Remove, and a − and + pair per
// edge. It is a panel like Menu and Project (PanelHost): from the strip's Frame button, or from the edit pencil that
// opened it, which it follows; a press outside or Escape closes it, a Frame handle's press does not.
const props = defineProps<{
  project: Project
  /** Where the Frame is on the canvas box: the bar is placed beside it once (ticket 500) and then follows the view only. */
  anchor?: FrameAnchor
  /** Whether the edit pencil opened the bar: it is then a dropdown at every width, not the Top sheet. */
  fromPencil?: boolean
  /** Whether a press outside grabs the Frame on the canvas (a resize handle), so the bar stays. */
  grabsFrame?: (event: PointerEvent) => boolean
}>()

const emit = defineEmits<{
  step: [edge: FrameEdge, step: 1 | -1]
  resize: [columns: number, rows: number]
  rotate: []
  remove: []
  key: [event: KeyboardEvent]
  close: []
  /** The bar's rectangle in the drawing area's pixels, or none once it is gone: what the Move handle keeps clear of. */
  rect: [rect: BarBox | undefined]
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
const barEl = ref<HTMLElement>()
const size = useElementSize(barEl)
const shell = ref<InstanceType<typeof PanelHost>>()
const wide = useMediaQuery('(min-width: 1024px)')
/** Where the bar hangs when the Frame is not known: under the edit pencil at every width, else the descriptor's strip button. */
const placement = computed(() => (props.fromPencil ? { anchor: 'frame-edit-toggle', align: 'end' as const, dropdown: true } : undefined))

// Ticket 500: with the Frame known, the bar is placed once beside it (below, above, right, left), then only pan and zoom
// carry it. Stepping or resizing the Frame leaves it where it is. The Top sheet under 1024px is not placed.
const positioned = !!props.anchor && (wide.value || !!props.fromPencil)
const barSize = ref<{ width: number; height: number }>()
const placed = ref<{ left: number; top: number; origin?: BarBox }>()
/** The bar's spot in the page's pixels, none until it is measured. */
const at = computed(() => {
  const view = props.anchor
  const area = document.querySelector('[data-testid="app-drawing-area"]')?.getBoundingClientRect()
  if (!placed.value || !barSize.value || !view || !area) return null
  const { origin } = placed.value
  const spot = origin && view.origin ? carriedFrameBarSpot(placed.value, origin, view.origin, barSize.value, view.viewport) : placed.value
  return { left: area.left + spot.left, top: area.top + spot.top }
})

/** A press on the Move handle or the pencil, or one that grabs a resize handle, works the Frame: the bar stays. */
function keepsPress(event: PointerEvent): boolean {
  const onChrome = event.target instanceof Element && event.target.closest('[data-testid="frame-chrome"]') !== null
  return onChrome || (props.grabsFrame?.(event) ?? false)
}

/** The panel's rectangle in the drawing area's pixels. */
function measure(): BarBox | undefined {
  const bar = shell.value?.el?.getBoundingClientRect()
  const area = document.querySelector('[data-testid="app-drawing-area"]')?.getBoundingClientRect()
  return bar && area && bar.width > 0 ? { left: bar.left - area.left, top: bar.top - area.top, width: bar.width, height: bar.height } : undefined
}
// The shell sets its box after mount and on every move, so it is measured once the box has reached the page.
watch(
  [size.width, size.height, () => shell.value?.box],
  () =>
    void nextTick(() => {
      const rect = measure()
      if (rect && !barSize.value) barSize.value = { width: rect.width, height: rect.height }
      if (rect && positioned && !placed.value && props.anchor) placed.value = { ...frameBarSpot(props.anchor.box, rect, props.anchor.viewport), origin: props.anchor.origin }
      emit('rect', rect)
    }),
  { immediate: true, flush: 'post' },
)
onBeforeUnmount(() => emit('rect', undefined))

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
function onSizeInput(event: Event, side: 'width' | 'height'): void {
  const input = event.target as HTMLInputElement
  const digits = input.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 3)
  input.value = digits
  if (side === 'width') typedWidth.value = digits
  else typedHeight.value = digits
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
  <PanelHost
    ref="shell"
    open="frame"
    :only="['frame']"
    :placement="placement"
    :at="positioned ? at : undefined"
    width="min(calc(100vw - 2 * var(--frame-bar-gap)), var(--frame-bar-width))"
    :keeps-press="keepsPress"
    @close="emit('close')"
  >
    <div ref="barEl" class="frame-bar" role="group" :aria-label="t.frame.title" data-testid="frame-bar" @keydown="emit('key', $event)">
      <div class="frame-bar__head">
        <!-- Escape during an edit in a field clears it; otherwise it closes the panel (PanelHost). -->
        <!-- Once a pass is done the fields are shown but off, and a Tooltip says why and how to unblock. -->
        <component
          :is="locked ? AppTooltip : 'div'"
          v-bind="locked ? lockedTip : {}"
          class="frame-bar__size"
          :class="{ 'frame-bar__size--locked': locked }"
          :data-handles-escape="sizeEdited || undefined"
          @panel-escape="clearSize"
          @focusout="onSizeFocusOut"
        >
            <label class="frame-bar__field">
              <span class="frame-bar__label">{{ t.frame.widthLabel }}</span>
              <input
                :value="typedWidth"
                class="frame-bar__input"
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                autocomplete="off"
                :placeholder="String(counted.columns)"
                :disabled="locked"
                data-testid="frame-bar-width"
                @input="onSizeInput($event, 'width')"
                @keydown="onSizeKey"
                @focus="($event.target as HTMLInputElement).select()"
              />
            </label>
          <span class="frame-bar__times" aria-hidden="true">×</span>
            <label class="frame-bar__field">
              <span class="frame-bar__label">{{ t.frame.heightLabel }}</span>
              <input
                :value="typedHeight"
                class="frame-bar__input"
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                autocomplete="off"
                :placeholder="String(counted.rows)"
                :disabled="locked"
                data-testid="frame-bar-height"
                @input="onSizeInput($event, 'height')"
                @keydown="onSizeKey"
                @focus="($event.target as HTMLInputElement).select()"
              />
            </label>
          <span class="frame-bar__unit">{{ sizeUnit }}</span>
        </component>
        <IconButton
          v-if="!locked && turnable"
          variant="secondary"
          :icon-size="18"
          :action="rotateAction"
          :deps="deps"
          class="frame-bar__tool"
          data-testid="frame-rotate"
          @click="emit('rotate')"
        />
        <span v-if="!locked && turnable" class="frame-bar__divider" aria-hidden="true" />
        <IconButton
          variant="secondary"
          :icon-size="18"
          :action="removeAction"
          :deps="deps"
          class="frame-bar__tool frame-bar__tool--danger"
          data-testid="frame-chrome-remove"
          @click="emit('remove')"
        />
      </div>
      <div class="frame-bar__edges">
        <div v-for="cell in ordered" :key="cell.edge" class="frame-bar__cell" :class="{ 'frame-bar__cell--last': lastEdge === cell.edge }" :data-testid="`frame-bar-cell-${cell.edge}`">
          <span class="frame-bar__glyph" :class="[`frame-bar__glyph--${cell.edge}`, { 'frame-bar__glyph--last': lastEdge === cell.edge }]" aria-hidden="true" />
          <span class="frame-bar__name">{{ t.frame.edgeName[cell.edge] }}</span>
          <span class="frame-bar__pair">
            <AppButton
              class="frame-bar__step"
              variant="secondary"
              :action="cell.in"
              :deps="deps"
              :aria-label="cell.in.name(t)"
              :data-testid="`frame-edge-${cell.edge}-in`"
              v-on="cell.shrink"
            >−</AppButton>
            <AppButton
              class="frame-bar__step"
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
  </PanelHost>
</template>

<style scoped>
.frame-bar {
  display: flex;
  flex-direction: column;
  gap: var(--frame-bar-gap);
  color: var(--ink);
}

.frame-bar__head {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.frame-bar__size {
  display: flex;
  flex: 1;
  align-items: flex-end;
  gap: var(--space-4);
  min-width: 0;
}

.frame-bar__field {
  display: flex;
  flex: 1 1 5rem;
  flex-direction: column;
  max-width: 7rem;
  min-width: 0;
}

.frame-bar__label {
  font: var(--type-meta-tiny);
  color: var(--muted);
}

.frame-bar__times {
  padding-bottom: var(--space-4);
  color: var(--muted);
}

.frame-bar__input {
  box-sizing: border-box;
  width: 100%;
  min-height: 2rem;
  padding: 0 var(--space-6);
  font: var(--type-title);
  font-size: 0.9375rem;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
}

.frame-bar__input::placeholder {
  color: var(--muted);
  opacity: 1;
}

.frame-bar__input:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.frame-bar__size--locked {
  cursor: not-allowed;
}

/* Off: a press goes to the group, so its Tooltip answers it. */
.frame-bar__input:disabled {
  color: var(--faint);
  pointer-events: none;
}

.frame-bar__unit {
  padding-bottom: var(--space-4);
  color: var(--muted);
}

.frame-bar__divider {
  align-self: stretch;
  width: 1px;
  margin: 0 var(--space-4);
  background: var(--line-strong);
}

.frame-bar__head :deep(.frame-bar__tool) {
  width: var(--frame-hit);
  height: var(--frame-hit);
  border-radius: var(--radius-md);
}

.frame-bar__head :deep(.frame-bar__tool--danger) {
  color: var(--danger);
}

.frame-bar__edges {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--frame-bar-gap);
}

/* Narrow: the four cells stack two by two. */
@media (max-width: 560px) {
  .frame-bar__edges {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.frame-bar__cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-6);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
}

.frame-bar__cell--last {
  border: 2px solid var(--accent-strong);
  padding: calc(var(--space-6) - 1px);
}

/* A square with the edge this cell moves ruled thick. */
.frame-bar__glyph {
  box-sizing: border-box;
  width: 16px;
  height: 16px;
  border: 1px solid var(--muted);
  border-radius: 2px;
}

.frame-bar__glyph--top {
  border-top: 4px solid var(--ink);
}

.frame-bar__glyph--bottom {
  border-bottom: 4px solid var(--ink);
}

.frame-bar__glyph--left {
  border-left: 4px solid var(--ink);
}

.frame-bar__glyph--right {
  border-right: 4px solid var(--ink);
}

.frame-bar__glyph--last {
  border-color: var(--accent);
}

.frame-bar__name {
  font: var(--type-small);
  font-weight: 600;
}

.frame-bar__pair {
  display: flex;
  gap: var(--frame-stepper-gap);
}

.frame-bar__cell :deep(.frame-bar__step) {
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

.frame-bar__cell :deep(.frame-bar__step[aria-disabled='true']) {
  color: var(--faint);
  background: var(--surface);
}
</style>
