<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { BeadColors } from '../../composables/palette/useBeadColors'
import { SHOWN, useBeadColorFinder } from '../../composables/palette/useBeadColorFinder'
import { fillBlanks } from '../../domain/fillBlanks'
import { groupThousands } from '../../domain/formatNumber'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import AppNote from '../ui/AppNote.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'
import BeadColorFilters from './BeadColorFilters.vue'
import BeadColorFindRow from './BeadColorFindRow.vue'

// The Bead's Color catalog (ticket 0537, ADR 0072; BeadColors card): every code in the Bead's size, a code the Palette
// holds taken; adding is an Edit. Color and Finish filters narrow the search (ticket 0713), reset on close, and stand
// beside the rows or behind a Filters button by the list's width (ticket 0746).
const props = defineProps<{ colors: BeadColors }>()
const emit = defineEmits<{ added: [hex: string] }>()

const { t, locale } = useI18n()
const words = computed(() => t.value.palette.beadColors)
// My beads (tickets 0902, 0918): the same device list the converter ticks into. Once it holds a code the list opens on
// My beads; the half keeps the rows it opened with, so a code unticked there stays to be ticked again.
const mine = computed(() => props.colors.myBeads)
const owned = computed(() => new Set(mine.value?.codes.value))
const listed = computed(() => owned.value.size)
const half = ref<'all' | 'mine'>(listed.value > 0 ? 'mine' : 'all')
const mineShown = ref(new Set(mine.value?.codes.value))
const onMine = computed(() => listed.value > 0 && half.value === 'mine')
const setHalf = (next: 'all' | 'mine') => {
  if (next === 'mine') mineShown.value = new Set(owned.value)
  half.value = next
}
const rows = computed(() => (onMine.value ? props.colors.swatches.value.filter((swatch) => mineShown.value.has(swatch.code)) : props.colors.swatches.value))
const halves = computed(() => [
  { value: 'all' as const, label: t.value.convertImage.wizard.myBeads.allCodes, meta: groupThousands(props.colors.swatches.value.length, locale.value) },
  { value: 'mine' as const, label: t.value.convertImage.wizard.myBeads.name, meta: groupThousands(props.colors.swatches.value.filter((swatch) => owned.value.has(swatch.code)).length, locale.value) },
])
const measured = computed(() => matches.value.filter((swatch) => !swatch.approximate).length)

// The converter's Change picker opens on its Finishes (ticket 0901); a change here is this list's alone.
const { query, familyName, matches, shown, families, finishes, filtersOnCount, filtersOn, filtersOpen, emptyText, toggleFamily, toggleFinish, clearFilters } = useBeadColorFinder({ swatches: rows, bead: props.colors.bead, catalog: props.colors.catalog, startFinishes: props.colors.finishes?.value })

onMounted(() => void props.colors.load())

/** The swatch the person last moved to with focus (a press focuses it too): a color Report starts from its code. */
const highlighted = ref<{ code: string; hex: string }>()
/** The highlighted swatch while the list still shows it: a search or filter that hid it leaves no code to start from. */
const highlightedShown = computed(() => (shown.value.some((entry) => entry.code === highlighted.value?.code) ? highlighted.value : undefined))

/** A row's name starts with the words it shows (ticket 0940, WCAG 2.5.3): code, family, finish and Discontinued. */
function rowName(entry: (typeof shown.value)[number]): string {
  const name = fillBlanks(words.value.rowName, { code: entry.code, family: familyName(entry.family), finish: words.value.finishes[entry.finish] })
  return entry.discontinued ? fillBlanks(words.value.rowNote, { name, note: words.value.discontinued }) : name
}

function add(hex: string, code: string) {
  if (props.colors.add(hex, code) === 'added') emit('added', hex)
}
</script>

<template>
  <div class="bead-color-list" role="group" :aria-label="words.label" data-testid="bead-colors">
    <AppNote v-if="colors.state.value === 'loading'" role="status">{{ words.loading }}</AppNote>
    <AppNote v-else-if="colors.state.value === 'failed'" role="alert" data-testid="bead-colors-failed">{{ words.failed }}</AppNote>
    <div v-else class="bead-color-list__layout">
      <SegmentedControl
        v-if="listed > 0"
        class="bead-color-list__switch"
        :model-value="half"
        :options="halves"
        :aria-label="t.convertImage.wizard.myBeads.name"
        small
        data-testid="bead-colors-switch"
        @update:model-value="setHalf"
      />
      <BeadColorFindRow v-model:query="query" v-model:open="filtersOpen" class="bead-color-list__search" :filters-on-count="filtersOnCount" />
      <BeadColorFilters
        class="bead-color-list__filters"
        :class="{ 'bead-color-list__filters--open': filtersOpen }"
        :families="families"
        :finishes="finishes"
        :any-on="filtersOn"
        :open="filtersOpen"
        @toggle-family="toggleFamily"
        @toggle-finish="toggleFinish"
        @clear="clearFilters"
      />
      <div class="bead-color-list__results">
        <p class="bead-color-list__count" data-testid="bead-colors-count">
          <span>
            {{ fillBlanks(words.codeCount, { count: groupThousands(matches.length, locale) }) }}
            <template v-if="onMine"> · {{ fillBlanks(words.measuredCount, { count: groupThousands(measured, locale) }) }}</template>
          </span>
          <span v-if="matches.length > SHOWN">{{ fillBlanks(words.firstShown, { count: SHOWN }) }}</span>
        </p>
        <ul class="bead-color-list__rows">
          <li v-for="entry in shown" :key="entry.code" class="bead-color-list__item">
            <button
              type="button"
              class="bead-color-list__row"
              :class="{ 'bead-color-list__row--taken': entry.taken }"
              :aria-disabled="entry.taken ? 'true' : undefined"
              :aria-label="fillBlanks(entry.taken ? words.takenLabel : words.add, { name: rowName(entry) })"
              data-testid="bead-color"
              :data-code="entry.code"
              :data-taken="entry.taken || undefined"
              @click="!entry.taken && add(entry.hex, entry.code)"
              @focus="highlighted = { code: entry.code, hex: entry.hex }"
            >
              <span class="bead-color-list__chip" :class="{ 'bead-color-list__chip--approximate': entry.approximate }" :style="{ backgroundColor: entry.hex }" />
              <span class="bead-color-list__text">
                <span class="bead-color-list__code">{{ entry.code }}</span>
                {{ ' ' }}
                <span class="bead-color-list__meta">
                  {{ familyName(entry.family) }} · {{ words.finishes[entry.finish] }}
                  <span v-if="entry.discontinued" class="bead-color-list__note"> · {{ words.discontinued }}</span>
                </span>
              </span>
              {{ ' ' }}
              <span v-if="entry.taken" class="bead-color-list__taken">{{ words.inPalette }}</span>
            </button>
            <button
              v-if="mine"
              type="button"
              class="bead-color-list__tick"
              :aria-pressed="owned.has(entry.code)"
              :aria-label="fillBlanks(words.inMyBeads, { code: entry.code })"
              data-testid="bead-color-tick"
              :data-code="entry.code"
              @click="mine.toggle(entry.code)"
            >
              <span class="bead-color-list__box" aria-hidden="true">
                <AppIcon v-if="owned.has(entry.code)" name="check" :size="14" />
              </span>
            </button>
          </li>
        </ul>
        <div v-if="matches.length === 0" class="bead-color-list__empty">
          <AppNote data-testid="bead-colors-empty">{{ emptyText }}</AppNote>
          <AppButton v-if="filtersOn" variant="in-box" size="sm" data-testid="bead-colors-clear-filters" @click="clearFilters">{{ words.clearFilters }}</AppButton>
        </div>
      </div>
    </div>
    <AppButton
      v-if="colors.report"
      variant="link"
      icon="message"
      class="bead-color-list__report"
      data-testid="bead-colors-report"
      @click="colors.report(highlightedShown)"
    >
      {{ words.reportColor }}
    </AppButton>
  </div>
</template>

<style scoped>
/* The list lays itself out by its own width (BeadColors card): wide at 480px and more, narrow under it. The same
 * 480px is in BeadColorFilters.vue; a container query can't take a token. */
.bead-color-list {
  container: bead-list / inline-size;
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  margin-top: var(--space-12);
}

.bead-color-list__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-8);
}

/* Narrow: the filters sit behind the disclosure, closed until it is pressed. */
.bead-color-list__layout > .bead-color-list__filters {
  display: none;
}

.bead-color-list__layout > .bead-color-list__filters--open {
  display: flex;
}

.bead-color-list__results {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  min-width: 0;
}

.bead-color-list__count {
  display: flex;
  justify-content: space-between;
  gap: var(--space-8);
  margin: 0;
  font: var(--type-meta-small);
  color: var(--muted);
}

.bead-color-list__rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-height: var(--bead-list-height);
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

@container bead-list (min-width: 480px) {
  .bead-color-list__layout {
    grid-template-columns: var(--bead-filter-column) minmax(0, 1fr);
    grid-template-rows: auto 1fr;
    column-gap: var(--space-14);
  }

  .bead-color-list__search {
    grid-column: 2;
    grid-row: 1;
  }

  .bead-color-list__layout > .bead-color-list__filters {
    display: flex;
    grid-column: 1;
    grid-row: 1 / span 2;
    align-self: start;
  }

  .bead-color-list__results {
    grid-column: 2;
    grid-row: 2;
  }

  .bead-color-list__search :deep(.bead-color-find__toggle) {
    display: none;
  }

  .bead-color-list__rows {
    max-height: var(--bead-list-height-wide);
  }

  .bead-color-list__report {
    align-self: flex-end;
  }
}

.bead-color-list__item {
  display: flex;
  gap: var(--space-4);
  align-items: center;
}

/* The tick of My beads (ticket 0918): its own button at the row's right, 28 square and 44 to hit on touch, the 20 box
 * of ticket 0902 inside it. */
.bead-color-list__tick {
  display: grid;
  flex: none;
  place-items: center;
  box-sizing: border-box;
  width: var(--filter-chip-height);
  height: var(--filter-chip-height);
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

@media (pointer: coarse) {
  .bead-color-list__tick {
    width: var(--touch-target);
    height: var(--touch-target);
  }
}

.bead-color-list__tick:hover {
  background: var(--hover-fill);
}

.bead-color-list__tick:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.bead-color-list__box {
  display: grid;
  place-items: center;
  box-sizing: border-box;
  width: var(--my-beads-tick);
  height: var(--my-beads-tick);
  color: var(--canvas);
  background: var(--canvas);
  border: 1px solid var(--field-line);
  border-radius: var(--radius-xs);
}

.bead-color-list__tick[aria-pressed='true'] .bead-color-list__box {
  background: var(--ink);
  border-color: var(--ink);
}

.bead-color-list__row {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  align-items: center;
  gap: var(--space-10);
  box-sizing: border-box;
  padding: var(--space-4) var(--space-6);
  font: var(--type-control);
  color: inherit;
  text-align: left;
  background: transparent;
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.bead-color-list__row:hover {
  background: var(--surface);
}

.bead-color-list__row:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.bead-color-list__row--taken {
  color: var(--muted);
  cursor: default;
}

.bead-color-list__chip {
  flex: none;
  box-sizing: border-box;
  width: var(--field-height);
  height: var(--field-height);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
}

/* An approximate swatch has a dashed edge: it is made, not measured. */
.bead-color-list__chip--approximate {
  border-style: dashed;
}

.bead-color-list__text {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
}

.bead-color-list__meta {
  font: var(--type-meta);
  color: var(--muted);
  overflow-wrap: anywhere;
}

/* The mark moves to the next line whole instead of breaking inside. */
.bead-color-list__note {
  display: inline-block;
}

.bead-color-list__taken {
  flex: none;
  font: var(--type-meta);
}

/* The foot row (BeadColors card): a link under the list, apart from it; at the left when narrow, the right when wide.
 * The one accent-colored link: it is the way out when a color is wrong or missing. */
.bead-color-list__report {
  align-self: flex-start;
  color: var(--accent-strong);
  margin-top: var(--space-4);
}

.bead-color-list__empty {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  align-items: flex-start;
}
</style>
