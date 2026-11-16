<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import AppTooltip from '../ui/AppTooltip.vue'

// A Bead color's swatch with the mark of whether it is measured (ConvertImage card DS-2, ticket 0905, decision D-1):
// measured is the plain swatch, approximate has a 1px dashed `field-line` outline 1px outside it. A shape, so it reads
// without color. `approximate` unset is a color that is not a bead from a catalog: no mark and no Tooltip.
const props = withDefaults(
  defineProps<{
    hex?: string
    /** Square side in px: 24 in rows and grids, 16 in the picker's head, 12 in the legend. */
    size?: 12 | 16 | 24
    approximate?: boolean
    /** Whether hover, focus and long-press say what the mark means. */
    tip?: boolean
  }>(),
  { hex: undefined, size: 24, approximate: undefined, tip: true },
)

const { t } = useI18n()
const words = computed(() => t.value.palette.beadColors)
const tooltip = computed(() =>
  props.approximate
    ? { name: words.value.approximateName, body: words.value.approximateBody, announce: false }
    : { name: words.value.measuredName, body: words.value.measuredBody, announce: false },
)
</script>

<template>
  <AppTooltip v-if="tip && approximate !== undefined" v-bind="tooltip" class="bead-swatch-chip__tip">
    <span
      class="bead-swatch-chip"
      :class="[`bead-swatch-chip--${size}`, { 'bead-swatch-chip--approximate': approximate }]"
      :style="hex ? { backgroundColor: hex } : undefined"
      :data-approximate="approximate || undefined"
      aria-hidden="true"
    />
  </AppTooltip>
  <span
    v-else
    class="bead-swatch-chip"
    :class="[`bead-swatch-chip--${size}`, { 'bead-swatch-chip--approximate': approximate }]"
    :style="hex ? { backgroundColor: hex } : undefined"
    :data-approximate="approximate || undefined"
    aria-hidden="true"
  />
</template>

<style scoped>
.bead-swatch-chip {
  display: block;
  flex: none;
  box-sizing: border-box;
  width: var(--bead-swatch);
  height: var(--bead-swatch);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--swatch-edge);
}

.bead-swatch-chip--16 {
  width: var(--bead-swatch-sm);
  height: var(--bead-swatch-sm);
  border-radius: var(--radius-xs);
}

.bead-swatch-chip--12 {
  width: var(--bead-swatch-xs);
  height: var(--bead-swatch-xs);
  border-radius: var(--radius-xs);
  background: var(--elevated);
}

.bead-swatch-chip--approximate {
  outline: 1px dashed var(--field-line);
  outline-offset: 1px;
}

.bead-swatch-chip__tip {
  display: inline-flex;
}
</style>
