<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import AppButton from '../ui/AppButton.vue'
import IconButton from '../ui/IconButton.vue'
import PanelShell from '../shell/PanelShell.vue'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import { useElementSize } from '../../composables/ui/useElementSize'
import { useHoldRepeat } from '../../composables/ui/useHoldRepeat'
import { FRAME_EDGES, frameWithEdgeStep, parseFrameSize, type FrameEdge } from '../../domain/frame'
import { rowProgressStarted, type Project } from '../../domain/project'
import { describeWeave } from '../../domain/weave'
import type { BarBox, FrameAnchor } from '../../composables/tools/selectionBarPlacement'
import { useI18n } from '../../i18n/useI18n'

// The Frame bar (tickets 473, 475; Frame card): the Frame's size (typeable), Rotate and Remove, and a − and + pair per
// edge. It is a panel like Menu and Project (PanelShell): from the strip's Frame button, or from the edit pencil that
// opened it, which it follows; a press outside or Escape closes it, a Frame handle's press does not.
const props = defineProps<{
  project: Project
  /** Given when the edit pencil opened the bar: it hangs from the pencil and moves with it as this changes. */
  pencil?: FrameAnchor
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
  /** The bar's rectangle in the drawing area's pixels, or none once it is gone: what the Margin handle keeps clear of. */
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
const shell = ref<InstanceType<typeof PanelShell>>()
watch(() => props.pencil, () => shell.value?.place(), { flush: 'post' })
/** Where the shell hangs the bar: under the edit pencil, right edges lined up, at every width; else from the strip. */
const placement = computed(() =>
  props.pencil ? { anchor: 'frame-edit-toggle', align: 'end' as const, dropdown: true } : { anchor: 'strip-frame', align: 'start' as const, dropdown: false },
)

/** A press on the Margin handle or the pencil, or one that grabs a resize handle, works the Frame: the bar stays. */
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
watch([size.width, size.height, () => shell.value?.box], () => void nextTick(() => emit('rect', measure())), { immediate: true, flush: 'post' })
onBeforeUnmount(() => emit('rect', undefined))

/** The size field: shows "columns × rows"; Enter or leaving it takes a typed "20x120", Escape puts the size back. */
const typed = ref('')
const counted = computed(() => describeWeave(props.project).unitsOf(frame.value ?? { columns: 0, rows: 0 }))
const shownSize = computed(() => t.value.frame.sizeValue.replace('{columns}', String(counted.value.columns)).replace('{rows}', String(counted.value.rows)))
const sizeUnit = computed(() => (describeWeave(props.project).countsUnits ? t.value.frame.sizeUnitUnits : t.value.frame.sizeUnit))
watch(shownSize, (value) => (typed.value = value), { immediate: true })
function commitSize(): void {
  const wanted = parseFrameSize(typed.value)
  // The size it already has is no step: re-centring it would shift a Frame whose rows alternate by a pair.
  if (wanted && (wanted.columns !== counted.value.columns || wanted.rows !== counted.value.rows)) emit('resize', wanted.columns, wanted.rows)
  typed.value = shownSize.value
}
function onSizeKey(event: KeyboardEvent): void {
  event.stopPropagation()
  if (event.key === 'Enter') commitSize()
}

// Top, Bottom, Left, Right is the cell order whatever the edges' own order is.
const ordered = (['top', 'bottom', 'left', 'right'] as const).map((edge) => cells.find((cell) => cell.edge === edge)!)
</script>

<template>
  <PanelShell
    ref="shell"
    :title="t.frame.title"
    v-bind="placement"
    width="min(calc(100vw - 2 * var(--frame-bar-gap)), var(--frame-bar-width))"
    :keeps-press="keepsPress"
    @close="emit('close')"
  >
    <div ref="barEl" class="frame-bar" role="group" :aria-label="t.frame.title" data-testid="frame-bar" @keydown="emit('key', $event)">
      <div class="frame-bar__head">
        <div class="frame-bar__size">
          <span class="frame-bar__label">{{ t.frame.title }}</span>
          <!-- Escape during an edit in the field puts the size back; otherwise it closes the panel (PanelShell). -->
          <span class="frame-bar__value" :data-handles-escape="typed !== shownSize || undefined" @panel-escape="typed = shownSize">
            <input
              v-model="typed"
              class="frame-bar__input"
              type="text"
              inputmode="numeric"
              autocomplete="off"
              :aria-label="t.frame.sizeLabel"
              :readonly="locked"
              data-testid="frame-bar-size"
              @keydown="onSizeKey"
              @blur="commitSize"
              @focus="($event.target as HTMLInputElement).select()"
            />
            <span class="frame-bar__unit">{{ sizeUnit }}</span>
          </span>
        </div>
        <IconButton
          v-if="!locked"
          variant="secondary"
          :icon-size="18"
          :action="rotateAction"
          :deps="deps"
          class="frame-bar__tool"
          data-testid="frame-rotate"
          @click="emit('rotate')"
        />
        <span v-if="!locked" class="frame-bar__divider" aria-hidden="true" />
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
      <div v-if="!locked" class="frame-bar__edges">
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
  </PanelShell>
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
  flex-direction: column;
  min-width: 0;
}

.frame-bar__label {
  font: var(--type-meta-tiny);
  color: var(--muted);
}

.frame-bar__value {
  font: var(--type-title);
  font-size: 0.9375rem;
  color: var(--ink);
}

.frame-bar__input {
  box-sizing: content-box;
  width: 7ch;
  field-sizing: content;
  min-width: 5ch;
  padding: 0 var(--space-2);
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  border-bottom: 1px dashed var(--line-strong);
  border-radius: 0;
}

.frame-bar__input:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.frame-bar__unit {
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
