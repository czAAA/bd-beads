<script setup lang="ts">
import { computed } from 'vue'
import type { QrMatrix } from '../../domain/qrExport'

/**
 * Renders a QrMatrix (domain/qrExport.ts) as an inline SVG (ticket 68) -- one `<rect>` per dark module plus a quiet
 * zone margin, rather than a canvas or an `<img>`, so the code stays crisp at any display size and needs no async
 * image decode of its own to show.
 */
const props = defineProps<{ matrix: QrMatrix }>()

const MODULE_SIZE = 4
/** Blank modules of margin on every side -- a real scanner needs one to lock onto the code at all. */
const QUIET_ZONE_MODULES = 4

const side = computed(() => (props.matrix.size + QUIET_ZONE_MODULES * 2) * MODULE_SIZE)

const darkModules = computed(() => {
  const cells: { x: number; y: number }[] = []
  for (let row = 0; row < props.matrix.size; row++) {
    for (let column = 0; column < props.matrix.size; column++) {
      if (props.matrix.isDark(row, column)) {
        cells.push({
          x: (column + QUIET_ZONE_MODULES) * MODULE_SIZE,
          y: (row + QUIET_ZONE_MODULES) * MODULE_SIZE,
        })
      }
    }
  }
  return cells
})
</script>

<template>
  <svg
    class="qr-code"
    data-testid="qr-code"
    :viewBox="`0 0 ${side} ${side}`"
    :width="side"
    :height="side"
    role="img"
  >
    <rect :width="side" :height="side" fill="#ffffff" />
    <rect
      v-for="(cell, index) in darkModules"
      :key="index"
      :x="cell.x"
      :y="cell.y"
      :width="MODULE_SIZE"
      :height="MODULE_SIZE"
      fill="#000000"
      data-testid="qr-code-module"
    />
  </svg>
</template>

<style scoped>
.qr-code {
  display: block;
}
</style>
