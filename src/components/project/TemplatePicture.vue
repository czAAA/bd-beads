<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { framedGrid } from '../../domain/project'
import { generateOrnament, sampleColors, sampleSize, seedOf } from '../../domain/templateSample'
import type { Technique } from '../../domain/weave'
import { PROJECT_THEMES } from '../../rendering/beadLook'
import { renderProject } from '../../rendering/projectRenderer'
import { spaceOf } from '../../rendering/space'
import { displayedExtentPx } from '../../rendering/surfaceView'
import { useResolvedTheme } from '../../theme/useResolvedTheme'

// The decorated example on a Template card and in its setup (ticket 494, spec 0488; TemplateGallery card): a small
// symmetric ornament in the Technique, drawn by the Project renderer in the Frame-only space and scaled to the slot.
// Decorative.
const props = defineProps<{
  technique: Technique
  /** The Template's default size, whose shape the sample takes. */
  columns: number
  rows: number
  /** Names the ornament: the same Template always gets the same one. */
  seedText: string
}>()

/** The longest side of the drawing in CSS px; the slot scales it down or up, and it is drawn at twice that for a crisp edge. */
const DRAWN_PX = 96

const theme = useResolvedTheme()
const canvasEl = ref<HTMLCanvasElement>()

const project = computed(() => {
  const weave = { technique: props.technique }
  const grid = generateOrnament(weave, sampleSize(props.columns, props.rows), seedOf(props.seedText), sampleColors(theme.value))
  return {
    ...weave,
    ...framedGrid(grid.map((row) => row.map((color) => ({ color }))), weave),
    rowProgress: { direction: 'rows' as const, currentRow: 0, currentColumn: 0 },
    rotation: 0 as const,
  }
})
const frame = computed(() => project.value.frame!)
const unit = computed(() => displayedExtentPx(props.technique, frame.value.columns, frame.value.rows, 1, 0))
const zoom = computed(() => DRAWN_PX / Math.max(unit.value.width, unit.value.height))
const extent = computed(() => ({ width: unit.value.width * zoom.value, height: unit.value.height * zoom.value }))

function draw() {
  const canvas = canvasEl.value
  const context = canvas?.getContext('2d')
  if (!canvas || !context) return
  const pixelRatio = 2
  canvas.width = Math.round(extent.value.width * pixelRatio)
  canvas.height = Math.round(extent.value.height * pixelRatio)
  const region = { x: 0, y: 0, width: extent.value.width, height: extent.value.height }
  renderProject(context, { project: project.value, space: spaceOf(project.value, false), region, zoom: zoom.value, pixelRatio, theme: PROJECT_THEMES[theme.value], rowMarks: false })
}

onMounted(draw)
watch([project, zoom, theme], draw)
</script>

<template>
  <canvas ref="canvasEl" class="template-picture" aria-hidden="true" data-testid="template-picture" />
</template>

<style scoped>
.template-picture {
  display: block;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: var(--space-4);
  object-fit: contain;
  background: var(--board);
  border-radius: var(--radius-sm);
}
</style>
