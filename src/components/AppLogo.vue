<script setup lang="ts">
import { computed } from 'vue'
import mark from '../../docs/design/system/assets/Logos/bd-beads-mark.svg?raw'

/**
 * The X1 Cross-weave mark (ticket 138; DESIGN.md §4.5, the design system README's Logo): drawn inline from the
 * design system's own file, in the current text color (the header sets `--accent`). The stroke gets heavier as the
 * mark gets smaller, so it keeps the same weight to the eye: 4.2 at 16px, 3.8 at 22px (the header), 3.6 at 32px,
 * 3.2 otherwise. Decorative unless given a `label`.
 */
const props = withDefaults(defineProps<{ size?: number; label?: string }>(), { size: 22, label: undefined })

/** The mark's own strokes: the file's children, without its outer <svg> and fixed accent stroke. */
const body = mark.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim()

const STROKES: Record<number, number> = { 16: 4.2, 22: 3.8, 32: 3.6 }
const strokeWidth = computed(() => STROKES[props.size] ?? 3.2)
const dimension = computed(() => `${props.size / 16}rem`)
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- the design system's own SVG file, bundled at build time -->
  <svg
    class="app-logo"
    viewBox="0 0 48 48"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    focusable="false"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
    :style="{ width: dimension, height: dimension }"
    data-testid="app-logo"
    v-html="body"
  />
</template>

<style scoped>
.app-logo {
  display: inline-block;
  flex: none;
}
</style>
