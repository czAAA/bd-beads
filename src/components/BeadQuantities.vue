<script setup lang="ts">
import { computed } from 'vue'
import { beadLabel, type Bead } from '../domain/beads'
import { computeColorQuantities, type ColorBeadDefaults } from '../domain/beadMapping'
import type { Pattern } from '../domain/pattern'
import { useI18n } from '../i18n/useI18n'

const props = defineProps<{
  pattern: Pattern
  beads: Bead[]
  /** The universal color-to-bead mapping every Pattern starts from (ADR 0002). */
  defaults: ColorBeadDefaults
}>()

const emit = defineEmits<{
  /** Repoints a Palette color at a different Bead everywhere; no bead unmaps it. */
  'set-default': [colorId: string, beadId: string | null]
  /** Repoints a Palette color for this Pattern alone; no bead falls back to the default again. */
  'set-override': [colorId: string, beadId: string | null]
}>()

const { t } = useI18n()

const quantities = computed(() => computeColorQuantities(props.pattern))

/** A <select> can only carry strings, so "mapped to nothing" travels as the empty option's value. */
function toBeadId(value: string): string | null {
  return value === '' ? null : value
}
</script>

<template>
  <section class="bead-quantities" data-testid="bead-quantities">
    <h2>{{ t.quantities.heading }}</h2>

    <p v-if="quantities.length === 0" data-testid="quantities-empty">
      {{ t.quantities.emptyMessage }}
    </p>

    <table v-else>
      <thead>
        <tr>
          <th>{{ t.quantities.colorHeading }}</th>
          <th>{{ t.quantities.countHeading }}</th>
          <th>{{ t.quantities.defaultBeadHeading }}</th>
          <th>{{ t.quantities.patternBeadHeading }}</th>
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
          <template v-if="quantity.colorId !== null">
            <td>
              <select
                :data-testid="`quantity-default-${quantity.colorId}`"
                :aria-label="`${t.quantities.defaultBeadHeading}: ${quantity.hex}`"
                :value="defaults[quantity.colorId] ?? ''"
                @change="
                  emit(
                    'set-default',
                    quantity.colorId!,
                    toBeadId(($event.target as HTMLSelectElement).value),
                  )
                "
              >
                <option value="">{{ t.quantities.unmappedOption }}</option>
                <option v-for="bead in beads" :key="bead.id" :value="bead.id">
                  {{ beadLabel(bead) }}
                </option>
              </select>
            </td>
            <td>
              <select
                :data-testid="`quantity-override-${quantity.colorId}`"
                :aria-label="`${t.quantities.patternBeadHeading}: ${quantity.hex}`"
                :value="pattern.colorBeadOverrides[quantity.colorId] ?? ''"
                @change="
                  emit(
                    'set-override',
                    quantity.colorId!,
                    toBeadId(($event.target as HTMLSelectElement).value),
                  )
                "
              >
                <option value="">{{ t.quantities.useDefaultOption }}</option>
                <option v-for="bead in beads" :key="bead.id" :value="bead.id">
                  {{ beadLabel(bead) }}
                </option>
              </select>
            </td>
          </template>
          <td v-else colspan="2" data-testid="quantity-unknown-color">
            {{ t.quantities.unknownColorLabel }}
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
