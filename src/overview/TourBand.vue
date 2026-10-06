<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { framedGrid } from '../domain/project'
import { TOUR_COLUMNS, TOUR_ROWS, tourFinishedGrid } from '../domain/tour'
import type { DrawnProject } from '../rendering/projectRenderer'
import { displayedExtentPx, renderProject } from '../rendering/projectRenderer'
import { PROJECT_THEMES } from '../rendering/beadLook'
import { spaceOf } from '../rendering/space'
import { useResolvedTheme } from '../theme/useResolvedTheme'

/**
 * The Tour Project lying across the Overview as a band on its `board`, no ruler (ticket 216; Overview card). Drawn by
 * the real Project renderer, so a bead looks as it does in the editor; it takes only the renderer and the theme, not the
 * editor. Turned a quarter so its 75 rows run left to right, row 1 at the left.
 */
const PROJECT: DrawnProject = {
  technique: 'loom',
  ...framedGrid(tourFinishedGrid()),
  rowProgress: { enabled: false, direction: 'rows', currentRow: 0, currentColumn: 0 },
  rotation: 270,
}

/** Drawn at this zoom and scaled to the page's width by CSS: the band is the same picture at every screen size. */
const ZOOM = 0.6
const EXTENT = displayedExtentPx(PROJECT.technique, TOUR_COLUMNS, TOUR_ROWS, ZOOM, PROJECT.rotation)

const theme = useResolvedTheme()
const canvasEl = ref<HTMLCanvasElement>()

function draw() {
  const canvas = canvasEl.value
  if (!canvas) return
  const pixelRatio = Math.min(2, globalThis.devicePixelRatio || 1)
  canvas.width = Math.round(EXTENT.width * pixelRatio)
  canvas.height = Math.round(EXTENT.height * pixelRatio)
  const context = canvas.getContext('2d')
  if (!context) return
  renderProject(context, {
    project: PROJECT,
    space: spaceOf(PROJECT, false),
    region: { x: 0, y: 0, width: EXTENT.width, height: EXTENT.height },
    zoom: ZOOM,
    pixelRatio,
    theme: PROJECT_THEMES[theme.value],
  })
}

onMounted(draw)
watch(theme, draw)
</script>

<template>
  <div class="tour-band" data-testid="tour-band" aria-hidden="true">
    <canvas ref="canvasEl" class="tour-band__picture" :style="{ aspectRatio: `${EXTENT.width} / ${EXTENT.height}` }" />
  </div>
</template>

<style scoped>
.tour-band {
  box-sizing: border-box;
  width: 100%;
  max-width: 55rem;
  padding: var(--space-10);
  background: var(--board);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-1);
}

@media (min-width: 744px) {
  .tour-band {
    padding: var(--space-12);
  }
}

.tour-band__picture {
  display: block;
  width: 100%;
  height: auto;
}
</style>
