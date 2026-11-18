<script setup lang="ts">
import { computed, ref } from 'vue'
import { loadCatalogWhen, useBeadColorsList } from '../../composables/palette/useBeadColors'
import { useBeadsNeeded } from '../../composables/palette/useBeadsNeeded'
import { frameOf } from '../../domain/layerRecord'
import { backBeadsAt, pieceFaceOf, wholePieceOf } from '../../domain/pieceFaces'
import type { Project } from '../../domain/project'
import { decimalSign, groupThousands } from '../../domain/formatNumber'
import { faceInfoWords } from '../../i18n/pieceFaceWords'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from '../ui/AppIcon.vue'
import InfoButton from '../ui/InfoButton.vue'
import PanelSection from '../shell/PanelSection.vue'
import type { ColorCatalog } from '../../domain/colorCatalog'
import type { LabelledColor } from '../../i18n/colorLabel'
import ColorLabel from './ColorLabel.vue'
import { fillBlanks } from '../../domain/fillBlanks'

// Beads needed (tickets 146, 178, 555, 0974; BeadsNeeded card): the Frame panel's section under its Export row (0932), the total
// and weight in its header beside an Info button on how they are worked out, the Bead to buy under it, then the rows (a
// table, five before "Show all colors (n)") and, when a color has no catalog code, a line saying they are Palette colors.
const props = defineProps<{
  /** The Project whose bead counts are shown; without one the box just asks for a Project to be opened. */
  project?: Project
  /** The Color catalog that names a coded color, when the place already holds it (Convert image's Review); else the app shell's Bead colors. */
  catalog?: ColorCatalog
  /** Closed every time it opens, kept nowhere (Convert image's Review, ticket 0759). */
  closedFirst?: boolean
}>()

const { t, locale } = useI18n()

/** How many colors show before "Show all". */
const SUMMARY_ROWS = 5

const { palette, quantities, averageGrams, beadName, weightOf, count: totalCount, total } = useBeadsNeeded(() => props.project)
/** The weight's Info button: how it is worked out, the average with the language's decimal sign (ticket 0852). */
const weightInfo = computed(() =>
  averageGrams.value === undefined ? undefined : fillBlanks(t.value.quantities.weightInfo, { grams: String(averageGrams.value).replace('.', decimalSign(locale.value)) }),
)

/** The palette color of a row, with its catalog code when it was picked from the Color catalog (ticket 538). */
const colorOf = (colorId: string | null, hex: string): LabelledColor => palette.value.byId(colorId) ?? { hex }

// A coded color is named from the Bead's Color catalog (ticket 0760), so the catalog loads once a row has a code.
const beadColors = useBeadColorsList()
loadCatalogWhen(beadColors, () => quantities.value.some((quantity) => !!colorOf(quantity.colorId, quantity.hex).code))

/** A row's color has no catalog code (ticket 0974): it is a Palette color (or a Custom one), so no bead is named for it. */
const hasPaletteColors = computed(() => quantities.value.some((quantity) => !colorOf(quantity.colorId, quantity.hex).code))

/** The header's Info button: how the weight is worked out, then why the colors have no codes when they have none. */
const info = computed(() => {
  const words = t.value.quantities
  if (!hasPaletteColors.value) return weightInfo.value ? { label: words.weightInfoLabel, body: weightInfo.value } : undefined
  return { label: words.infoLabel, body: [weightInfo.value, words.paletteInfo].filter(Boolean).join(' ') }
})

/** On a Star the counts are the whole star (ticket 0875): its back is beaded as the face's mirror, and a line says so. */
const countsBack = computed(() => {
  const frame = props.project && frameOf(props.project)
  return !!frame && backBeadsAt(frame) !== undefined
})

/** On a Kaleidocycle the counts are one face (ticket 0876): the line under them gives the whole piece's, every face
 * beaded like this one, with an Info button saying what they cover, then a line each for its triangles and the beads that
 * join them, a 15/0 named by its size (ticket 0877). */
const piece = computed(() => {
  const frame = props.project && frameOf(props.project)
  const face = pieceFaceOf(frame?.shape)
  const whole = frame && wholePieceOf(frame, totalCount.value)
  if (!face || !whole) return undefined
  const words = t.value.quantities
  const grouped = (beads: number) => groupThousands(beads, locale.value)
  const lines = [{ id: 'triangles' as const, count: whole.triangles, size: undefined }, ...whole.joins].map(({ id, count, size }) => ({
    id,
    label: size ? `${words.pieceLines[id]} · ${size}` : words.pieceLines[id],
    count: grouped(count),
  }))
  return { line: fillBlanks(words.pieceTotal, { faces: face.faces, count: grouped(whole.beads), small: grouped(whole.small) }), info: faceInfoWords(t.value, face), lines }
})

const expanded = ref(false)
const shown = computed(() => (expanded.value ? quantities.value : quantities.value.slice(0, SUMMARY_ROWS)))
</script>

<template>
  <PanelSection id="frame:beads" :label="t.quantities.heading" :summary="total || undefined" keep-summary :closed-first="closedFirst" data-testid="bead-quantities">
    <template v-if="quantities.length > 0 && info" #info>
      <InfoButton :label="info.label" :body="info.body" data-testid="quantities-info" />
    </template>
    <template v-if="quantities.length > 0" #summary><span data-testid="quantity-total">{{ total }}</span></template>
    <div class="bead-quantities">
      <p v-if="beadName" class="bead-quantities__bead" data-testid="quantities-bead">{{ beadName }}</p>
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
              <ColorLabel :color="colorOf(quantity.colorId, quantity.hex)" :catalog="catalog ?? beadColors?.catalog.value" />
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
      <p v-if="hasPaletteColors" class="bead-quantities__note" data-testid="quantities-palette">{{ t.quantities.paletteNote }}</p>
      <p v-if="piece && quantities.length > 0" class="bead-quantities__piece" data-testid="quantities-piece">
        <span>{{ piece.line }}</span>
        <InfoButton :label="t.starters.faceInfoLabel" :body="piece.info" data-testid="quantities-piece-info" />
      </p>
      <ul v-if="piece && quantities.length > 0" class="bead-quantities__piece-lines">
        <li v-for="line in piece.lines" :key="line.id" class="bead-quantities__piece-line" data-testid="quantities-piece-line">
          <span>{{ line.label }}</span>
          <span class="bead-quantities__piece-count">{{ line.count }}</span>
        </li>
      </ul>
      <p v-if="countsBack && quantities.length > 0" class="bead-quantities__piece" data-testid="quantities-front-back">{{ t.quantities.frontBackNote }}</p>
    </div>
  </PanelSection>
</template>

<style scoped>
.bead-quantities {
  padding: var(--space-4) var(--space-10);
}

.bead-quantities__bead,
.bead-quantities__note {
  margin: 0;
  font: var(--type-meta);
  font-family: var(--font-sans);
  color: var(--muted);
}

.bead-quantities__bead {
  margin-bottom: var(--space-4);
}

.bead-quantities__piece {
  display: flex;
  gap: var(--space-4);
  align-items: center;
  margin: 0;
  font: var(--type-meta);
  font-family: var(--font-sans);
  color: var(--muted);
}

/* The whole piece's lines (ticket 0877): a label and its count, the count right-aligned as the rows' are. */
.bead-quantities__piece-lines {
  margin: var(--space-4) 0 0;
  padding: 0;
  list-style: none;
  font: var(--type-meta);
  font-family: var(--font-sans);
  color: var(--muted);
}

.bead-quantities__piece-line {
  display: flex;
  justify-content: space-between;
  gap: var(--space-8);
}

.bead-quantities__piece-count {
  font-variant-numeric: tabular-nums;
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
  border-radius: var(--radius-2xs);
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
</style>
