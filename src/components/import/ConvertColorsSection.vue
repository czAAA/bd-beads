<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useConvertSheet } from '../../composables/import/convertSheet'
import { useConvertImageWizardState } from '../../composables/import/useConvertImageWizard'
import type { ColorSource } from '../../domain/convertColors'
import { fillBlanks } from '../../domain/fillBlanks'
import { groupThousands } from '../../domain/formatNumber'
import { beadLabel } from '../../domain/beads'
import { measuredColorSource } from '../../domain/colorCatalog'
import { beadPaletteNote } from '../../i18n/measuredColorWords'
import { plural, pluralForm } from '../../i18n/plural'
import { useI18n } from '../../i18n/useI18n'
import BeadSwatchChip from '../palette/BeadSwatchChip.vue'
import AppMenuItem from '../ui/AppMenuItem.vue'
import AppNote from '../ui/AppNote.vue'
import InfoButton from '../ui/InfoButton.vue'
import MenuButton from '../ui/MenuButton.vue'
import ConvertFinishFilter from './ConvertFinishFilter.vue'
import ConvertSheetHead from './ConvertSheetHead.vue'
import FoundColorRow from './FoundColorRow.vue'
import FoundColorsHeader from './FoundColorsHeader.vue'

// The Colors popover's body, from "More for the colors" (ConvertImage card DS-1, ticket 0896; tickets 0747, 0758, 0863):
// "Colors" and match to, each with what it does behind an Info button, then Color by color already open, its list
// scrolling inside the popover: a row per bead color the found colors become, one Change open at a time.
const { t, locale } = useI18n()
const wizard = useConvertImageWizardState()
const words = computed(() => t.value.convertImage.wizard)
const sourceLabelId = useId()
/** In a docked layout's sheet (DS-4, ticket 0919): its head holds Back, "Colors" with its (i), the count and Close. */
const sheet = useConvertSheet()

/** The Bead as the palette's Bead colors entry names it: its maker, name and shape, with no finish. */
const beadName = computed(() => beadLabel(wizard.bead.value))
/** Where the Bead's catalog's colors were read from (tickets 0886, 1068): the palette's note says so in its own words. */
const measuredFrom = computed(() => measuredColorSource(wizard.beadCatalog.value))
/** match to's menu (ConvertImage card DS-2): the Bead's palette with its count, Default Palette and Exact. */
const sourceOptions = computed<{ value: ColorSource; label: string; meta?: string }[]>(() => [
  ...(wizard.hasCatalog.value
    ? [{ value: 'bead-colors' as const, label: fillBlanks(words.value.beadPalette, { bead: beadName.value }), meta: count(wizard.beadTargets.value.length) }]
    : []),
  { value: 'default' as const, label: words.value.defaultPalette },
  { value: 'exact' as const, label: words.value.exact },
])
const sourceLabel = computed(() => sourceOptions.value.find((option) => option.value === wizard.source.value)?.label ?? '')
const count = (n: number) => groupThousands(n, locale.value)
const colorsMaxText = computed(() => count(wizard.colorsMax.value))
/** Under Exact a color is not a bead to buy, so the Info says what it is instead (tickets 0863, 0894). */
const colorsInfo = computed(() => {
  const exact = wizard.source.value === 'exact'
  const capped = wizard.colorsCapped.value
  const hint = exact ? (capped ? words.value.colorsHintExactCapped : words.value.colorsHintExact) : capped ? words.value.colorsHintCapped : words.value.colorsHint
  return { label: fillBlanks(words.value.whatDoes, { name: words.value.colorsLabel }), body: fillBlanks(hint, { n: colorsMaxText.value }) }
})
/** Where colors come from: each choice's note led by its name, the three in one Info button (ticket 0896). */
const sourceNote = computed(() =>
  sourceOptions.value
    .map((option) => {
      const note =
        option.value === 'bead-colors' ? fillBlanks(beadPaletteNote(t.value, measuredFrom.value), { bead: beadName.value })
        : option.value === 'default' ? words.value.defaultPaletteNote
        : words.value.exactNote
      return `${option.label}: ${note}`
    })
    .concat(wizard.hasCatalog.value ? [words.value.finish.note] : [])
    .join(' '),
)

/** The count line: the source's codes in the Finishes on (ticket 0901), as bead colors ("1 191 bead colors in size 11/0", ticket 0966). */
const codes = computed(() => fillBlanks(pluralForm(locale.value, wizard.codesLeft.value, words.value.codesInSize), { size: wizard.bead.value.size, count: count(wizard.codesLeft.value) }))
/** The count line with how many of those codes are measured (ticket 0905), as the legend reads it. */
const codesLine = computed(() => `${codes.value} · ${fillBlanks(words.value.measuredIn, { n: count(wizard.measuredLeft.value) })}`)
/** Fewer codes left in the Finishes on than colors asked: as many colors come out, and the line says so (DS-2). */
const tooFew = computed(() =>
  wizard.finishesShort.value
    ? fillBlanks(pluralForm(locale.value, wizard.codesLeft.value, words.value.finish.tooFew), { asked: count(wizard.maxColors.value) }, { count: count(wizard.codesLeft.value) })
    : undefined,
)

/** Color by color's count: the colors the beads use, and how many found colors are empty when any are. */
const summary = computed(() => {
  const empty = wizard.emptyColorCount.value
  return [plural(locale.value, wizard.usedColorCount.value, words.value.colorsCount), ...(empty > 0 ? [fillBlanks(words.value.emptyCount, { n: empty })] : [])].join(' · ')
})

/** The one row whose Remap picker is open, by a found color it joins, so it stays open when a pick joins it to another. */
const remapping = ref<string>()
</script>

<template>
  <div class="convert-colors" :class="{ 'convert-colors--sheet': sheet }" data-testid="convert-colors">
    <ConvertSheetHead
      v-if="sheet"
      class="convert-colors__sheet-head"
      :title="words.colorsLabel"
      :back="words.backToColorsCount"
      back-testid="convert-colors-back"
      :value="summary"
      value-testid="convert-found-count"
      @back="wizard.togglePopover('colors-count')"
    >
      <InfoButton :label="colorsInfo.label" :body="colorsInfo.body" data-testid="convert-colors-slider-info" />
    </ConvertSheetHead>
    <div class="convert-colors__head">
      <span v-if="!sheet" class="convert-colors__title">
        {{ words.colorsLabel }}
        <InfoButton :label="colorsInfo.label" :body="colorsInfo.body" data-testid="convert-colors-slider-info" />
      </span>
      <span class="convert-colors__label convert-colors__source-head">
        <span :id="sourceLabelId">{{ words.matchTo }}</span>
        <InfoButton :label="words.whereColorsFrom" :body="sourceNote" data-testid="convert-color-source-info" />
      </span>
      <div class="convert-colors__source">
        <MenuButton :label="sourceLabel" :aria-describedby="sourceLabelId" data-wrap-ok data-testid="convert-color-source">
          <AppMenuItem
            v-for="option in sourceOptions"
            :key="option.value"
            :chosen="option.value === wizard.source.value"
            class="convert-colors__source-item"
            :data-value="option.value"
            data-testid="convert-color-source-option"
            @select="wizard.setSource(option.value)"
          >
            <span>{{ option.label }}</span>
            <span v-if="option.meta" class="convert-colors__source-meta">{{ option.meta }}</span>
          </AppMenuItem>
        </MenuButton>
        <ConvertFinishFilter :codes="codes" />
      </div>
      <span v-if="wizard.source.value === 'bead-colors'" class="convert-colors__counts">
        <span class="convert-colors__codes" data-testid="convert-codes">{{ codesLine }}</span>
        <span class="convert-colors__legend" data-testid="convert-legend">
          <BeadSwatchChip :size="12" :approximate="true" :tip="false" />
          {{ t.palette.beadColors.legendApproximate }}
        </span>
      </span>
      <span v-if="tooFew" class="convert-colors__too-few" role="status" data-testid="convert-too-few">{{ tooFew }}</span>
      <AppNote v-if="wizard.source.value === 'bead-colors' && wizard.catalogState.value === 'failed'" role="alert" data-testid="convert-catalog-failed">
        {{ t.palette.beadColors.failed }}
      </AppNote>
    </div>

    <div v-if="!sheet" class="convert-colors__found-head">
      <span class="convert-colors__title">{{ words.colorByColor }}</span>
      <span class="convert-colors__count" role="status" data-testid="convert-found-count">{{ summary }}</span>
    </div>
    <div class="convert-colors__table">
      <FoundColorsHeader />
      <ul class="convert-colors__list" data-testid="convert-found-colors">
        <FoundColorRow
          v-for="row in wizard.rows.value"
          :key="row.pictureHexes[0]"
          :row="row"
          :open="!!remapping && row.pictureHexes.includes(remapping)"
          @toggle-remap="remapping = remapping && row.pictureHexes.includes(remapping) ? undefined : row.pictureHexes[0]"
        />
      </ul>
    </div>
  </div>
</template>

<style scoped>
/* The head stays; the list under it scrolls inside the popover. */
.convert-colors {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}

.convert-colors__head {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-14) var(--space-16) var(--space-12);
  border-bottom: 1px solid var(--line-soft);
}

.convert-colors__title {
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
  font: var(--type-control);
  font-weight: 600;
  color: var(--ink);
}

.convert-colors__label {
  font: var(--type-label);
  color: var(--muted);
}

.convert-colors__source-head {
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
}

/* match to fills the row beside Finish (DS-2); each item's count stands at its right. */
.convert-colors__source {
  display: flex;
  gap: var(--space-8);
  align-items: flex-start;
}

.convert-colors__source > :deep(.menu-button) {
  flex: 1 1 auto;
  min-width: 0;
}

/* A long source wraps to a second line rather than being cut (DS-2). */
.convert-colors__source > :deep(.menu-button) > .app-button {
  width: 100%;
  height: auto;
  min-height: var(--control-height);
  padding: var(--space-6) var(--space-8) var(--space-6) var(--space-10);
  text-align: left;
  white-space: normal;
  overflow-wrap: anywhere;
}

.convert-colors__source :deep(.app-button) {
  justify-content: space-between;
}

.convert-colors__source-item :deep(.app-menu-item__label) {
  display: flex;
  flex: 1 1 auto;
  gap: var(--space-12);
  align-items: baseline;
  justify-content: space-between;
}

.convert-colors__source-meta {
  font: var(--type-meta-small);
  color: var(--muted);
}

.convert-colors__counts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4) var(--space-12);
  justify-content: space-between;
}

.convert-colors__legend {
  display: inline-flex;
  gap: var(--space-6);
  align-items: center;
  font: var(--type-meta-small);
  color: var(--muted);
}

.convert-colors__codes {
  font: var(--type-meta-small);
  color: var(--muted);
}

.convert-colors__too-few {
  font: var(--type-control);
  font-weight: 500;
  color: var(--ink);
}

.convert-colors__found-head {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4) var(--space-12);
  padding: var(--space-12) var(--space-16) var(--space-8);
}

.convert-colors__count {
  font: var(--type-meta);
  color: var(--muted);
}

/* The found-colors table: its heading row and rows take their narrow columns by its width (FoundColorRow card,
 * ticket 0782). Only the list scrolls. */
.convert-colors__table {
  container: found-colors / inline-size;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--space-4);
  min-height: 0;
  padding: 0 var(--space-16) var(--space-12);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}

/* Under 1024 px or in portrait the popover stands in the column's flow, which scrolls: the list need not. */
@media (max-width: 63.99rem), (orientation: portrait) {
  .convert-colors__table {
    overflow-y: visible;
  }
}

/* In a sheet (DS-4, ticket 0919) the sheet scrolls: its head stays, the table's heading row under it; the rows a
 * sheet's own columns. */
.convert-colors--sheet {
  --found-header-top: var(--convert-sheet-head);
}

.convert-colors__sheet-head {
  padding-inline: var(--space-16);
}

.convert-colors--sheet .convert-colors__head {
  padding-block: 0 var(--space-8);
  border-bottom: 0;
}

.convert-colors--sheet .convert-colors__source-head {
  min-height: var(--space-24);
}

.convert-colors--sheet .convert-colors__table {
  overflow-y: visible;
}

.convert-colors__list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
}
</style>
