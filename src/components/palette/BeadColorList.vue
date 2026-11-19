<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { BeadColors } from '../../composables/palette/useBeadColors'
import { SHOWN, useBeadColorFinder } from '../../composables/palette/useBeadColorFinder'
import { fillBlanks } from '../../domain/fillBlanks'
import { isAddedColorId } from '../../domain/palette'
import { groupThousands } from '../../domain/formatNumber'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import AppNote from '../ui/AppNote.vue'
import BeadColorFilters from './BeadColorFilters.vue'
import BeadColorFindRow from './BeadColorFindRow.vue'
import BeadSwatchChip from './BeadSwatchChip.vue'

// The Bead's Color catalog (ticket 0537, ADR 0072; BeadColors card): every code in the Bead's size; a press adds a code
// and a press on one the Palette holds takes it out again (ticket 1092), each an Edit. Color and Finish filters narrow
// the search (ticket 0713), reset on close, and stand beside the rows or behind a Filters button (ticket 0746).
const props = defineProps<{ colors: BeadColors }>()
const emit = defineEmits<{ added: [hex: string] }>()

const { t, locale } = useI18n()
const words = computed(() => t.value.palette.beadColors)
// The converter's Change picker opens on its Finishes (ticket 0901); a change here is this list's alone.
const { query, familyName, matches, shown, families, finishes, filtersOnCount, filtersOn, filtersOpen, emptyText, toggleFamily, toggleFinish, clearFilters } = useBeadColorFinder({ swatches: props.colors.swatches, bead: props.colors.bead, catalog: props.colors.catalog, startFinishes: props.colors.finishes?.value })

onMounted(() => void props.colors.load())

/** The swatch the person last moved to with focus (a press focuses it too): a color Report starts from its code. */
const highlighted = ref<{ code: string; hex: string }>()
/** The highlighted swatch while the list still shows it: a search or filter that hid it leaves no code to start from. */
const highlightedShown = computed(() => (shown.value.some((entry) => entry.code === highlighted.value?.code) ? highlighted.value : undefined))

/** A row's name starts with the words it shows (ticket 0940, WCAG 2.5.3): code, family, finish and Discontinued. */
function rowName(entry: (typeof shown.value)[number]): string {
  const name = fillBlanks(words.value.rowName, { code: entry.code, family: familyName(entry.family), finish: words.value.finishes[entry.finish] }) + (entry.approximate ? words.value.approximateSuffix : '')
  return entry.discontinued ? fillBlanks(words.value.rowNote, { name, note: words.value.discontinued }) : name
}

type Row = (typeof shown.value)[number]
/** What a row is to the Palette (ticket 1092): `free` joins it on a press; `held` is in it under this very code and a
 * press takes it out; `default` and `kept` are in it too but stay (a default color, or a host with no removal); `same`
 * is a code whose color the Palette holds under another code, which cannot join twice. */
type RowState = 'free' | 'held' | 'default' | 'kept' | 'same'

function stateOf(entry: Row): RowState {
  if (!entry.taken) return 'free'
  if (!entry.heldAs) return 'same'
  if (!props.colors.remove) return 'kept'
  return isAddedColorId(entry.heldAs) ? 'held' : 'default'
}

/** A row's name by its state, and what it says of its place in the Palette at its right end. */
const ROW_LABEL = { free: 'add', held: 'remove', default: 'defaultLabel', kept: 'heldLabel', same: 'takenLabel' } as const
const ROW_MARK = { held: 'inPalette', default: 'defaultColor', kept: 'inPalette', same: 'sameColor' } as const

/** The rows shown, each with its state, its name and its mark worked out once. */
const rows = computed(() =>
  shown.value.map((entry) => {
    const state = stateOf(entry)
    return {
      entry,
      state,
      label: fillBlanks(words.value[ROW_LABEL[state]], { name: rowName(entry) }),
      mark: state === 'free' ? undefined : words.value[ROW_MARK[state]],
      pressable: state === 'free' || state === 'held',
    }
  }),
)

function press(entry: Row, state: RowState) {
  if (state === 'held' && entry.heldAs) props.colors.remove?.(entry.heldAs)
  else if (state === 'free' && props.colors.add(entry.hex, entry.code) === 'added') emit('added', entry.hex)
}
</script>

<template>
  <div class="bead-color-list" role="group" :aria-label="words.label" data-testid="bead-colors">
    <AppNote v-if="colors.state.value === 'loading'" role="status">{{ words.loading }}</AppNote>
    <AppNote v-else-if="colors.state.value === 'failed'" role="alert" data-testid="bead-colors-failed">{{ words.failed }}</AppNote>
    <div v-else class="bead-color-list__layout">
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
          <span>{{ fillBlanks(words.codeCount, { count: groupThousands(matches.length, locale) }) }}</span>
          <span v-if="matches.length > SHOWN">{{ fillBlanks(words.firstShown, { count: SHOWN }) }}</span>
        </p>
        <ul class="bead-color-list__rows">
          <li v-for="{ entry, state, label, mark, pressable } in rows" :key="entry.code" class="bead-color-list__item">
            <button
              type="button"
              class="bead-color-list__row"
              :class="{ 'bead-color-list__row--taken': state === 'same', 'bead-color-list__row--held': !!entry.heldAs, 'bead-color-list__row--stays': state === 'default' || state === 'kept' }"
              :aria-disabled="pressable ? undefined : 'true'"
              :aria-label="label"
              data-testid="bead-color"
              :data-code="entry.code"
              :data-taken="entry.taken || undefined"
              :data-held="entry.heldAs ? state : undefined"
              @click="press(entry, state)"
              @focus="highlighted = { code: entry.code, hex: entry.hex }"
            >
              <BeadSwatchChip class="bead-color-list__chip" :hex="entry.hex" :approximate="entry.approximate" :tip="false" />
              <span class="bead-color-list__text">
                <span class="bead-color-list__code">{{ entry.code }}</span>
                {{ ' ' }}
                <span class="bead-color-list__meta">
                  {{ entry.approximate ? `${familyName(entry.family)} · ${words.finishes[entry.finish]}` : fillBlanks(words.measuredSub, { family: familyName(entry.family), finish: words.finishes[entry.finish] }) }}
                  <span v-if="entry.discontinued" class="bead-color-list__note"> · {{ words.discontinued }}</span>
                </span>
              </span>
              {{ ' ' }}
              <span v-if="mark" class="bead-color-list__taken">
                <AppIcon v-if="entry.heldAs" name="check" :size="14" />
                {{ mark }}
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

/* A code the Palette holds (ticket 1092): a filled row in `ink` with a check, found at a glance; a press takes it out. */
.bead-color-list__row--held,
.bead-color-list__row--held:hover {
  background: var(--press-fill);
}

.bead-color-list__row--held .bead-color-list__taken {
  color: var(--ink);
}

.bead-color-list__row--stays {
  cursor: default;
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
  display: inline-flex;
  flex: none;
  gap: var(--space-4);
  align-items: center;
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
