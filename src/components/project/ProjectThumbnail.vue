<script setup lang="ts">
import { onMounted, ref, toRaw, watch } from 'vue'
import type { Project } from '../../domain/project'
import { thumbnailPixels } from '../../rendering/projectThumbnail'

/**
 * A Project's own round thumbnail (ticket 147; SavedProjects card): the whole Project on the board color, drawn at twice
 * its size for sharp screens. Redrawn only when the Project is replaced, and at most once a frame while a stroke lands.
 */
const props = defineProps<{ project: Project }>()

/** Pixels on the longer side: the 36px thumbnail at twice the density. */
const DRAWN_SIZE = 72

const canvasEl = ref<HTMLCanvasElement>()
let frame = 0

function draw() {
  frame = 0
  const context = canvasEl.value?.getContext('2d')
  if (!canvasEl.value || !context) return
  const image = thumbnailPixels(toRaw(props.project), DRAWN_SIZE)
  canvasEl.value.width = image.width
  canvasEl.value.height = image.height
  context.putImageData(new ImageData(image.data as Uint8ClampedArray<ArrayBuffer>, image.width, image.height), 0, 0)
}

onMounted(draw)
watch(
  () => props.project,
  () => {
    if (typeof requestAnimationFrame !== 'function') draw()
    else if (!frame) frame = requestAnimationFrame(draw)
  },
)
</script>

<template>
  <span class="project-thumbnail">
    <canvas ref="canvasEl" class="project-thumbnail__picture" aria-hidden="true" />
  </span>
</template>

<style scoped>
.project-thumbnail {
  display: grid;
  place-items: center;
  width: var(--thumbnail-size);
  height: var(--thumbnail-size);
  overflow: hidden;
  background: var(--board);
  border-radius: var(--radius-full);
}

.project-thumbnail__picture {
  max-width: 100%;
  max-height: 100%;
  image-rendering: pixelated;
}
</style>
