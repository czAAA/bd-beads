<script setup lang="ts">
import { computed, ref, toRaw, useId } from 'vue'
import { computeColorQuantities, estimatedGrams, formatGrams } from '../domain/beadQuantities'
import { resolvePatternBead, type Pattern } from '../domain/pattern'
import { useI18n } from '../i18n/useI18n'

const props = defineProps<{
  /** The Pattern whose bead counts are shown; without one the box just asks for a Pattern to be opened. */
  pattern?: Pattern
}>()

const { t } = useI18n()

// Read from the Pattern itself, not through the library's reactive wrapper: a Pattern is replaced whole by every edit, so
// its identity is all this needs to depend on, and reading each of tens of thousands of beads through a proxy is slow.
const quantities = computed(() => (props.pattern ? computeColorQuantities(toRaw(props.pattern)) : []))

/**
 * Estimated weight (ticket 155, CONTEXT.md): count × the Bead's average weight of one bead, worked out here and never
 * stored. A Pattern whose Bead is unknown or has no weight gets no weight column at all, rather than zeros.
 */
const gramsPerBead = computed(() => (props.pattern ? resolvePatternBead(props.pattern)?.gramsPerBead : undefined))

function weightOf(count: number): string | undefined {
  const grams = estimatedGrams(count, { gramsPerBead: gramsPerBead.value })
  return grams === undefined ? undefined : formatGrams(grams, t.value.quantities.gramsUnit)
}

const totalCount = computed(() => quantities.value.reduce((sum, quantity) => sum + quantity.count, 0))

const tooltipId = useId()
const tipOpen = ref(false)
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
          <th v-if="gramsPerBead !== undefined" class="bead-quantities__weight-heading">
            {{ t.quantities.weightHeading }}
            <span class="bead-quantities__info-wrap">
              <button
                type="button"
                class="bead-quantities__info"
                data-testid="quantities-weight-info"
                :aria-label="t.quantities.weightInfoButton"
                :aria-describedby="tooltipId"
                @mouseenter="tipOpen = true"
                @mouseleave="tipOpen = false"
                @focus="tipOpen = true"
                @blur="tipOpen = false"
                @keydown.escape="tipOpen = false"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 11v6" />
                  <path d="M12 7.5v.01" />
                </svg>
              </button>
              <span
                v-show="tipOpen"
                :id="tooltipId"
                class="bead-quantities__tooltip"
                role="tooltip"
                data-testid="quantities-weight-tooltip"
              >
                {{ t.quantities.weightInfo.replace('{grams}', String(gramsPerBead)) }}
              </span>
            </span>
          </th>
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
          <td v-if="gramsPerBead !== undefined" :data-testid="`quantity-weight-${quantity.colorId ?? quantity.hex}`">
            {{ weightOf(quantity.count) }}
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr data-testid="quantity-total-row">
          <th scope="row">{{ t.quantities.totalLabel }}</th>
          <td data-testid="quantity-total-count">{{ totalCount }}</td>
          <td v-if="gramsPerBead !== undefined" data-testid="quantity-total-weight">{{ weightOf(totalCount) }}</td>
        </tr>
      </tfoot>
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

.bead-quantities tfoot th,
.bead-quantities tfoot td {
  font-weight: var(--font-weight-bold);
  border-top: var(--border-width) solid var(--color-ink);
}

.bead-quantities td {
  font-variant-numeric: tabular-nums;
}

.bead-quantities__info-wrap {
  position: relative;
  display: inline-block;
  vertical-align: middle;
}

/* The same small warning-colored glyph as the Estimated size's (SizeControls.vue): an estimate, not a fact. */
.bead-quantities__info {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  color: var(--color-ink);
  background: var(--color-orange);
  border-radius: var(--radius-pill);
}

.bead-quantities__info:hover:not(:disabled) {
  color: var(--color-ink);
  background: var(--color-orange);
}

.bead-quantities__info svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.bead-quantities__tooltip {
  position: absolute;
  z-index: 10;
  top: calc(100% + 8px);
  right: 0;
  box-sizing: border-box;
  width: 260px;
  padding: 10px 14px;
  font-size: 14px;
  font-weight: normal;
  line-height: 1.4;
  color: var(--color-orange-ink);
  background: var(--color-orange);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-md);
}
</style>
