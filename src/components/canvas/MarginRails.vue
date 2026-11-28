<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { controlDeps } from '../../composables/shell/controlRegistry'
import type { ExportChoice } from '../../composables/shell/openPanel'
import type { RowPress } from '../../composables/project/useRowOps'
import { useElementSize } from '../../composables/ui/useElementSize'
import { nearestQuarterTurn } from '../../domain/canvasOrientation'
import type { FrameEdge } from '../../domain/frame'
import type { FrameSettings } from '../../domain/frameShape'
import type { FrameId } from '../../domain/grid'
import { orientationOf } from '../../domain/layerRecord'
import { canvasWeave } from '../../domain/layerWeave'
import type { Background, Project } from '../../domain/project'
import type { SeenWay } from '../../domain/rowProgress'
import { coversOf } from '../../domain/sheets'
import type { Insets } from '../../domain/toolPill'
import type { Technique } from '../../domain/weave'
import { cellSizePx } from '../../rendering/cellSize'
import { expandedLayout } from '../../rendering/expandedSheet'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import MarginFoot from './MarginFoot.vue'
import MarginRailFacts from './MarginRailFacts.vue'
import MarginRailTools from './MarginRailTools.vue'
import { handBackExpandFocus } from './expandFocus'
import { useFrameTools } from './frameTools'

// The expanded Frame's sheet (MarginSheet card, Calmer sheet 3; ticket 1260): its facts and Beads needed in the left
// rail, its tools in the right (a Frame wider than the drawing area's shape has both in a band along the top), its rows
// in the window between and Row progress pinned across the bottom. There is no ···: everything is on the sheet.
defineOptions({ inheritAttrs: false })
const props = defineProps<{
  project: Project
  frame: FrameId
  /** Whether the Frame's handles are on (Edit Frame). */
  editing: boolean
  rowHighlight?: boolean
  rowPress?: RowPress
  /** Whether the whole Frame is the Mirror's Area (ADR 0082). */
  mirrorOnFrame?: boolean
  /** The Frame's settings popover is asked to open (ticket 1222): everything it holds is already here. */
  popoverAsked?: boolean
  /** A PNG or PDF is being drawn. */
  exporting?: ExportChoice
  /** The save ring stands at the drawing area's top-right, over the right rail's start. */
  underRing?: boolean
}>()

const emit = defineEmits<{
  mirror: []
  rotate: []
  'toggle-edit': []
  remove: []
  'toggle-expand': []
  'move-row': [delta: number]
  'reset-progress': []
  'set-row-direction': [way: SeenWay]
  'toggle-row-highlight': []
  rename: [name: string]
  'set-technique': [technique: Technique]
  'set-setting': [id: string, value: number]
  'save-maker-name': [name: string]
  'replace-bead': [beadId: string]
  'set-letters': [on: boolean]
  step: [edge: FrameEdge, step: 1 | -1]
  resize: [columns: number, rows: number]
  'set-settings': [change: FrameSettings]
  'set-background': [background: Background]
  'settle-settings': []
  'popover-opened': []
  'export-png': [part: Project]
  'export-pdf': [typedName: undefined, part: Project]
  'save-project-file': []
  /** What the rails and Row progress take from each side of the drawing area: the canvas fits the rows into the rest. */
  measured: [chrome: Insets]
}>()

const canvas = useCanvasBackground(() => props.project)
const deps = computed(() => controlDeps({ activeProject: () => props.project, frame: () => props.frame }))
const tools = useFrameTools(() => props.project, () => props.frame, {
  mirrorOn: () => !!props.mirrorOnFrame,
  run: {
    mirror: () => emit('mirror'),
    rotate: () => emit('rotate'),
    edit: () => emit('toggle-edit'),
    // Export and Margin color unfold in the rail itself.
    export: () => {},
    color: () => {},
    remove: () => emit('remove'),
  },
})

const rootEl = ref<HTMLElement>()
const windowEl = ref<HTMLElement>()
const footEl = ref<HTMLElement>()
const rootSize = useElementSize(rootEl)
const windowSize = useElementSize(windowEl)
const footSize = useElementSize(footEl)

/** The Frame's shape as seen: the Canvas positions under it, turned with the Table. */
const shape = computed(() => {
  const footprint = coversOf(props.project).find((cover) => cover.ref === props.frame)?.frame
  if (!footprint) return { width: 1, height: 1 }
  const weave = canvasWeave(props.project)
  const cell = cellSizePx(weave.technique, weave.cell)
  const size = { width: footprint.columns * cell.width, height: footprint.rows * cell.height }
  return nearestQuarterTurn(orientationOf(props.project) ?? 0) % 180 === 0 ? size : { width: size.height, height: size.width }
})
const layout = computed(() => expandedLayout(shape.value, { width: rootSize.width.value, height: rootSize.height.value }))

watch(
  [rootSize.width, rootSize.height, windowSize.width, windowSize.height, layout],
  () => {
    const root = rootEl.value
    const window = windowEl.value
    if (!root || !window || !window.offsetWidth) return
    const { offsetLeft: left, offsetTop: top } = window
    emit('measured', { left, top, right: Math.max(0, root.clientWidth - left - window.offsetWidth), bottom: Math.max(0, root.clientHeight - top - window.offsetHeight) })
  },
  { flush: 'post' },
)

watch(
  () => props.popoverAsked,
  (asked) => asked && emit('popover-opened'),
  { immediate: true },
)

const style = computed(() => {
  const margin = canvas.projectTheme.value.margin
  return { '--margin-fill': margin.fill, '--margin-line': margin.line, '--margin-edge': margin.edge, '--expanded-around': canvas.background.value?.color ?? 'var(--canvas)' }
})

// The press that expanded the Frame took its button with it: the focus goes on to Back to the Canvas, and back.
onMounted(() => {
  if (document.activeElement === document.body) rootEl.value?.querySelector<HTMLElement>('[data-testid="margin-expand-frame"]')?.focus({ preventScroll: true })
})
onBeforeUnmount(() => {
  if (rootEl.value?.contains(document.activeElement)) handBackExpandFocus(props.frame)
})
</script>

<template>
  <div ref="rootEl" class="margin-rails" :class="`margin-rails--${layout}`" :style="style" :data-frame="frame" data-testid="margin-rails">
    <!-- The rails are narrow: their rows' words wrap rather than being cut. -->
    <div class="margin-rails__facts" data-wrap-ok>
      <MarginRailFacts
        :project="project"
        :frame="frame"
        @back="emit('toggle-expand')"
        @rename="emit('rename', $event)"
        @set-technique="emit('set-technique', $event)"
        @set-setting="(id, value) => emit('set-setting', id, value)"
        @save-maker-name="emit('save-maker-name', $event)"
        @replace-bead="emit('replace-bead', $event)"
        @set-letters="emit('set-letters', $event)"
        @step="(edge, step) => emit('step', edge, step)"
        @resize="(columns, rows) => emit('resize', columns, rows)"
        @set-settings="emit('set-settings', $event)"
        @reset-progress="emit('reset-progress')"
        @settle-settings="emit('settle-settings')"
      />
    </div>
    <div ref="windowEl" class="margin-rails__window" data-testid="margin-rails-window" />
    <div class="margin-rails__tools" :class="{ 'margin-rails__tools--under-ring': underRing }" data-wrap-ok>
      <MarginRailTools
        :project="project"
        :frame="frame"
        :items="tools.items.value"
        :deps="deps"
        :editing="editing"
        :exporting="exporting"
        @export-png="emit('export-png', $event)"
        @export-pdf="(name, part) => emit('export-pdf', name, part)"
        @save-project-file="emit('save-project-file')"
        @save-maker-name="emit('save-maker-name', $event)"
        @set-background="emit('set-background', $event)"
      />
    </div>
    <div ref="footEl" class="margin-rails__progress">
      <MarginFoot
        v-if="footSize.width.value"
        class="margin-rails__foot"
        :project="project"
        :frame="frame"
        :row-highlight="rowHighlight"
        :row-press="rowPress"
        :room="footSize.width.value"
        :scale="1"
        sheet-form="full"
        expanded
        stacks
        data-testid="margin-foot"
        @move-row="emit('move-row', $event)"
        @reset-progress="emit('reset-progress')"
        @set-row-direction="emit('set-row-direction', $event)"
        @toggle-row-highlight="emit('toggle-row-highlight')"
      />
    </div>
  </div>
</template>

<style scoped>
/* Over the paper the canvas draws across the whole drawing area: the rails, the band and Row progress are the same paper,
 * opaque, so the rows scroll under them; the window between lets every press through to the beads. */
.margin-rails {
  --swatch-gap: var(--margin-fill);
  position: absolute;
  inset: 0;
  display: grid;
  box-sizing: border-box;
  overflow: hidden;
  /* The rails reach under the edge line drawn over them, so no bead shows between the two. */
  padding: var(--space-4);
  color: var(--ink);
  pointer-events: none;
}

/* The sheet's rounded corners and edge, `space-4` in from the drawing area, the Canvas's color round them. */
.margin-rails::after {
  content: '';
  position: absolute;
  inset: var(--space-4);
  border: 1px solid var(--margin-edge);
  border-radius: var(--margin-sheet-radius);
  box-shadow: 0 0 0 var(--space-16) var(--expanded-around);
}

.margin-rails--rails {
  grid-template-columns: var(--margin-rail) minmax(0, 1fr) var(--margin-rail);
  grid-template-rows: minmax(0, 1fr) auto;
  grid-template-areas:
    'facts window tools'
    'progress progress progress';
}

.margin-rails--band {
  grid-template-columns: minmax(0, 3fr) minmax(var(--margin-rail-compact), 1fr);
  grid-template-rows: fit-content(45%) minmax(0, 1fr) auto;
  grid-template-areas:
    'facts tools'
    'window window'
    'progress progress';
}

.margin-rails--narrow {
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: fit-content(25%) fit-content(25%) minmax(0, 1fr) auto;
  grid-template-areas:
    'facts'
    'tools'
    'window'
    'progress';
}

.margin-rails__facts,
.margin-rails__tools,
.margin-rails__progress {
  min-width: 0;
  min-height: 0;
  background: var(--margin-fill);
  pointer-events: auto;
}

.margin-rails__facts,
.margin-rails__tools {
  overflow: hidden auto;
  overscroll-behavior: contain;
  padding: var(--space-8);
  touch-action: pan-y;
}

.margin-rails__facts {
  grid-area: facts;
}

.margin-rails__tools {
  grid-area: tools;
}

.margin-rails__tools--under-ring {
  padding-top: calc(var(--touch-target) + var(--space-16));
}

.margin-rails__window {
  grid-area: window;
  min-width: 0;
  min-height: 0;
}

.margin-rails__progress {
  grid-area: progress;
  padding: var(--space-8) var(--space-8) var(--space-6);
}

.margin-rails__foot {
  width: 100%;
}

@media (max-width: 1500px) {
  .margin-rails {
    --margin-rail: var(--margin-rail-compact);
  }
}

/* A phone: the tools two by two, an unfolded one across. */
.margin-rails--narrow :deep(.margin-rail-tools__rows) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
}

.margin-rails--narrow :deep(.margin-rail-tools__tool--wide),
.margin-rails--narrow :deep(.margin-rail-tools__rule) {
  grid-column: 1 / -1;
}

/* The band: the facts' three groups side by side. */
.margin-rails--band :deep(.margin-rail-facts) {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: start;
}
</style>
