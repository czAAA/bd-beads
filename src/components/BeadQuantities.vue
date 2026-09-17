<script setup lang="ts">
import { computed } from 'vue'
import { computeColorQuantities } from '../domain/beadQuantities'
import type { Pattern } from '../domain/pattern'
import { useI18n } from '../i18n/useI18n'

const props = defineProps<{
  /** The Pattern whose bead counts are shown; without one the box just asks for a Pattern to be opened. */
  pattern?: Pattern
}>()

const { t } = useI18n()

const quantities = computed(() => (props.pattern ? computeColorQuantities(props.pattern) : []))
</script>

<template>
  <section class="bead-quantities" data-testid="bead-quantities">
    <h2>{{ t.quantities.heading }}</h2>

    <p v-if="!pattern" data-testid="quantities-no-pattern">
      {{ t.quantities.noPatternMessage }}
    </p>
    <p v-else-if="quantities.length === 0" data-testid="quantities-empty">
      {{ t.quantities.noColorsMessage }}
    </p>

    <table v-else>
      <thead>
        <tr>
          <th>{{ t.quantities.colorHeading }}</th>
          <th>{{ t.quantities.countHeading }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="quantity in quantities" :key="quantity.hex" data-testid="quantity-row">
          <td>
            <span class="bead-quantities__swatch" :style="{ backgroundColor: quantity.hex }" />
          </td>
          <td :data-testid="`quantity-count-${quantity.colorId ?? quantity.hex}`">
            {{ quantity.count }}
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.bead-quantities h2 {
  margin: 0 0 12px;
}

.bead-quantities table {
  border-collapse: collapse;
}

.bead-quantities th,
.bead-quantities td {
  padding: 6px 12px;
  text-align: left;
}

.bead-quantities th {
  font-weight: var(--font-weight-bold);
  border-bottom: var(--border-width) solid var(--color-ink);
}

.bead-quantities__swatch {
  display: inline-block;
  width: 24px;
  height: 24px;
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-md);
}
</style>
