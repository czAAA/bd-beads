import { computed, ref, shallowRef, type Ref } from 'vue'
import { FREE_GROWTH, FREE_START_ROWS, freeListHeight, freeListRoom, type FreeListMeasure } from './freeGrowth'

/** What the growth is measured from: the plans section the tiles are shown in, and No account's list and tile. */
export interface FreeGrowthDeps {
  section: Ref<HTMLElement | undefined>
  freeWindow: () => HTMLElement | undefined
  freeTile: () => HTMLElement | undefined
  /** The Homepage's zoom: the page scrolls in screen px, the tile is drawn in its own. */
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

/** No account's free list growing as the page scrolls past the plans (ticket 0742; Homepage card, the free list): the
 * page says how far past it is; this measures the tile and says how tall the list is, how far the plans have scrolled
 * up and how much further the page must reach. */
export function useFreeGrowth({ section, freeWindow, freeTile, zoom }: FreeGrowthDeps) {
  const measure = shallowRef<FreeListMeasure>()
  let growth = FREE_GROWTH
  /** How far the page is scrolled past the plans, in screen px. */
  const past = ref(0)
  /** How far the plans have scrolled up in their section, in their own px: as far as the page has. */
  const offset = computed(() => past.value / zoom())
  const height = computed(() => measure.value && freeListHeight(measure.value, offset.value, growth))
  const open = computed(() => !!measure.value && height.value! >= measure.value.full - 0.5)
  /** How much further than the plans the page scrolls, in screen px. */
  const room = computed(() => (measure.value ? Math.ceil(freeListRoom(measure.value) * zoom()) : 0))

  /** Measures the list and its tile; its height and the plans' scroll are left out, so it can be measured at any time. */
  function remeasure() {
    const room = section.value
    const window = freeWindow()
    const tile = freeTile()
    const list = window?.firstElementChild
    if (!room || !window || !tile || !list?.children.length) return
    growth = designNumber('--free-growth', FREE_GROWTH)
    const shown = Math.min(list.children.length, Math.round(designNumber('--free-start-rows', FREE_START_ROWS)))
    const scale = zoom() * turnScale(room)
    const [at, win, rows, last, foot] = [room, window, list, list.children[shown - 1]!, tile].map((el) => el.getBoundingClientRect())
    measure.value = {
      viewport: at!.height / scale,
      top: (win!.top - at!.top) / scale + offset.value,
      start: (last!.bottom - rows!.top) / scale,
      full: rows!.height / scale,
      below: (foot!.bottom - win!.bottom) / scale,
    }
  }

  return { past, offset, height, open, room, remeasure }
}
