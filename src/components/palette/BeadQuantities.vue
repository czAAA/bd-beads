<script setup lang="ts">
import { computed, ref } from 'vue'
import { createPalette, defaultPaletteIds, projectPalette } from '../../domain/palette'
import { loadCatalogWhen, useBeadColorsList } from '../../composables/palette/useBeadColors'
import { gramsPerBead } from '../../domain/beads'
import { computeColorQuantities, estimatedGrams, formatGrams } from '../../domain/beadQuantities'
import { frameOf } from '../../domain/layerRecord'
import { resolveProjectBead } from '../../domain/projectBead'
import type { Project } from '../../domain/project'
import { groupThousands } from '../../domain/formatNumber'
import { useI18n } from '../../i18n/useI18n'
import AppNote from '../ui/AppNote.vue'
import AppIcon from '../ui/AppIcon.vue'
import PanelSection from '../shell/PanelSection.vue'
import type { LabelledColor } from '../../i18n/colorLabel'
import ColorLabel from './ColorLabel.vue'
import { fillBlanks } from '../../domain/fillBlanks'

// Beads needed (tickets 146, 178, 555; BeadsNeeded card): the Frame panel's last section, with the total and the weight
// ("1 512 · ≈ 7.6 g", none when the Bead has none) in its header. Five colors show, then "Show all {n} colors" opens the
// rest in place; a Note (ticket 328) says where the weight comes from. The rows stay a table, headings for screen readers only.
const props = defineProps<{
  /** The Project whose bead counts are shown; without one the box just asks for a Project to be opened. */
  project?: Project
}>()

const { t, locale } = useI18n()

// Read from the Project itself, not through the library's reactive wrapper: a Project is replaced whole by every edit,
// so its identity is all this needs to depend on, and reading each of tens of thousands of beads through a proxy is
// slow.
const palette = computed(() => (props.project ? projectPalette(props.project) : createPalette(defaultPaletteIds())))
const quantities = computed(() => (props.project ? computeColorQuantities(props.project, palette.value) : []))

/** How many colors show before "Show all". */
const SUMMARY_ROWS = 5

/** Estimated weight (ticket 155, CONTEXT.md): count × average weight of the woven layer's Bead, the Frame's (ticket
 * 0665), never stored; no weight column if the Bead has none. */
const projectBead = computed(() => (props.project ? resolveProjectBead(props.project) : undefined))
const averageGrams = computed(() => gramsPerBead(projectBead.value))

function weightOf(count: number): string | undefined {
  const grams = estimatedGrams(count, projectBead.value)
  return grams === undefined ? undefined : formatGrams(grams, t.value.quantities.gramsUnit, locale.value)
}

const totalCount = computed(() => quantities.value.reduce((sum, quantity) => sum + quantity.count, 0))

/** The palette color of a row, with its catalog code when it was picked from the Color catalog (ticket 538). */
const colorOf = (colorId: string | null, hex: string): LabelledColor => palette.value.byId(colorId) ?? { hex }

// A coded color is named from the Bead's Color catalog (ticket 0760), so the catalog loads once a row has a code.
const beadColors = useBeadColorsList()
loadCatalogWhen(beadColors, () => quantities.value.some((quantity) => !!colorOf(quantity.colorId, quantity.hex).code))

const expanded = ref(false)
const shown = computed(() => (expanded.value ? quantities.value : quantities.value.slice(0, SUMMARY_ROWS)))
const total = computed(() => {
  const grams = weightOf(totalCount.value)
  return `${groupThousands(totalCount.value, locale.value)}${grams ? ` · ≈ ${grams}` : ''}`
})
</script>

<template>
  <PanelSection id="frame:beads" :label="t.quantities.heading" keep-summary data-testid="bead-quantities">
    <template v-if="quantities.length > 0" #summary><span data-testid="quantity-total">{{ total }}</span></template>
    <div class="bead-quantities">
      <p v-if="!project" class="bead-quantities__empty" data-testid="quantities-no-project">
        {{ t.quantities.noProjectMessage }}
      </p>
      <p v-else-if="!frameOf(project)" class="bead-quantities__empty" data-testid="quantities-needs-frame">
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
            <th v-if="averageGrams !== undefined">{{ t.quantities.weightHeading }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="quantity in shown" :key="quantity.hex" class="bead-quantities__row" data-testid="quantity-row">
            <td class="bead-quantities__color">
              <span class="bead-quantities__swatch" :style="{ backgroundColor: quantity.hex }" />
              <ColorLabel :color="colorOf(quantity.colorId, quantity.hex)" :catalog="beadColors?.catalog.value" />
            </td>
            <td class="bead-quantities__count" :data-testid="`quantity-count-${quantity.colorId ?? quantity.hex}`">
              {{ groupThousands(quantity.count, locale) }}
            </td>
            <td v-if="averageGrams !== undefined" class="bead-quantities__grams" :data-testid="`quantity-weight-${quantity.colorId ?? quantity.hex}`">
              {{ weightOf(quantity.count) }}
            </td>
          </tr>
        </tbody>
      </table>
      <button v-if="quantities.length > SUMMARY_ROWS" class="ui-control bead-quantities__more" type="button" :aria-expanded="expanded" data-testid="quantities-toggle" @click="expanded = !expanded">
        <span>{{ expanded ? t.quantities.showFewer : fillBlanks(t.quantities.showAll, { count: quantities.length }) }}</span>
        <AppIcon name="chevron-down" :size="14" class="bead-quantities__chevron" :class="{ 'bead-quantities__chevron--up': expanded }" />
      </button>
      <AppNote v-if="quantities.length > 0 && averageGrams !== undefined" class="bead-quantities__note" data-testid="quantities-weight-note">
        {{ fillBlanks(t.quantities.weightInfo, { grams: String(averageGrams) }) }}
      </AppNote>
    </div>
  </PanelSection>
</template>

<style scoped>
.bead-quantities {
  padding: var(--space-4) var(--space-10);
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

.bead-quantities__row > td {
  height: var(--panel-item-height);
  padding: 0;
}

/* The color: a swatch, then its label (code and name, or hex), which wraps before the count gives way. */
.bead-quantities__color {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  min-width: 0;
  min-height: var(--panel-item-height);
  font: var(--type-control);
  color: var(--ink);
}

.bead-quantities__swatch {
  flex: none;
  width: var(--swatch-dot);
  height: var(--swatch-dot);
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
  width: 1%;
  padding-left: var(--space-8);
  color: var(--ink);
}

.bead-quantities__grams {
  min-width: var(--grams-width);
  padding-left: var(--space-8);
  font: var(--type-meta-small);
  color: var(--muted);
}

.bead-quantities__more {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-height: var(--panel-item-height);
  padding: 0;
  font: var(--type-control);
  color: var(--muted);
  background: none;
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.bead-quantities__more:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.bead-quantities__chevron--up {
  transform: rotate(180deg);
}

.bead-quantities__note {
  margin-top: var(--space-6);
}
</style>
