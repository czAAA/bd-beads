<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { BeadColors } from '../../composables/palette/useBeadColors'
import { useRovingFocus } from '../../composables/ui/useRovingFocus'
import { beadColorFilterCounts, codeInOtherSizes, filterBeadColors, searchBeadColors } from '../../domain/beadColorFilter'
import { FINISHES, type Finish } from '../../domain/colorCatalog'
import { fillBlanks } from '../../domain/fillBlanks'
import { groupThousands } from '../../domain/formatNumber'
import { brandColors, familyColorId } from '../../domain/palette'
import { colorName } from '../../i18n/colorName'
import { formatList } from '../../i18n/listFormat'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppNote from '../ui/AppNote.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import TextField from '../ui/form/TextField.vue'

// The Bead's Color catalog (ticket 0537, ADR 0072; BeadColors card): every code the Project's Bead size has, each with a
// generated swatch that says it is approximate; a code whose color the Palette holds is taken. Adding is an Edit. The
// Color and Finish filter rows narrow the list with the search (ticket 0713); the component's own, they reset on close.
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
    return family ? [{ family, hex: color.hex, on: filter.value.families.includes(family), count: counts.value.families.get(family) ?? 0 }] : []
  })
})
/** The Finishes that have a code in the Bead's size, in the shared order. */
const finishes = computed(() => {
  const present = new Set(props.colors.swatches.value.map((entry) => entry.finish))
  return FINISHES.filter((finish) => present.has(finish)).map((finish) => ({ finish, on: filter.value.finishes.includes(finish), count: counts.value.finishes.get(finish) ?? 0 }))
})

const valueName = (name: string, count: number) => fillBlanks(words.value.valueCount, { name, count: groupThousands(count, locale.value) })

function toggle<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}
const toggleFamily = (family: string) => (filter.value = { ...filter.value, families: toggle(filter.value.families, family) })
const toggleFinish = (finish: Finish) => (filter.value = { ...filter.value, finishes: toggle(filter.value.finishes, finish) })
const filtersOn = computed(() => filter.value.families.length + filter.value.finishes.length > 0)
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

const colorRow = ref<HTMLElement>()
const finishRow = ref<HTMLElement>()
const colorRoving = useRovingFocus(colorRow, { axis: () => 'horizontal', managesTabIndex: true })
const finishRoving = useRovingFocus(finishRow, { axis: () => 'horizontal', managesTabIndex: true })

function add(hex: string, code: string) {
  if (props.colors.add(hex, code) === 'added') emit('added', hex)
}
</script>

<template>
  <div class="bead-color-list" role="group" :aria-label="words.label" data-testid="bead-colors">
    <AppNote data-testid="bead-colors-approximate">{{ words.approximate }} {{ words.takenNote }}</AppNote>
    <AppNote v-if="colors.state.value === 'loading'" role="status">{{ words.loading }}</AppNote>
    <AppNote v-else-if="colors.state.value === 'failed'" role="alert" data-testid="bead-colors-failed">{{ words.failed }}</AppNote>
    <template v-else>
      <TextField v-model="query" type="search" :aria-label="words.search" :placeholder="words.search" autocomplete="off" data-testid="bead-colors-search" />
      <div class="bead-color-list__filter">
        <span class="bead-color-list__filter-label" aria-hidden="true">{{ words.colorFilter }}</span>
        <div
          ref="colorRow"
          class="bead-color-list__values"
          role="group"
          :aria-label="words.colorFilter"
          data-testid="bead-colors-filter-color"
          @keydown="colorRoving.onKeydown"
          @focusin="colorRoving.onFocusin"
        >
          <AppTooltip v-for="item in families" :key="item.family" :name="valueName(familyName(item.family), item.count)" :announce="false">
            <button
              type="button"
              class="bead-color-list__family"
              :class="{ 'bead-color-list__family--on': item.on, 'bead-color-list__value--none': item.count === 0 }"
              :style="{ backgroundColor: item.hex }"
              :aria-pressed="item.on"
              :aria-label="valueName(familyName(item.family), item.count)"
              data-testid="bead-colors-family"
              :data-value="item.family"
              :data-none="item.count === 0 || undefined"
              @click="toggleFamily(item.family)"
            />
          </AppTooltip>
        </div>
      </div>
      <div class="bead-color-list__filter">
        <span class="bead-color-list__filter-label" aria-hidden="true">{{ words.finishFilter }}</span>
        <div
          ref="finishRow"
          class="bead-color-list__values"
          role="group"
          :aria-label="words.finishFilter"
          data-testid="bead-colors-filter-finish"
          @keydown="finishRoving.onKeydown"
          @focusin="finishRoving.onFocusin"
        >
          <AppTooltip v-for="item in finishes" :key="item.finish" :name="valueName(words.finishes[item.finish], item.count)" :announce="false">
            <button
              type="button"
              class="ui-control bead-color-list__finish"
              :class="{ 'bead-color-list__finish--on': item.on, 'bead-color-list__value--none': item.count === 0 }"
              :aria-pressed="item.on"
              :aria-label="valueName(words.finishes[item.finish], item.count)"
              data-testid="bead-colors-finish"
              :data-value="item.finish"
              :data-none="item.count === 0 || undefined"
              @click="toggleFinish(item.finish)"
            >
              {{ words.finishes[item.finish] }}
              <span class="bead-color-list__count">{{ groupThousands(item.count, locale) }}</span>
            </button>
          </AppTooltip>
        </div>
      </div>
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
      <AppNote v-else-if="matches.length > SHOWN">{{ fillBlanks(words.showingFirst, { count: SHOWN }) }}</AppNote>
    </template>
  </div>
</template>

<style scoped>
.bead-color-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  margin-top: var(--space-12);
}

.bead-color-list__filter {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.bead-color-list__filter-label {
  font: var(--type-label);
  color: var(--muted);
}

.bead-color-list__values {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-6);
}

/* A family as its swatch (PaletteSwatches card): the same edge, and the Palette's selected ring while it is on. */
.bead-color-list__family {
  box-sizing: border-box;
  width: var(--filter-swatch);
  height: var(--filter-swatch);
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--swatch-edge);
  cursor: pointer;
}

.bead-color-list__family--on {
  box-shadow:
    inset 0 0 0 1px var(--swatch-edge),
    0 0 0 2px var(--swatch-gap, var(--panel)),
    0 0 0 4px var(--ring);
}

/* A Finish as a toggle chip (the MirrorPopover card's Axes chips): a pill on `button`, `accent-strong` while on. */
.bead-color-list__finish {
  display: inline-flex;
  gap: var(--space-4);
  align-items: center;
  box-sizing: border-box;
  height: var(--filter-chip-height);
  padding: 0 var(--space-10);
  font: var(--type-meta);
  color: var(--ink);
  background: var(--button);
  border: 1px solid var(--button-line);
  border-radius: var(--radius-full);
  cursor: pointer;
}

.bead-color-list__finish--on {
  font-weight: 600;
  background: var(--panel);
  border-color: var(--accent-strong);
}

.bead-color-list__count {
  font-family: var(--font-mono);
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

/* A value with no rows is dimmed, not disabled: pressing it still turns it on (ticket 0713). */
.bead-color-list__value--none {
  opacity: var(--swatch-faded-opacity);
}

.bead-color-list__family:focus-visible,
.bead-color-list__finish:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

@media (pointer: coarse) {
  .bead-color-list__family {
    width: var(--swatch-touch-min);
    height: var(--swatch-touch-min);
  }

  .bead-color-list__finish {
    height: var(--swatch-touch-min);
  }
}

.bead-color-list__rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-height: 16rem;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
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

.bead-color-list__empty {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  align-items: flex-start;
}
</style>
