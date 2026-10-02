<script setup lang="ts">
import type { Grid } from '../../domain/pattern'
import { useI18n } from '../../i18n/useI18n'
import { thumbnailPixels } from '../../rendering/patternThumbnail'
import ExampleFrame from './ExampleFrame.vue'
import { CHECKS, GOLD_STRIP, HEART, HILLS, POPPY, STRIPES } from './exampleArt'

/** Saved Patterns (ticket 218): the gallery as the library shows it, six round thumbnails drawn the way the real ones are, the first one open. */
const { t } = useI18n()
const SIZE = 176
const GALLERY: Grid[] = [GOLD_STRIP, POPPY, HEART, HILLS, STRIPES, CHECKS]

const ITEMS = GALLERY.map((grid) => ({ grid, size: `${grid[0]!.length}×${grid.length}` }))

/** Draws one thumbnail the way PatternThumbnail does: the whole Pattern fitted into the circle, empty beads left clear. */
function draw(canvas: unknown, grid: Grid) {
  if (!(canvas instanceof HTMLCanvasElement)) return
  const context = canvas.getContext('2d')
  if (!context) return
  const image = thumbnailPixels({ columns: grid[0]!.length, rows: grid.length, rotation: 0, grid }, SIZE)
  canvas.width = image.width
  canvas.height = image.height
  context.putImageData(new ImageData(image.data as Uint8ClampedArray<ArrayBuffer>, image.width, image.height), 0, 0)
}
</script>

<template>
  <ExampleFrame>
    <div class="gallery">
      <div v-for="(item, i) in ITEMS" :key="i" class="gallery__item" :class="{ 'gallery__item--open': i === 0 }">
        <span class="gallery__thumbnail"><canvas :ref="(el) => draw(el, item.grid)" /></span>
        <b class="gallery__name">{{ t.overview.examples.names[i] }}</b>
        <span class="ex-label">{{ item.size }}</span>
      </div>
    </div>
  </ExampleFrame>
</template>

<style scoped>
.gallery {
  display: grid;
  grid-template-columns: repeat(3, 5.5rem);
  gap: var(--space-12) var(--space-14);
}

.gallery__item {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  align-items: center;
}

.gallery__thumbnail {
  display: grid;
  place-items: center;
  box-sizing: border-box;
  width: 5.5rem;
  height: 5.5rem;
  overflow: hidden;
  background: var(--board);
  border: 2px solid transparent;
  border-radius: var(--radius-full);
}

.gallery__item--open .gallery__thumbnail {
  border-color: var(--accent);
}

.gallery__thumbnail canvas {
  display: block;
  max-width: 100%;
  max-height: 100%;
  image-rendering: pixelated;
}

.gallery__name {
  font: var(--type-small);
  color: var(--ink);
}
</style>
