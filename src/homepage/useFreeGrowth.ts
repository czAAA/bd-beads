import { computed, ref, shallowRef, type Ref } from 'vue'
import { FREE_GROWTH, FREE_START_ROWS, freeListHeight, freeListRoom, type FreeListMeasure } from './freeGrowth'

/** What the growth is measured from: the plans section the tiles are shown in, and No account's list and tile. */
export interface FreeGrowthDeps {
  section: Ref<HTMLElement | undefined>
  freeWindow: () => HTMLElement | undefined
  freeTile: () => HTMLElement | undefined
  /** The Homepage's zoom: the tile is measured in screen px and drawn in its own. */
  zoom: () => number
}

/** A design value as a number, from the page when it has one (a scroll can't take a CSS value), else the default. */
function designNumber(name: string, fallback: number): number {
  const value = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name))
  return Number.isFinite(value) ? value : fallback
}

/** How much a section is scaled while it turns in or out (`--section-scale`), so it is measured as it will stand. */
function turnScale(el: HTMLElement): number {
  const scale = /^matrix\(([^,]+),/.exec(getComputedStyle(el).transform)?.[1]
  return scale ? Number.parseFloat(scale) : 1
}

/** No account's free list growing as the plans section scrolls (tickets 0742, 0801; Homepage card, the free list): the
 * section says how far it has scrolled; this measures the tile and says how tall the list is and how far the section
 * must reach. */
export function useFreeGrowth({ section, freeWindow, freeTile, zoom }: FreeGrowthDeps) {
  const measure = shallowRef<FreeListMeasure>()
  let growth = FREE_GROWTH
  /** How far the plans have scrolled up in their section, in its own px. */
  const offset = ref(0)
  const height = computed(() => measure.value && freeListHeight(measure.value, offset.value, growth))
  const open = computed(() => !!measure.value && height.value! >= measure.value.full - 0.5)
  /** How much further than its room the plans section scrolls, in its own px. */
  const room = computed(() => (measure.value ? Math.ceil(freeListRoom(measure.value)) : 0))

  /** Measures the list and its tile; its height and the plans' scroll are left out, so it can be measured at any time. */
  function remeasure() {
    const plansEl = section.value
    const windowEl = freeWindow()
    const tileEl = freeTile()
    const listEl = windowEl?.firstElementChild
    if (!plansEl || !windowEl || !tileEl || !listEl?.children.length) {
      // No tile to grow, as a new visitor's Free to use has none (ticket 0947): the section reaches no further.
      measure.value = undefined
      return
    }
    growth = designNumber('--free-growth', FREE_GROWTH)
    const shown = Math.min(listEl.children.length, Math.round(designNumber('--free-start-rows', FREE_START_ROWS)))
    const scale = zoom() * turnScale(plansEl)
    const plans = plansEl.getBoundingClientRect()
    const shownList = windowEl.getBoundingClientRect()
    const list = listEl.getBoundingClientRect()
    const lastShown = listEl.children[shown - 1]!.getBoundingClientRect()
    const tile = tileEl.getBoundingClientRect()
    measure.value = {
      viewport: plans.height / scale,
      top: (shownList.top - plans.top) / scale + offset.value,
      start: (lastShown.bottom - list.top) / scale,
      full: list.height / scale,
      below: (tile.bottom - shownList.bottom) / scale,
    }
  }

  /** The plans section's own scroll, in its own px. */
  function scrolled(px: number) {
    offset.value = Math.max(0, px)
  }

  return { height, open, room, remeasure, scrolled }
}
