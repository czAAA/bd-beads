import { computed, ref, watch, type Ref } from 'vue'
import { beadColorFilterCounts, codeInOtherSizes, filterBeadColors, searchBeadColors } from '../../domain/beadColorFilter'
import type { Bead } from '../../domain/beads'
import { FINISHES, type ColorCatalog, type Finish } from '../../domain/colorCatalog'
import { fillBlanks } from '../../domain/fillBlanks'
import { brandColors, familyColorId } from '../../domain/palette'
import { colorName } from '../../i18n/colorName'
import { formatList } from '../../i18n/listFormat'
import { useI18n } from '../../i18n/useI18n'

/** The rows shown at most, the rest counted ("first 60 shown", BeadColors card). */
export const SHOWN = 60

/** What finding reads of a row: its code, and its family and Finish when the catalog knows them. */
type Findable = { code: string; family?: string; finish?: Finish }

/** What the finder reads: the rows to find in, the Bead whose shop codes a search reads, its loaded Color catalog (for a
 * code in other sizes) and the Finishes the filter opens with. */
export interface BeadColorFinderDeps<T extends Findable> {
  swatches: Ref<readonly T[]>
  bead: Ref<Pick<Bead, 'id' | 'brand' | 'formFactor' | 'size'> | undefined>
  catalog?: Ref<ColorCatalog | undefined>
  startFinishes?: readonly Finish[]
}

/** The Bead colors list's search and Color and Finish filters (BeadColors card, tickets 0713, 0746), one for the
 * Palette popover's list and the converter's My beads view (ticket 0903): the text typed, the values on, the rows they
 * leave and the empty sentence. The filters reset when another Bead's catalog comes, and with the list. */
export function useBeadColorFinder<T extends Findable>({ swatches, bead, catalog, startFinishes = [] }: BeadColorFinderDeps<T>) {
  const { t, locale } = useI18n()
  const words = computed(() => t.value.palette.beadColors)
  const query = ref('')
  const filter = ref<{ families: string[]; finishes: Finish[] }>({ families: [], finishes: [...startFinishes] })

  // Replace Bead gives the list another catalog, whose families and Finishes are its own.
  watch(() => bead.value?.id, () => (filter.value = { families: [], finishes: [] }))

  /** A family's name in words: the Palette's name for the built-in color it is. */
  const familyName = (family: string) => colorName(t.value, { id: familyColorId(family), hex: '' })

  const searched = computed(() => searchBeadColors(swatches.value, query.value, bead.value, familyName))
  const matches = computed(() => filterBeadColors(searched.value, filter.value))
  const shown = computed(() => matches.value.slice(0, SHOWN))
  const counts = computed(() => beadColorFilterCounts(searched.value, filter.value))

  /** The Brand's families that have a code in the Bead's size, in the Brand's order, each as its swatch. */
  const families = computed(() => {
    const present = new Map(swatches.value.flatMap((entry) => (entry.family ? [[familyColorId(entry.family), entry.family] as const] : [])))
    return brandColors(bead.value?.brand.id).flatMap((color) => {
      const family = present.get(color.id)
      return family ? [{ family, name: familyName(family), hex: color.hex, on: filter.value.families.includes(family), count: counts.value.families.get(family) ?? 0 }] : []
    })
  })
  /** The Finishes that have a code in the Bead's size, in the shared order. */
  const finishes = computed(() => {
    const present = new Set(swatches.value.map((entry) => entry.finish))
    return FINISHES.filter((finish) => present.has(finish)).map((finish) => ({ finish, name: words.value.finishes[finish], on: filter.value.finishes.includes(finish), count: counts.value.finishes.get(finish) ?? 0 }))
  })

  function toggled<V extends string>(list: V[], value: V): V[] {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
  }
  const filtersOnCount = computed(() => filter.value.families.length + filter.value.finishes.length)
  const filtersOn = computed(() => filtersOnCount.value > 0)

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
    const elsewhere = typed && catalog?.value && bead.value ? codeInOtherSizes(catalog.value, typed, bead.value) : undefined
    if (elsewhere && bead.value) return fillBlanks(words.value.otherSizes, { code: elsewhere.code, sizes: formatList(locale.value, elsewhere.sizes), size: bead.value.size })
    if (filtersOn.value && typed) return fillBlanks(words.value.noMatchFiltered, { filters: filterWords.value, query: typed })
    if (filtersOn.value) return fillBlanks(words.value.noneFiltered, { filters: filterWords.value })
    return fillBlanks(words.value.noMatch, { query: typed })
  })

  return {
    query,
    familyName,
    /** Every row the search and the filters leave; `shown` is the first SHOWN of them. */
    matches,
    shown,
    families,
    finishes,
    filtersOnCount,
    filtersOn,
    /** The Filters disclosure of the narrow layout; it starts closed each time the list opens. */
    filtersOpen: ref(false),
    emptyText,
    toggleFamily: (family: string) => (filter.value = { ...filter.value, families: toggled(filter.value.families, family) }),
    toggleFinish: (finish: Finish) => (filter.value = { ...filter.value, finishes: toggled(filter.value.finishes, finish) }),
    clearFilters: () => (filter.value = { families: [], finishes: [] }),
  }
}
