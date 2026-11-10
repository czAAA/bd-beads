<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from '../i18n/useI18n'
import { PROJECT_THEMES } from '../rendering/beadLook'
import { renderProject } from '../rendering/projectRenderer'
import { spaceOf } from '../rendering/space'
import { useResolvedTheme } from '../theme/useResolvedTheme'
import { finishedMountains } from './inside/demoProjects'

// The Welcome section's piece (Homepage card, ticket 0830): the mountains the tour traces, finished in peyote, drawn by
// the Project renderer in the theme shown with its Frame's line round it. An image, never a picture file.
const { t } = useI18n()
const theme = useResolvedTheme()
const canvasEl = ref<HTMLCanvasElement>()
const project = finishedMountains()

/** The piece at its widest, in CSS px (`--welcome-piece-width`); it is drawn at twice that and narrows with the tile. */
const DRAWN_PX = 840
/** The Frame's line as the editor draws it at 100% (Frame card): 1.5px, 7px off the beads, 7px corners. */
const FRAME_LINE = { width: 1.5, outset: 7, radius: 7 }

const space = spaceOf(project, false)
/** The line's room round the beads, and the zoom that fits both in the drawing's width. */
const room = FRAME_LINE.outset + FRAME_LINE.width
const zoom = (DRAWN_PX - room * 2) / space.extent.width
const region = { x: 0, y: 0, width: space.extent.width * zoom, height: space.extent.height * zoom }
/** How many times wider than tall it is drawn: a short screen sizes it by its height. */
const shape = DRAWN_PX / (region.height + room * 2)

function draw() {
  const canvas = canvasEl.value
  const context = canvas?.getContext('2d')
  if (!canvas || !context) return
  const look = PROJECT_THEMES[theme.value]
  const pixelRatio = 2
  // The beads on a canvas of their own: the renderer draws from its corner, and the line needs room round them.
  const beads = document.createElement('canvas')
  beads.width = Math.round(region.width * pixelRatio)
  beads.height = Math.round(region.height * pixelRatio)
  renderProject(beads.getContext('2d')!, { project, space, region, zoom, pixelRatio, theme: { ...look, background: 'transparent' }, rowMarks: false })
  canvas.width = Math.round(DRAWN_PX * pixelRatio)
  canvas.height = Math.round((region.height + room * 2) * pixelRatio)
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.drawImage(beads, room * pixelRatio, room * pixelRatio)
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  context.lineWidth = FRAME_LINE.width
  context.strokeStyle = look.frameLine
  context.beginPath()
  context.roundRect(FRAME_LINE.width / 2, FRAME_LINE.width / 2, DRAWN_PX - FRAME_LINE.width, region.height + room * 2 - FRAME_LINE.width, FRAME_LINE.radius)
  context.stroke()
}

onMounted(draw)
watch(theme, draw)
</script>

<template>
  <canvas
    ref="canvasEl"
    class="welcome-piece"
    role="img"
    :aria-label="t.homepage.welcome.piece"
    :style="{ '--welcome-piece-shape': shape }"
    data-testid="welcome-piece"
  />
</template>

<style scoped>
/* At most `--welcome-piece-width` wide. On a short screen it gives way, as tall as the screen leaves it and never under
 * `--welcome-piece-least-width` wide, so the tile fits whole from 1440 × 900 (Homepage card). */
.welcome-piece {
  display: block;
  width: 100%;
  max-width: clamp(
    var(--welcome-piece-least-width),
    (100vh - var(--welcome-beside-piece)) * var(--welcome-piece-shape),
    var(--welcome-piece-width)
  );
  height: auto;
}
</style>
