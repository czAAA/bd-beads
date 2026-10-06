<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { framedGrid, type Grid, type RowProgress, type Technique } from '../../domain/project'
import type { Selection } from '../../domain/selection'
import type { HoverPreview } from '../../rendering/overlayRenderer'
import { renderOverlay } from '../../rendering/overlayRenderer'
import { displayedExtentPx, renderProject } from '../../rendering/projectRenderer'
import { spaceOf } from '../../rendering/space'
import { PROJECT_THEMES, PRINT_THEME } from '../../rendering/beadLook'
import { useResolvedTheme } from '../../theme/useResolvedTheme'

/**
 * Beads on their board for the Overview carousel's examples (ticket 218; Overview card): a grid drawn by the real Project
 * renderer, so a bead and its Technique's geometry look as they do in the editor, with the editor's own marks (the
 * current row, a Selection, the Paint preview) from the overlay renderer. It takes only those two renderers and the
 * theme, not the editor. Decorative: hidden from screen readers.
 */
const props = withDefaults(
  defineProps<{
    grid: Grid
    technique?: Technique
    /** How much the Project is enlarged by; 1 is a bead 20px across. */
    zoom: number
    rowProgress?: RowProgress
    selection?: Selection
    preview?: HoverPreview
    /** Drawn as an export is: light whatever the theme, on the print board (DESIGN.md §4.3). */
    print?: boolean
  }>(),
  { technique: 'loom', print: false, rowProgress: () => ({ enabled: false, direction: 'rows', currentRow: 0, currentColumn: 0 }), selection: undefined, preview: undefined },
)

const theme = useResolvedTheme()
const pictureEl = ref<HTMLCanvasElement>()
const marksEl = ref<HTMLCanvasElement>()

const project = computed(() => ({
  technique: props.technique,
  ...framedGrid(props.grid),
  rowProgress: props.rowProgress,
  rotation: 0 as const,
}))
const extent = computed(() => displayedExtentPx(props.technique, props.grid[0]?.length ?? 0, props.grid.length, props.zoom, 0))
const space = computed(() => spaceOf(project.value, false))
const hasMarks = computed(() => props.rowProgress.enabled || !!props.selection || !!props.preview)

function size(canvas: HTMLCanvasElement, pixelRatio: number) {
  canvas.width = Math.round(extent.value.width * pixelRatio)
  canvas.height = Math.round(extent.value.height * pixelRatio)
}

function draw() {
  const pixelRatio = Math.min(2, globalThis.devicePixelRatio || 1)
  const region = { x: 0, y: 0, width: extent.value.width, height: extent.value.height }
  const input = { project: project.value, space: space.value, region, zoom: props.zoom, pixelRatio, theme: props.print ? PRINT_THEME : PROJECT_THEMES[theme.value] }
  const picture = pictureEl.value
  const pictureContext = picture?.getContext('2d')
  if (picture && pictureContext) {
    size(picture, pixelRatio)
    renderProject(pictureContext, input)
  }
  const marks = marksEl.value
  const marksContext = marks?.getContext('2d')
  if (marks && marksContext) {
    size(marks, pixelRatio)
    renderOverlay(marksContext, { ...input, selection: props.selection, preview: props.preview })
  }
}

onMounted(draw)
watch([theme, () => props.print, project, () => props.zoom, () => props.selection, () => props.preview], draw)
</script>

<template>
  <span class="bead-picture" :class="{ 'bead-picture--print': print }" aria-hidden="true">
    <canvas ref="pictureEl" class="bead-picture__layer" :style="{ width: `${extent.width}px`, height: `${extent.height}px` }" />
    <canvas v-if="hasMarks" ref="marksEl" class="bead-picture__layer bead-picture__marks" :style="{ width: `${extent.width}px`, height: `${extent.height}px` }" />
  </span>
</template>

<style scoped>
/* The board the beads lie on, as in the editor and the Tour band. */
.bead-picture {
  position: relative;
  display: inline-block;
  --bead-picture-pad: var(--space-8);

  padding: var(--bead-picture-pad);
  line-height: 0;
  background: var(--board);
  border-radius: var(--radius-lg);
}

/* On an export's page the board is the print board, whatever the theme. */
.bead-picture--print {
  --bead-picture-pad: var(--space-4);

  background: var(--paper-board);
  border-radius: var(--radius-md);
}

.bead-picture__layer {
  display: block;
}

.bead-picture__marks {
  position: absolute;
  top: var(--bead-picture-pad);
  left: var(--bead-picture-pad);
  pointer-events: none;
}
</style>
