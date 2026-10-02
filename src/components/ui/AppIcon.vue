<script setup lang="ts">
import { computed } from 'vue'
import { ICON_BODIES, type IconName, type IconSize } from './icons'

/**
 * One Icons v2 icon, drawn inline in the current text color (ticket 137). Decorative by default, hidden from assistive
 * tech, since the control it sits in carries the name; pass `label` only for an icon that means something on its own.
 */
const props = withDefaults(defineProps<{ name: IconName; size?: IconSize; label?: string }>(), { size: 16, label: undefined })

const body = computed(() => ICON_BODIES[props.name])
/** In rem, so the icon scales with the browser's text size along with its label. */
const dimension = computed(() => `${props.size / 16}rem`)
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
    :style="{ width: dimension, height: dimension }"
    v-html="body"
  />
</template>

<style scoped>
.icon {
  display: inline-block;
  flex: none;
  vertical-align: middle;
}
</style>
