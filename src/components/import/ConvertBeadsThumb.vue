<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Grid } from '../../domain/project'
import type { DrawnProject } from '../../rendering/projectRenderer'
import { thumbnailPixels } from '../../rendering/projectThumbnail'

// A neighbour's small picture in the Colors neighbours' card (ConvertImage card DS-2, ticket 0904): the beads as the
// Project renderer lays them, fitted to the place's width at twice its size. Until new beads come the last stay drawn.
const props = defineProps<{ beads: Grid | undefined; drawn: (beads: Grid) => DrawnProject }>()
/** The drawn picture's width over its height, so the card can keep a place not yet drawn as tall. */
const emit = defineEmits<{ shape: [ratio: number] }>()

/** Pixels on the longer side: a place's picture at twice the density, with room for a picture taller than wide. */
const DRAWN_SIZE = 224

const canvasEl = ref<HTMLCanvasElement>()
let frame = 0

function draw() {
  frame = 0
  const context = canvasEl.value?.getContext('2d')
  if (!canvasEl.value || !context || !props.beads?.length) return
  const image = thumbnailPixels(props.drawn(props.beads), DRAWN_SIZE)
  canvasEl.value.width = image.width
  canvasEl.value.height = image.height
  emit('shape', image.width / image.height)
  context.putImageData(new ImageData(image.data as Uint8ClampedArray<ArrayBuffer>, image.width, image.height), 0, 0)
}

onMounted(draw)
// While the slider moves the count shown's beads change at every step: drawn at most once a frame.
watch(
  () => props.beads,
  () => {
    if (typeof requestAnimationFrame !== 'function') draw()
    else if (!frame) frame = requestAnimationFrame(draw)
  },
)
onBeforeUnmount(() => frame && cancelAnimationFrame(frame))
</script>

<template>
  <canvas ref="canvasEl" class="convert-beads-thumb" width="0" height="0" aria-hidden="true" />
</template>

<style scoped>
.convert-beads-thumb {
  display: block;
  width: 100%;
  height: auto;
  /* Not yet drawn, it keeps the shape of the count shown's picture. */
  aspect-ratio: auto var(--convert-neighbours-ratio, 1);
  image-rendering: pixelated;
}
</style>
