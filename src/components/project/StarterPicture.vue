<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { designSizes, STARTER_BEAD_ID, starterProject, type Starter, type StarterChoice } from '../../domain/starters'
import { PROJECT_THEMES } from '../../rendering/beadLook'
import { renderProject } from '../../rendering/projectRenderer'
import { spaceOf } from '../../rendering/space'
import { useResolvedTheme } from '../../theme/useResolvedTheme'

// A Starter's picture (tickets 0596, 0597; StarterGallery card, Pictures): its design, or its shape empty with its Seams,
// drawn by the Project renderer in Real Bead shape and fitted to its well, never cropped. On a card a Band stands
// upright and the Earrings' category shows a pair. Decorative: the card or the setup names it.
const props = withDefaults(
  defineProps<{
    starter: Starter
    /** The sizes and choices drawn, and whether with the design: the design's own unless the setup has changed them. */
    choice?: StarterChoice
    /** The Bead whose shape the beads take: the setup's, or Delica 11/0 on a card. */
    beadId?: string
    /** The longest side of the drawing in CSS px; the well scales it, and it is drawn at twice that for a crisp edge. */
    drawnPx?: number
    /** Two of it side by side, as a pair of earrings. */
    pair?: boolean
    /** A Band drawn standing upright, as its card shows it; a Ring and every other Starter lie as they are. */
    upright?: boolean
  }>(),
  { choice: undefined, beadId: STARTER_BEAD_ID, drawnPx: 240, pair: false, upright: false },
)

const theme = useResolvedTheme()
const canvasEl = ref<HTMLCanvasElement>()

const project = computed(() => ({
  ...starterProject(props.starter, { name: '', beadId: props.beadId, ...(props.choice ?? { sizes: designSizes(props.starter), useDesign: true }) }),
  beadShape: 'real' as const,
}))

/** The gap between a pair, as a share of one picture's width. */
const PAIR_GAP = 0.25

function draw() {
  const canvas = canvasEl.value
  const context = canvas?.getContext('2d')
  if (!canvas || !context) return
  const space = spaceOf(project.value, false)
  const turned = props.upright && props.starter.measure === 'band'
  const copies = props.pair ? 2 : 1
  // The drawing's sides as shown: turned a quarter, and side by side with a gap between a pair.
  const width = turned ? space.extent.height : space.extent.width
  const height = turned ? space.extent.width : space.extent.height
  const across = width * (copies + PAIR_GAP * (copies - 1))
  const zoom = props.drawnPx / Math.max(across, height)
  const pixelRatio = 2
  const region = { x: 0, y: 0, width: space.extent.width * zoom, height: space.extent.height * zoom }
  // No board of its own: the well's fill shows round the beads.
  const look = { ...PROJECT_THEMES[theme.value], background: 'transparent' }
  const single = copies === 1 && !turned
  const target = single ? canvas : document.createElement('canvas')
  target.width = Math.round(region.width * pixelRatio)
  target.height = Math.round(region.height * pixelRatio)
  renderProject(target.getContext('2d')!, { project: project.value, space, region, zoom, pixelRatio, theme: look, rowMarks: false })
  if (single) return
  canvas.width = Math.round(across * zoom * pixelRatio)
  canvas.height = Math.round(height * zoom * pixelRatio)
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, canvas.width, canvas.height)
  const step = width * (1 + PAIR_GAP) * zoom * pixelRatio
  for (let copy = 0; copy < copies; copy += 1) {
    context.setTransform(1, 0, 0, 1, copy * step, 0)
    if (turned) {
      // A quarter turn clockwise: what was the top edge now runs down the right.
      context.translate(target.height, 0)
      context.rotate(Math.PI / 2)
    }
    context.drawImage(target, 0, 0)
  }
  context.setTransform(1, 0, 0, 1, 0, 0)
}

onMounted(draw)
watch([project, theme, () => props.pair, () => props.upright], draw)
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
