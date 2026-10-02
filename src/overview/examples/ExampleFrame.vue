<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import './examples.css'

/**
 * The room an example of the Overview carousel (ticket 218) is drawn in: the example is laid out at its natural size and
 * scaled down, uniformly and never up, to fit what the stage leaves it, so nothing is stretched and nothing overflows at
 * any of the five screen sizes. Decorative: hidden from screen readers.
 */
const box = ref<HTMLElement>()
const content = ref<HTMLElement>()
const scale = ref(1)

function fit() {
  const room = box.value
  const natural = content.value
  if (!room || !natural) return
  const style = getComputedStyle(room)
  const width = room.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
  const height = room.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
  if (!natural.offsetWidth || !natural.offsetHeight || width <= 0 || height <= 0) return
  scale.value = Math.min(1, width / natural.offsetWidth, height / natural.offsetHeight)
}

let observer: ResizeObserver | undefined
onMounted(() => {
  fit()
  if (typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver(fit)
  if (box.value) observer.observe(box.value)
  if (content.value) observer.observe(content.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div ref="box" class="example" aria-hidden="true" data-testid="feature-example">
    <div ref="content" class="example__content" :style="{ transform: `scale(${scale})` }">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.example {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Takes what the stage leaves and never asks for more: the example scales to the room, the room doesn't grow to the example. */
  flex: 1 1 0;
  width: 100%;
  min-height: 0;
  padding: var(--example-inset-top, var(--space-16)) var(--space-16) var(--example-inset-bottom, var(--space-16));
}

.example__content {
  position: relative;
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  gap: var(--space-24);
  width: max-content;
  text-align: left;
}
</style>
