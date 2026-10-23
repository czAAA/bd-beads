<script setup lang="ts">
import { computed, ref, toRaw } from 'vue'
import { createPalette, defaultPaletteIds } from '../../domain/palette'
import { listedColorName } from '../../i18n/colorName'
import { computeColorQuantities, estimatedGrams, formatGrams } from '../../domain/beadQuantities'
import { resolveProjectBead, type Project } from '../../domain/project'
import { decimalSign, groupThousands } from '../../domain/formatNumber'
import { useI18n } from '../../i18n/useI18n'
import AppNote from '../ui/AppNote.vue'
import ExpandablePanel from '../ui/ExpandablePanel.vue'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'

// Beads needed (tickets 146, 178; BeadsNeeded card): an expandable panel titled "Beads needed · 1 200 ×0.0108g≈13 g"
// (weight omitted when the Bead has none). Collapsed it shows the three most-needed colors, expanded every color;
// a Note (ticket 328) says where the weight comes from. The rows stay a table, headings for screen readers only.
const props = defineProps<{
  /** The Project whose bead counts are shown; without one the box just asks for a Project to be opened. */
  project?: Project
}>()

const { t, locale } = useI18n()

// Read from the Project itself, not through the library's reactive wrapper: a Project is replaced whole by every edit,
// so its identity is all this needs to depend on, and reading each of tens of thousands of beads through a proxy is
// slow.
const palette = computed(() => createPalette(props.project?.palette ?? defaultPaletteIds()))
const quantities = computed(() => (props.project ? computeColorQuantities(toRaw(props.project), palette.value) : []))

/** The 24" and larger tier (ticket 83; responsive.md, bp-desktop): the column has room for five rows before
 * expanding. */
const isDesktop = useMediaQuery('(min-width: 1920px)')

/** How many rows the collapsed summary holds (BeadsNeeded card: 3 rows of 32px, a 96px body; 5 rows, 160px, at the
 * 24" tier). */
const summaryRows = computed(() => (isDesktop.value ? 5 : 3))
const collapsedHeight = computed(() => (isDesktop.value ? 'var(--panel-body-height-desktop)' : 'var(--panel-body-height)'))

/** Estimated weight (ticket 155, CONTEXT.md): count × average bead weight, never stored; no weight column if the
 * Bead has none. */
const gramsPerBead = computed(() => (props.project ? resolveProjectBead(props.project)?.gramsPerBead : undefined))

function weightOf(count: number): string | undefined {
  const grams = estimatedGrams(count, { gramsPerBead: gramsPerBead.value })
  return grams === undefined ? undefined : formatGrams(grams, t.value.quantities.gramsUnit, locale.value)
}

// The Bead's average weight of one bead (ticket 178's header), in the language's decimal sign. Shown at full precision,
// not rounded like formatGrams's total: the catalog's weights sit close together (0.0108g, 0.0091g), so rounding would
// collapse them and break the header's count × average = total arithmetic.
const avgWeightLabel = computed(() => {
  const grams = gramsPerBead.value
  return grams === undefined ? undefined : `${String(grams).replace('.', decimalSign(locale.value))}${t.value.quantities.gramsUnit}`
})

const totalCount = computed(() => quantities.value.reduce((sum, quantity) => sum + quantity.count, 0))

function nameOf(colorId: string | null, hex: string): string {
  return listedColorName(t.value, palette.value.byId(colorId), hex)
}

const expanded = ref(false)
</script>

<template>
  <ExpandablePanel
    v-model:expanded="expanded"
    class="bead-quantities"
    :title="t.quantities.heading"
    :expandable="quantities.length > summaryRows"
    :collapsed-height="collapsedHeight"
    :empty="quantities.length === 0"
    data-testid="bead-quantities"
  >
    <template v-if="quantities.length > 0" #suffix>
      <span class="bead-quantities__part"
        >· <span data-testid="quantity-total-count">{{ groupThousands(totalCount, locale) }}</span
        ><template v-if="gramsPerBead !== undefined"
          >×<span data-testid="quantity-avg-weight">{{ avgWeightLabel }}</span
          >≈<span data-testid="quantity-total-weight">{{ weightOf(totalCount) }}</span></template
        ></span
      >
    </template>

    <template v-if="quantities.length > 0 && gramsPerBead !== undefined" #note>
      <AppNote class="bead-quantities__note" data-testid="quantities-weight-note">
        {{ t.quantities.weightInfo.replace('{grams}', String(gramsPerBead)) }}
      </AppNote>
    </template>

    <p v-if="!project" class="bead-quantities__empty" data-testid="quantities-no-project">
      {{ t.quantities.noProjectMessage }}
    </p>
    <p v-else-if="!project.frame" class="bead-quantities__empty" data-testid="quantities-needs-frame">
      {{ t.frame.countNeedsFrame }}
    </p>
    <p v-else-if="quantities.length === 0" class="bead-quantities__empty" data-testid="quantities-empty">
      {{ t.quantities.noColorsMessage }}
    </p>

    <table v-else class="bead-quantities__table">
      <thead class="bead-quantities__headings">
        <tr>
          <th>{{ t.quantities.colorHeading }}</th>
          <th>{{ t.quantities.countHeading }}</th>
          <th v-if="gramsPerBead !== undefined">{{ t.quantities.weightHeading }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="quantity in quantities" :key="quantity.hex" class="bead-quantities__row" data-testid="quantity-row">
          <td class="bead-quantities__color">
            <span class="bead-quantities__swatch" :style="{ backgroundColor: quantity.hex }" />
            {{ nameOf(quantity.colorId, quantity.hex) }}
          </td>
          <td class="bead-quantities__count" :data-testid="`quantity-count-${quantity.colorId ?? quantity.hex}`">
            {{ groupThousands(quantity.count, locale) }}
          </td>
          <td
            v-if="gramsPerBead !== undefined"
            class="bead-quantities__grams"
            :data-testid="`quantity-weight-${quantity.colorId ?? quantity.hex}`"
          >
            {{ weightOf(quantity.count) }}
          </td>
        </tr>
      </tbody>
    </table>
  </ExpandablePanel>
</template>

<style scoped>
/* The title breaks only between its parts, never inside "≈ 6 g". */
.bead-quantities__part {
  white-space: nowrap;
}

.bead-quantities__empty {
  margin: 0;
  font: var(--type-meta);
  font-family: var(--font-sans);
  color: var(--muted);
}

.bead-quantities__table {
  width: 100%;
  border-collapse: collapse;
}

/* Column headings for screen readers only: the rows speak for themselves on screen. */
.bead-quantities__headings {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* A row: 32px, a line-soft rule above, the swatch and name, then the count and the weight on the right. */
.bead-quantities__row > td {
  height: var(--panel-row-height);
  padding: 0;
  border-top: 1px solid var(--line-soft);
}

.bead-quantities__color {
  font: var(--type-body);
  color: var(--body);
  white-space: nowrap;
}

.bead-quantities__swatch {
  display: inline-block;
  width: var(--swatch-dot);
  height: var(--swatch-dot);
  margin-right: var(--space-10);
  vertical-align: -1px;
  border-radius: var(--swatch-dot-radius);
  box-shadow: inset 0 0 0 1px var(--swatch-edge);
}

.bead-quantities__count,
.bead-quantities__grams {
  font: var(--type-meta);
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

.bead-quantities__count {
  width: 100%;
  color: var(--ink);
}

.bead-quantities__grams {
  min-width: var(--grams-width);
  padding-left: var(--space-8);
  color: var(--muted);
}

/* Ticket 450: the canvas box is 12px narrower each side, so on a phone the weight column gives up its reserved width
 * (a table column is as wide as its widest cell anyway). */
@media (max-width: 30rem) {
  .bead-quantities__grams {
    min-width: 0;
    padding-left: var(--space-4);
  }

  .bead-quantities__swatch {
    margin-right: var(--space-6);
  }
}

.bead-quantities__note {
  margin-top: var(--space-10);
}
</style>
