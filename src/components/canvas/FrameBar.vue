<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppButton from '../ui/AppButton.vue'
import IconButton from '../ui/IconButton.vue'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import { useAnchoredPosition } from '../../composables/ui/useAnchoredPosition'
import { useElementSize } from '../../composables/ui/useElementSize'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'
import { useHoldRepeat } from '../../composables/ui/useHoldRepeat'
import { FRAME_EDGES, frameWithEdgeStep, parseFrameSize, type FrameEdge } from '../../domain/frame'
import { rowProgressStarted, type Project } from '../../domain/project'
import type { BarBox } from '../../composables/tools/selectionBarPlacement'
import { useI18n } from '../../i18n/useI18n'

// The Frame bar (ticket 473, Frame card): the Frame's size (typeable), Rotate and Remove, and a − and + pair per edge.
// It drops down from the strip's Frame button like Menu and Project (a dropdown from 1024px, a sheet under the strip
// below), outside the zoom and pan, and stays while the canvas is worked. A held press repeats a step.
const props = defineProps<{
  project: Project
}>()

const emit = defineEmits<{
  step: [edge: FrameEdge, step: 1 | -1]
  resize: [columns: number, rows: number]
  rotate: []
  remove: []
  key: [event: KeyboardEvent]
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
const wide = useMediaQuery('(min-width: 1024px)')
const anchorEl = ref<HTMLElement>()
const anchored = useAnchoredPosition(anchorEl, barEl, () => 'start')

/** Below 1024px the bar is a sheet under the strip, the canvas box's full width. */
const sheetStyle = ref<Record<string, string>>({})
function placeSheet() {
  const strip = document.querySelector('[data-testid="canvas-strip"]')?.getBoundingClientRect()
  const box = document.querySelector('[data-testid="app-canvas"]')?.getBoundingClientRect()
  if (strip && box) sheetStyle.value = { position: 'fixed', top: `${strip.bottom}px`, left: `${box.left}px`, width: `${box.width}px` }
}
function place() {
  anchorEl.value = document.querySelector<HTMLElement>('[data-testid="strip-frame"]') ?? undefined
  if (wide.value) {
    anchored.follow()
  } else {
    anchored.stop()
    placeSheet()
  }
}
const placed = computed(() => (wide.value ? anchored.style.value : sheetStyle.value))
onMounted(() => {
  place()
  window.addEventListener('resize', placeSheet)
})
watch(wide, () => void nextTick(place))

/** The bar's rectangle in the drawing area's pixels. */
function measure(): BarBox | undefined {
  const bar = barEl.value?.getBoundingClientRect()
  const area = document.querySelector('[data-testid="app-drawing-area"]')?.getBoundingClientRect()
  return bar && area && bar.width > 0 ? { left: bar.left - area.left, top: bar.top - area.top, width: bar.width, height: bar.height } : undefined
}
watch([size.width, size.height, placed], () => void nextTick(() => emit('rect', measure())), { immediate: true, flush: 'post' })
onBeforeUnmount(() => {
  window.removeEventListener('resize', placeSheet)
  emit('rect', undefined)
})

/** The size field: shows "columns × rows"; Enter or leaving it takes a typed "20x120", Escape puts the size back. */
const typed = ref('')
const shownSize = computed(() => t.value.frame.sizeValue.replace('{columns}', String(frame.value?.columns)).replace('{rows}', String(frame.value?.rows)))
watch(shownSize, (value) => (typed.value = value), { immediate: true })
function commitSize(): void {
  const wanted = parseFrameSize(typed.value)
  if (wanted) emit('resize', wanted.columns, wanted.rows)
  typed.value = shownSize.value
}
function onSizeKey(event: KeyboardEvent): void {
  event.stopPropagation()
  if (event.key === 'Enter') commitSize()
  else if (event.key === 'Escape') typed.value = shownSize.value
}

// Top, Bottom, Left, Right is the cell order whatever the edges' own order is.
const ordered = (['top', 'bottom', 'left', 'right'] as const).map((edge) => cells.find((cell) => cell.edge === edge)!)
</script>

<template>
  <div>
    <div ref="barEl" class="frame-bar" :class="{ 'frame-bar--sheet': !wide }" :style="placed" role="group" :aria-label="t.frame.title" data-testid="frame-bar" @keydown="emit('key', $event)">
      <div class="frame-bar__head">
        <div class="frame-bar__size">
          <span class="frame-bar__label">{{ t.frame.title }}</span>
          <span class="frame-bar__value">
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
            <span class="frame-bar__unit">{{ t.frame.sizeUnit }}</span>
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
  </div>
</template>

<style scoped>
.frame-bar {
  display: flex;
  flex-direction: column;
  gap: var(--frame-bar-gap);
  box-sizing: border-box;
  z-index: var(--z-context-bar);
  width: min(calc(100vw - 2 * var(--frame-bar-gap)), var(--frame-bar-width));
  padding: var(--frame-bar-gap);
  color: var(--ink);
  background: var(--pill);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-2);
}

/* Below 1024px: a sheet under the strip, as wide as the canvas box. */
.frame-bar--sheet {
  width: auto;
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
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
