<script setup lang="ts">
import { computed } from 'vue'
import { ICON_BODIES, type IconName, type IconSize } from './icons'

// One Icons v2 icon, drawn inline in the current text color (ticket 137). Decorative (hidden from assistive tech)
// unless given a `label`.
const props = withDefaults(
  defineProps<{
    name: IconName
    size?: IconSize
    label?: string
    /** How far the icon's turning part (its `data-turns` group: the Rotate canvas bead, ticket 1082) is turned, in
     * degrees clockwise, unbounded so a turn past a whole one goes on the same way; the rest of the drawing stays. */
    turn?: number
  }>(),
  { size: 16, label: undefined, turn: undefined },
)

const body = computed(() => ICON_BODIES[props.name])
/** In rem, so the icon scales with the browser's text size along with its label. */
const dimension = computed(() => `${props.size / 16}rem`)
const style = computed(() => ({ width: dimension.value, height: dimension.value, ...(props.turn === undefined ? {} : { '--icon-turn': `${props.turn}deg` }) }))
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- the design system's own SVG files, bundled at build time -->
  <svg
    class="icon"
    :data-icon="name"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    focusable="false"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
    :style="style"
    v-html="body"
  />
</template>

<style scoped>
.icon {
  display: inline-block;
  flex: none;
  vertical-align: middle;
}

/* A turning part (Icons README, ticket 1082) turns about the bead's own centre, (9, 15) on the 24 grid, over the base
 * duration; with reduced motion it jumps. */
.icon :deep([data-turns]) {
  transform: rotate(var(--icon-turn, 0deg));
  transform-origin: 9px 15px;
  transition: transform var(--duration-base) var(--ease-standard);
}

@media (prefers-reduced-motion: reduce) {
  .icon :deep([data-turns]) {
    transition: none;
  }
}
</style>
