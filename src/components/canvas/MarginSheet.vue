<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import { boxesOverlap, overlapsSelectionHandles, type BarBox, type FrameAnchor } from '../../composables/tools/selectionBarPlacement'
import { useElementSize } from '../../composables/ui/useElementSize'
import { useRovingFocus } from '../../composables/ui/useRovingFocus'
import { frameAllows } from '../../domain/frameShape'
import type { Project } from '../../domain/project'
import { rowProgressStarted } from '../../domain/rowProgress'
import type { Technique } from '../../domain/weave'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import IconButton from '../ui/IconButton.vue'
import MarginColorPopover from './MarginColorPopover.vue'
import MarginTitleBlock from './MarginTitleBlock.vue'
import RowProgressControls from './RowProgressControls.vue'
import { frameOf } from '../../domain/layerRecord'

// The Frame's tools on its margin sheet (MarginSheet card, ticket 0657): Row progress, the Move bar and Rotate Frame,
// Edit Frame, Export, Margin color and Remove Frame in its top band, the title block in its bottom-right corner. Laid
// over the sheet the canvas draws, in the canvas box's pixels; each control is the one the panels and the bar have.
const props = defineProps<{
  project: Project
  anchor: FrameAnchor
  /** Whether the Frame's handles are on (Edit Frame): the sheet's edge is outlined in the accent meanwhile. */
  editing: boolean
  /** Whether a pointer is down on the canvas, so the Move bar knows when its drag has ended. */
  pressing: boolean
  rowHighlight?: boolean
  /** Whether the Export panel is open from this sheet's Export button. */
  exportOpen?: boolean
  /** Where the Selection is, if there is one: its handles win a press where the sheet's controls lie over them. */
  selection?: BarBox
  /** Where the Tool pill is: it wins a press over the sheet's controls under it. */
  pill?: BarBox
}>()

const emit = defineEmits<{
  rotate: []
  'toggle-edit': []
  export: []
  remove: []
  'move-press': [event: PointerEvent]
  key: [event: KeyboardEvent]
  'move-row': [delta: number]
  'reset-progress': []
  'toggle-row-direction': []
  'toggle-row-highlight': []
  rename: [name: string]
  'set-technique': [technique: Technique]
  'save-maker-name': [name: string]
  'set-letters': [on: boolean]
}>()

const deps = computed(() => controlDeps({ activeProject: () => props.project }))
const actions = {
  move: controlAction('move-frame'),
  rotate: controlAction('rotate-frame'),
  edit: controlAction('edit-frame'),
  export: controlAction('strip-export'),
  color: controlAction('margin-color'),
  remove: controlAction('remove-frame'),
}

const frame = computed(() => frameOf(props.project))
const rotatable = computed(() => frameAllows(frame.value, 'rotate'))
/** A Custom frame's shape comes from its settings, and a Frame with a pass done holds still: no Edit Frame then. */
const editable = computed(() => frameAllows(frame.value, 'resize') && !rowProgressStarted(props.project))

const canvas = useCanvasBackground()
const titleBlockShown = computed(() => canvas.margin.titleBlock.value)
/** The sheet's place, and its lines in the tint that reads on the margin color it is drawn in. */
const sheetStyle = computed(() => {
  const { sheet } = props.anchor
  return { left: `${sheet.left}px`, top: `${sheet.top}px`, width: `${sheet.width}px`, height: `${sheet.height}px`, '--margin-line': canvas.projectTheme.value.margin.line }
})

// The top band's row and the title block on the canvas box, for what they give way to: a Selection's handles
// (ticket 498) and the Tool pill. The px mirror `--margin-band-inset`, `--margin-tool` and `--margin-border-inset`.
const INSET_PX = 14
const TOOL_PX = 28
const BORDER_INSET_PX = 10
/** The room kept between the Frame's line and the band's row or the title block (MarginSheet card, Width). */
const CLEAR_PX = 7
/** The title block's height before it is measured: two 23px rows and its edge. */
const TITLE_PX = 48
const titleEl = ref<HTMLElement>()
const titleSize = useElementSize(titleEl)
// On a band too thin to hold them (zoomed out, until the compact and folded forms of ticket 0658) the row and the
// title block stand past the sheet's edge rather than over the Frame's beads, so a press on a bead is never theirs.
const bandTop = computed(() => Math.min(INSET_PX, props.anchor.box.top - props.anchor.sheet.top - CLEAR_PX - TOOL_PX))
const titleBottom = computed(() => {
  const { box, sheet } = props.anchor
  return Math.min(BORDER_INSET_PX, sheet.top + sheet.height - (box.top + box.height) - CLEAR_PX - (titleSize.height.value || TITLE_PX))
})
const bandBox = computed<BarBox>(() => {
  const { sheet } = props.anchor
  return { left: sheet.left + INSET_PX, top: sheet.top + bandTop.value, width: Math.max(0, sheet.width - 2 * INSET_PX), height: TOOL_PX }
})
const titleBox = computed<BarBox>(() => {
  const { sheet } = props.anchor
  const width = titleSize.width.value
  const height = titleSize.height.value
  return { left: sheet.left + sheet.width - BORDER_INSET_PX - width, top: sheet.top + sheet.height - titleBottom.value - height, width, height }
})
const yields = (box: BarBox) => (!!props.selection && overlapsSelectionHandles(box, props.selection)) || (!!props.pill && boxesOverlap(box, props.pill))
const bandYields = computed(() => yields(bandBox.value))
const titleYields = computed(() => titleSize.width.value > 0 && yields(titleBox.value))

/** Row progress is one Tab stop, ←/→ along its controls, as in the Progress bar (ADR 0075). */
const progressEl = ref<HTMLElement>()
const roving = useRovingFocus(progressEl, { axis: () => 'horizontal', managesTabIndex: true })

/** Whether the Move bar is being dragged: it turns accent until the canvas press ends. */
const dragging = ref(false)
watch(
  () => props.pressing,
  (pressing) => {
    if (!pressing) dragging.value = false
  },
)
function onMovePress(event: PointerEvent): void {
  dragging.value = true
  emit('move-press', event)
}

/** The Margin color popover, hung from its button. */
const toolsEl = ref<HTMLElement>()
const colorOpen = ref(false)
const colorButton = computed(() => (colorOpen.value ? (toolsEl.value?.querySelector<HTMLElement>('[data-testid="margin-color"]') ?? undefined) : undefined))
</script>

<template>
  <div class="margin-sheet" :class="{ 'margin-sheet--editing': editing }" :style="sheetStyle" data-testid="margin-sheet">
    <div class="margin-sheet__band" :class="{ 'margin-sheet__yielding': bandYields }" :style="{ top: `${bandTop}px` }" data-testid="margin-band">
      <div ref="progressEl" class="margin-sheet__progress" @keydown="roving.onKeydown" @focusin="roving.onFocusin">
        <RowProgressControls
          :project="project"
          :row-highlight="rowHighlight"
          form="margin"
          testid="margin-progress"
          @move-row="emit('move-row', $event)"
          @reset-progress="emit('reset-progress')"
          @toggle-row-direction="emit('toggle-row-direction')"
          @toggle-row-highlight="emit('toggle-row-highlight')"
        />
      </div>
      <!-- The Move bar: the Frame card's Move handle on the paper. Its press goes on to the canvas to drag; arrows move
        the Frame, Shift+arrows resize. -->
      <IconButton
        variant="plain"
        :action="actions.move"
        class="margin-sheet__move"
        :class="{ 'margin-sheet__move--dragging': dragging }"
        data-testid="frame-move-handle"
        @pointerdown="onMovePress"
        @keydown="emit('key', $event)"
      >
        <span class="margin-sheet__move-line" aria-hidden="true" />
      </IconButton>
      <div ref="toolsEl" class="margin-sheet__tools">
        <IconButton v-if="rotatable" variant="plain" :icon-size="16" :action="actions.rotate" :deps="deps" data-testid="margin-rotate-frame" @click="emit('rotate')" />
        <IconButton
          v-if="editable"
          variant="plain"
          :icon-size="16"
          :action="actions.edit"
          :deps="deps"
          :selected="editing"
          data-testid="frame-edit-toggle"
          @click="emit('toggle-edit')"
        />
        <IconButton variant="plain" :icon-size="16" :action="actions.export" :selected="exportOpen" data-testid="margin-export" @click="emit('export')" />
        <IconButton
          variant="plain"
          :icon-size="16"
          :action="actions.color"
          :selected="colorOpen"
          aria-haspopup="dialog"
          :aria-expanded="colorOpen"
          data-testid="margin-color"
          @click="colorOpen = !colorOpen"
        />
        <span class="margin-sheet__divider" aria-hidden="true" />
        <IconButton variant="plain" :icon-size="16" :action="actions.remove" :deps="deps" class="margin-sheet__remove" data-testid="frame-chrome-remove" @click="emit('remove')" />
      </div>
    </div>

    <div
      v-if="titleBlockShown && frame"
      ref="titleEl"
      class="margin-sheet__title"
      :class="{ 'margin-sheet__yielding': titleYields }"
      :style="{ bottom: `${titleBottom}px` }"
      data-testid="margin-title"
    >
      <MarginTitleBlock
        :project="project"
        @rename="emit('rename', $event)"
        @set-technique="emit('set-technique', $event)"
        @save-maker-name="emit('save-maker-name', $event)"
        @set-letters="emit('set-letters', $event)"
      />
    </div>

    <MarginColorPopover v-if="colorOpen && colorButton" :anchor="colorButton" @close="colorOpen = false" />
  </div>
</template>

<style scoped>
/* Over the sheet the canvas draws, letting every press but the controls' through to the canvas. While Edit Frame is on
 * its edge is outlined 1px dashed in the accent at 55%, 3px outside it (MarginSheet card). */
.margin-sheet {
  position: absolute;
  z-index: var(--z-context-bar);
  box-sizing: border-box;
  color: var(--ink);
  border-radius: var(--radius-lg);
  pointer-events: none;
}

.margin-sheet--editing {
  outline: 1px dashed color-mix(in srgb, var(--accent) 55%, transparent);
  outline-offset: 3px;
}

/* The top band, 14px in from the sheet's corner: Row progress at the left, the Move bar centred, the tools at the
 * right. */
.margin-sheet__band {
  position: absolute;
  top: var(--margin-band-inset);
  right: var(--margin-band-inset);
  left: var(--margin-band-inset);
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--space-4);
  height: var(--margin-tool);
}

.margin-sheet__band > *,
.margin-sheet__title {
  pointer-events: auto;
}

/* Over a Selection's handles or under the Tool pill the controls give way (ticket 498). */
.margin-sheet__yielding,
.margin-sheet__band.margin-sheet__yielding > * {
  pointer-events: none;
}

.margin-sheet__progress {
  justify-self: start;
  display: flex;
}

.margin-sheet__tools {
  justify-self: end;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* 28px icon buttons, no fill, hover `ink` at 10%; Edit Frame on is `ink` with a `canvas` icon (IconButton selected). */
.margin-sheet__tools :deep(.icon-btn) {
  width: var(--margin-tool);
  height: var(--margin-tool);
  border-radius: var(--radius-md);
}

.margin-sheet__tools :deep(.icon-btn:not(.icon-btn--selected):hover) {
  background: color-mix(in srgb, var(--ink) 10%, transparent);
}

/* Remove Frame is `ink` on the paper and `danger` on hover. */
.margin-sheet__tools :deep(.margin-sheet__remove:hover) {
  color: var(--danger);
}

.margin-sheet__divider {
  width: 1px;
  height: var(--space-16);
  margin: 0 var(--space-2);
  background: var(--margin-line);
}

/* The Move bar: a 40 × 6 `ink` pill in a 56 × 28 hit area, `grab`. */
.margin-sheet__band :deep(.margin-sheet__move) {
  width: var(--frame-handle-hit-width);
  height: var(--margin-move-height);
  background: none;
  border: 0;
  cursor: grab;
  touch-action: none;
}

.margin-sheet__band :deep(.margin-sheet__move--dragging) {
  cursor: grabbing;
}

.margin-sheet__move-line {
  width: var(--frame-handle-length);
  height: var(--frame-handle-thickness);
  background: var(--ink);
  border-radius: var(--frame-handle-thickness);
}

.margin-sheet__band :deep(.margin-sheet__move--dragging) .margin-sheet__move-line {
  background: var(--accent);
}

/* The title block, anchored to the inner border's bottom-right corner. */
.margin-sheet__title {
  position: absolute;
  right: var(--margin-border-inset);
  bottom: var(--margin-border-inset);
}
</style>
