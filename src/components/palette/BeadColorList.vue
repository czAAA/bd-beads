<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { BeadColors } from '../../composables/palette/useBeadColors'
import { beadColorFilterCounts, codeInOtherSizes, filterBeadColors, searchBeadColors } from '../../domain/beadColorFilter'
import { FINISHES, type Finish } from '../../domain/colorCatalog'
import { fillBlanks } from '../../domain/fillBlanks'
import { groupThousands } from '../../domain/formatNumber'
import { brandColors, familyColorId } from '../../domain/palette'
import { colorName } from '../../i18n/colorName'
import { formatList } from '../../i18n/listFormat'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import AppNote from '../ui/AppNote.vue'
import TextField from '../ui/form/TextField.vue'
import BeadColorFilters from './BeadColorFilters.vue'

// The Bead's Color catalog (ticket 0537, ADR 0072; BeadColors card): every code in the Bead's size, a code the Palette
// holds taken; adding is an Edit. Color and Finish filters narrow the search (ticket 0713), reset on close, and stand
// beside the rows or behind a Filters button by the list's width (ticket 0746).
const props = defineProps<{ colors: BeadColors }>()
const emit = defineEmits<{ added: [hex: string] }>()

const SHOWN = 60
const { t, locale } = useI18n()
const words = computed(() => t.value.palette.beadColors)
const query = ref('')
const filter = ref<{ families: string[]; finishes: Finish[] }>({ families: [], finishes: [] })
const bead = computed(() => props.colors.bead.value)

onMounted(() => void props.colors.load())

// Replace Bead gives the list another catalog, whose families and Finishes are its own.
watch(() => bead.value?.id, () => (filter.value = { families: [], finishes: [] }))

/** A family's name in words: the Palette's name for the built-in color it is. */
const familyName = (family: string) => colorName(t.value, { id: familyColorId(family), hex: '' })

const searched = computed(() => searchBeadColors(props.colors.swatches.value, query.value, bead.value, familyName))
const matches = computed(() => filterBeadColors(searched.value, filter.value))
const shown = computed(() => matches.value.slice(0, SHOWN))
const counts = computed(() => beadColorFilterCounts(searched.value, filter.value))

/** The Brand's families that have a code in the Bead's size, in the Brand's order, each as its swatch. */
const families = computed(() => {
  const present = new Map(props.colors.swatches.value.map((entry) => [familyColorId(entry.family), entry.family]))
  return brandColors(bead.value?.brand.id).flatMap((color) => {
    const family = present.get(color.id)
    return family ? [{ family, name: familyName(family), hex: color.hex, on: filter.value.families.includes(family), count: counts.value.families.get(family) ?? 0 }] : []
  })
})
/** The Finishes that have a code in the Bead's size, in the shared order. */
const finishes = computed(() => {
  const present = new Set(props.colors.swatches.value.map((entry) => entry.finish))
  return FINISHES.filter((finish) => present.has(finish)).map((finish) => ({ finish, name: words.value.finishes[finish], on: filter.value.finishes.includes(finish), count: counts.value.finishes.get(finish) ?? 0 }))
})

function toggle<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}
const toggleFamily = (family: string) => (filter.value = { ...filter.value, families: toggle(filter.value.families, family) })
const toggleFinish = (finish: Finish) => (filter.value = { ...filter.value, finishes: toggle(filter.value.finishes, finish) })
const filtersOnCount = computed(() => filter.value.families.length + filter.value.finishes.length)
const filtersOn = computed(() => filtersOnCount.value > 0)
/** The Filters disclosure of the narrow layout; it starts closed each time the list opens. */
const filtersOpen = ref(false)
const clearFilters = () => (filter.value = { families: [], finishes: [] })

/** What is on, as the empty sentence names it: the Finishes in lowercase, then the families, each row as one phrase. */
const filterWords = computed(() => {
  const list = (items: string[]) => (items.length ? [formatList(locale.value, items, 'disjunction')] : [])
  return [
    ...list(finishes.value.filter((item) => item.on).map((item) => words.value.finishes[item.finish].toLocaleLowerCase(locale.value))),
    ...list(families.value.filter((item) => item.on).map((item) => familyName(item.family))),
  ].join(' ')
})

/** The empty state's one sentence: the code's other sizes, else what is on and typed. */
const emptyText = computed(() => {
  const typed = query.value.trim()
  const catalog = props.colors.catalog.value
  const elsewhere = typed && catalog && bead.value ? codeInOtherSizes(catalog, typed, bead.value) : undefined
  if (elsewhere && bead.value) return fillBlanks(words.value.otherSizes, { code: elsewhere.code, sizes: formatList(locale.value, elsewhere.sizes), size: bead.value.size })
  if (filtersOn.value && typed) return fillBlanks(words.value.noMatchFiltered, { filters: filterWords.value, query: typed })
  if (filtersOn.value) return fillBlanks(words.value.noneFiltered, { filters: filterWords.value })
  return fillBlanks(words.value.noMatch, { query: typed })
})

/** The swatch the person last moved to with focus (a press focuses it too): a color Report starts from its code. */
const highlighted = ref<{ code: string; hex: string }>()
/** The highlighted swatch while the list still shows it: a search or filter that hid it leaves no code to start from. */
const highlightedShown = computed(() => (shown.value.some((entry) => entry.code === highlighted.value?.code) ? highlighted.value : undefined))

function add(hex: string, code: string) {
  if (props.colors.add(hex, code) === 'added') emit('added', hex)
}
</script>

<template>
  <div class="bead-color-list" role="group" :aria-label="words.label" data-testid="bead-colors">
    <AppNote v-if="colors.state.value === 'loading'" role="status">{{ words.loading }}</AppNote>
    <AppNote v-else-if="colors.state.value === 'failed'" role="alert" data-testid="bead-colors-failed">{{ words.failed }}</AppNote>
    <div v-else class="bead-color-list__layout">
      <div class="bead-color-list__search">
        <TextField v-model="query" type="search" :aria-label="words.search" :placeholder="words.search" autocomplete="off" data-testid="bead-colors-search" />
        <button
          type="button"
          class="bead-color-list__filters-toggle"
          :aria-expanded="filtersOpen"
          :aria-label="filtersOn ? fillBlanks(words.filtersOn, { count: filtersOnCount }) : words.filters"
          data-testid="bead-colors-filters-toggle"
          @click="filtersOpen = !filtersOpen"
        >
          {{ words.filters }}
          <span v-if="filtersOn" class="bead-color-list__badge" aria-hidden="true" data-testid="bead-colors-filters-badge">{{ filtersOnCount }}</span>
          <AppIcon :name="filtersOpen ? 'chevron-up' : 'chevron-down'" :size="14" aria-hidden="true" />
        </button>
      </div>
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
          <span>{{ fillBlanks(words.codeCount, { count: groupThousands(matches.length, locale) }) }}</span>
          <span v-if="matches.length > SHOWN">{{ fillBlanks(words.firstShown, { count: SHOWN }) }}</span>
        </p>
        <ul class="bead-color-list__rows">
          <li v-for="entry in shown" :key="entry.code">
            <button
              type="button"
              class="bead-color-list__row"
              :class="{ 'bead-color-list__row--taken': entry.taken }"
              :aria-disabled="entry.taken ? 'true' : undefined"
              :aria-label="fillBlanks(entry.taken ? words.takenLabel : words.add, { code: entry.code })"
              data-testid="bead-color"
              :data-code="entry.code"
              :data-taken="entry.taken || undefined"
              @click="!entry.taken && add(entry.hex, entry.code)"
              @focus="highlighted = { code: entry.code, hex: entry.hex }"
            >
              <span class="bead-color-list__chip" :class="{ 'bead-color-list__chip--approximate': entry.approximate }" :style="{ backgroundColor: entry.hex }" />
              <span class="bead-color-list__text">
                <span class="bead-color-list__code">{{ entry.code }}</span>
                <span class="bead-color-list__meta">
                  {{ familyName(entry.family) }} · {{ words.finishes[entry.finish] }}
                  <span v-if="entry.discontinued" class="bead-color-list__note"> · {{ words.discontinued }}</span>
                </span>
              </span>
              <span v-if="entry.taken" class="bead-color-list__taken">{{ words.inPalette }}</span>
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

.bead-color-list__search {
  display: flex;
  gap: var(--space-8);
}

.bead-color-list__search :deep(.text-field) {
  flex: 1 1 auto;
  min-width: 0;
}

/* The Filters disclosure of the narrow layout: a field-height button beside the search, a count badge while values are on. */
.bead-color-list__filters-toggle {
  display: inline-flex;
  flex: none;
  gap: var(--space-6);
  align-items: center;
  box-sizing: border-box;
  height: var(--field-height);
  padding: 0 var(--space-10);
  font: var(--type-control);
  color: var(--ink);
  background: var(--elevated);
  border: 1px solid var(--field-line);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.bead-color-list__filters-toggle:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.bead-color-list__badge {
  box-sizing: border-box;
  min-width: var(--filter-badge);
  height: var(--filter-badge);
  padding: 0 var(--space-6);
  font: var(--type-meta-tiny);
  line-height: var(--filter-badge);
  color: var(--canvas);
  text-align: center;
  background: var(--ink);
  border-radius: var(--radius-full);
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

  .bead-color-list__filters-toggle {
    display: none;
  }

  .bead-color-list__rows {
    max-height: var(--bead-list-height-wide);
  }

  .bead-color-list__report {
    align-self: flex-end;
  }
}

.bead-color-list__row {
  display: flex;
  align-items: center;
  gap: var(--space-10);
  box-sizing: border-box;
  width: 100%;
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

/* The foot row (BeadColors card): a link under the list, apart from it; at the left when narrow, the right when wide. */
.bead-color-list__report {
  align-self: flex-start;
  margin-top: var(--space-4);
}

.bead-color-list__empty {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  align-items: flex-start;
}
</style>
