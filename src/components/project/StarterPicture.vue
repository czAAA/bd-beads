<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { starterProject, type Starter } from '../../domain/starters'
import { PROJECT_THEMES } from '../../rendering/beadLook'
import { renderProject } from '../../rendering/projectRenderer'
import { spaceOf } from '../../rendering/space'
import { useResolvedTheme } from '../../theme/useResolvedTheme'

// A Starter's picture (ticket 0596; StarterGallery card, Pictures): its design, or its shape empty with its Seams, drawn
// by the Project renderer in Real Bead shape and fitted to its well, never cropped. Decorative: the card or the setup
// names it.
const props = withDefaults(
  defineProps<{
    starter: Starter
    /** The size drawn: the design's own unless the setup has changed it. */
    size?: number
    /** Draws the design; off, the shape is drawn empty. */
    design?: boolean
    /** The Bead whose shape the beads take: the setup's, or Delica 11/0 on a card. */
    beadId?: string
    /** The longest side of the drawing in CSS px; the well scales it, and it is drawn at twice that for a crisp edge. */
    drawnPx?: number
  }>(),
  { size: undefined, design: true, beadId: 'miyuki/delica/11-0', drawnPx: 240 },
)

const theme = useResolvedTheme()
const canvasEl = ref<HTMLCanvasElement>()

const project = computed(() => ({
  ...starterProject(props.starter, { name: '', beadId: props.beadId, size: props.size ?? props.starter.size, useDesign: props.design }),
  beadShape: 'real' as const,
}))

function draw() {
  const canvas = canvasEl.value
  const context = canvas?.getContext('2d')
  if (!canvas || !context) return
  const space = spaceOf(project.value, false)
  const zoom = props.drawnPx / Math.max(space.extent.width, space.extent.height)
  const pixelRatio = 2
  const region = { x: 0, y: 0, width: space.extent.width * zoom, height: space.extent.height * zoom }
  canvas.width = Math.round(region.width * pixelRatio)
  canvas.height = Math.round(region.height * pixelRatio)
  // No board of its own: the well's fill shows round the beads.
  const look = { ...PROJECT_THEMES[theme.value], background: 'transparent' }
  renderProject(context, { project: project.value, space, region, zoom, pixelRatio, theme: look, rowMarks: false })
}

onMounted(draw)
watch([project, theme], draw)
</script>

<template>
  <canvas ref="canvasEl" class="starter-picture" aria-hidden="true" data-testid="starter-picture" />
</template>

<style scoped>
/* Fitted to its well with 7% padding (StarterGallery card). */
.starter-picture {
  display: block;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 7%;
  object-fit: contain;
}
</style>
