<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue'
import { useConvertImageWizardState } from '../../composables/import/useConvertImageWizard'
import type { ColorSource } from '../../domain/convertColors'
import { fillBlanks } from '../../domain/fillBlanks'
import { groupThousands } from '../../domain/formatNumber'
import { beadLabel } from '../../domain/beads'
import { plural } from '../../i18n/plural'
import { useI18n } from '../../i18n/useI18n'
import AppMenuItem from '../ui/AppMenuItem.vue'
import AppNote from '../ui/AppNote.vue'
import InfoButton from '../ui/InfoButton.vue'
import MenuButton from '../ui/MenuButton.vue'
import ConvertMyBeadsView from './ConvertMyBeadsView.vue'
import FoundColorRow from './FoundColorRow.vue'
import FoundColorsHeader from './FoundColorsHeader.vue'

// The Colors popover's body, from "More for the colors" (ConvertImage card DS-1, ticket 0896; tickets 0747, 0758, 0863):
// "Colors" and match to, each with what it does behind an Info button, then Color by color already open, its list
// scrolling inside the popover: a row per bead color the found colors become, one Change open at a time.
const { t, locale } = useI18n()
const wizard = useConvertImageWizardState()
const words = computed(() => t.value.convertImage.wizard)
const sourceLabelId = useId()

/** The Bead as the palette's Bead colors entry names it: its maker, name and shape, with no finish. */
const beadName = computed(() => beadLabel(wizard.bead.value))
const myWords = computed(() => words.value.myBeads)
/** match to's menu (ConvertImage card DS-2): the Bead's palette and My beads (once the list has a code) with their counts,
 * Default Palette and Exact. */
const sourceOptions = computed<{ value: ColorSource; label: string; meta?: string }[]>(() => [
  ...(wizard.hasCatalog.value
    ? [{ value: 'bead-colors' as const, label: fillBlanks(words.value.beadPalette, { bead: beadName.value }), meta: count(wizard.beadTargets.value.length) }]
    : []),
  ...(wizard.myBeadsOffered.value ? [{ value: 'my-beads' as const, label: myWords.value.name, meta: count(wizard.myBeadsCodes.value.length) }] : []),
  { value: 'default' as const, label: words.value.defaultPalette },
  { value: 'exact' as const, label: words.value.exact },
])
const sourceLabel = computed(() => sourceOptions.value.find((option) => option.value === wizard.source.value)?.label ?? '')
/** The menu's last item, under a rule: Edit My beads with its count, or Choose My beads while the list is empty. */
const myBeadsItem = computed(() => {
  const codes = wizard.myBeadsCodes.value.length
  return codes > 0
    ? { label: myWords.value.edit, meta: plural(locale.value, codes, myWords.value.codes) }
    : { label: myWords.value.choose, meta: myWords.value.noCodes }
})

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
        option.value === 'bead-colors' ? fillBlanks(words.value.beadPaletteNote, { bead: beadName.value })
        : option.value === 'my-beads' ? fillBlanks(myWords.value.note, { size: wizard.bead.value.size })
        : option.value === 'default' ? words.value.defaultPaletteNote
        : words.value.exactNote
      return `${option.label}: ${note}`
    })
    .join(' '),
)

const codes = computed(() =>
  wizard.source.value === 'my-beads'
    ? fillBlanks(myWords.value.codesInList, { count: count(wizard.myBeadsTargets.value.length) })
    : fillBlanks(words.value.codesInSize, { size: wizard.bead.value.size, count: count(wizard.beadTargets.value.length) }),
)

/** The popover's two views (DS-2): Colors, or My beads from the menu's last item; Back returns to match to. */
const view = ref<'colors' | 'my-beads'>('colors')
const rootEl = ref<HTMLElement>()
async function backToColors() {
  view.value = 'colors'
  await nextTick()
  rootEl.value?.querySelector<HTMLElement>('[data-testid="convert-color-source"]')?.focus()
}

/** Color by color's count: the colors the beads use, and how many found colors are empty when any are. */
const summary = computed(() => {
  const empty = wizard.emptyColorCount.value
  return [plural(locale.value, wizard.usedColorCount.value, words.value.colorsCount), ...(empty > 0 ? [fillBlanks(words.value.emptyCount, { n: empty })] : [])].join(' · ')
})

/** The one row whose Remap picker is open, by a found color it joins, so it stays open when a pick joins it to another. */
const remapping = ref<string>()
</script>

<template>
  <div ref="rootEl" class="convert-colors" data-testid="convert-colors">
    <ConvertMyBeadsView v-if="view === 'my-beads'" @back="backToColors" />
    <template v-else>
      <div class="convert-colors__head">
        <span class="convert-colors__title">
          {{ words.colorsLabel }}
          <InfoButton :label="colorsInfo.label" :body="colorsInfo.body" data-testid="convert-colors-slider-info" />
        </span>
        <span class="convert-colors__label convert-colors__source-head">
          <span :id="sourceLabelId">{{ words.matchTo }}</span>
          <InfoButton :label="words.whereColorsFrom" :body="sourceNote" data-testid="convert-color-source-info" />
        </span>
        <div class="convert-colors__source">
          <MenuButton :label="sourceLabel" :aria-describedby="sourceLabelId" data-testid="convert-color-source">
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
            <template v-if="wizard.hasCatalog.value" #footer>
              <AppMenuItem icon="pencil" class="convert-colors__source-item" data-testid="convert-edit-my-beads" @select="view = 'my-beads'">
                <span>{{ myBeadsItem.label }}</span>
                <span class="convert-colors__source-meta">{{ myBeadsItem.meta }}</span>
              </AppMenuItem>
            </template>
          </MenuButton>
        </div>
        <span v-if="wizard.source.value === 'bead-colors' || wizard.source.value === 'my-beads'" class="convert-colors__codes" data-testid="convert-codes">{{ codes }}</span>
        <AppNote v-if="wizard.source.value === 'bead-colors' && wizard.catalogState.value === 'failed'" role="alert" data-testid="convert-catalog-failed">
          {{ t.palette.beadColors.failed }}
        </AppNote>
      </div>

      <div class="convert-colors__found-head">
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
    </template>
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

/* match to fills the row (DS-2); each item's count stands at its right. */
.convert-colors__source :deep(.menu-button),
.convert-colors__source :deep(.app-button) {
  width: 100%;
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

.convert-colors__codes {
  font: var(--type-meta-small);
  color: var(--muted);
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

.convert-colors__list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
}
</style>
