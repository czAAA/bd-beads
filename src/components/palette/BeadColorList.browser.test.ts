import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mountAt, unmountAll } from '../../testUtils/browserFit'
import { findBead } from '../../domain/beads'
import type { BeadColors } from '../../composables/palette/useBeadColors'
import type { CatalogSwatch } from '../../domain/beadSwatch'
import BeadColorList from './BeadColorList.vue'
import BeadColorsEntry from './BeadColorsEntry.vue'

// The list lays itself out by its own width, not the screen's (BeadColors card, ticket 0746): wide from 480px.
afterEach(unmountAll)

const entry = (code: string, family: string, finish: CatalogSwatch['finish']): CatalogSwatch => ({ code, family, finish, hex: '#336699', approximate: true, discontinued: false, taken: false })
const colors = { available: ref(true), state: ref('ready'), swatches: ref([entry('DB1', 'Blue', 'matte'), entry('DB2', 'Red', 'opaque')]), bead: ref(findBead('miyuki/delica/11-0')), catalog: ref(undefined), load: () => {}, add: () => 'added' } as unknown as BeadColors

/** The list in a host `width` px wide on a desktop-sized screen: only the list's own width differs between cases. */
const inWidth = (width: number) => defineComponent(() => () => h('div', { style: { width: `${width}px` } }, [h(BeadColorList, { colors })]))

/** The page's rem in px (the app scales its root font). */
const rem = (count: number) => `${count * parseFloat(getComputedStyle(document.documentElement).fontSize)}px`

async function layout(width: number) {
  const { root } = await mountAt(inWidth(width), {}, { locale: 'en', width: 1280 })
  const box = (testid: string) => root.querySelector<HTMLElement>(`[data-testid="${testid}"]`)!
  return {
    toggle: box('bead-colors-filters-toggle'),
    filters: box('bead-colors-filters'),
    search: box('bead-colors-search').closest('.text-field')!.getBoundingClientRect(),
    rows: root.querySelector<HTMLElement>('.bead-color-list__rows')!,
    filterBox: box('bead-colors-filters').getBoundingClientRect(),
  }
}

describe('BeadColorList layout', () => {
  it('stands the filters in a 200px column beside the search and rows from 480px, with no Filters button', async () => {
    const wide = await layout(480)

    expect(getComputedStyle(wide.toggle).display).toBe('none')
    expect(getComputedStyle(wide.filters).display).not.toBe('none')
    expect(Math.round(wide.filterBox.width)).toBe(200)
    expect(wide.search.left).toBeGreaterThan(wide.filterBox.right)
    expect(getComputedStyle(wide.rows).maxHeight).toBe(rem(24))
  })

  it('folds the filters behind a Filters button under 480px, closed until it is pressed', async () => {
    const narrow = await layout(479)

    expect(getComputedStyle(narrow.toggle).display).not.toBe('none')
    expect(getComputedStyle(narrow.filters).display).toBe('none')
    expect(getComputedStyle(narrow.rows).maxHeight).toBe(rem(16))

    narrow.toggle.click()
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(getComputedStyle(narrow.filters).display).not.toBe('none')
    expect(narrow.filters.getBoundingClientRect().top).toBeGreaterThan(narrow.search.bottom - 1)
  })
})

describe('BeadColorsEntry and the report link (ticket 0749)', () => {
  const host = (open: boolean) => defineComponent(() => () => h('div', { style: { width: '400px', display: 'flex', flexDirection: 'column' } }, [h(BeadColorsEntry, { bead: findBead('miyuki/delica/11-0'), open, testid: 'entry' })]))

  it('is the same small pill open or closed, in the same place, with the Info button after it while open (ticket 1092)', async () => {
    const closed = await mountAt(host(false), {}, { locale: 'en', width: 1280 })
    const small = closed.root.querySelector<HTMLElement>('[data-testid="entry"]')!.getBoundingClientRect()
    expect(small.width).toBeLessThan(300)
    unmountAll()

    const { root } = await mountAt(host(true), {}, { locale: 'en', width: 1280 })
    const button = root.querySelector<HTMLElement>('[data-testid="entry"]')!.getBoundingClientRect()
    const info = root.querySelector<HTMLElement>('[data-testid="bead-colors-info"]')!.getBoundingClientRect()
    expect([button.left, button.top, button.width, button.height]).toEqual([small.left, small.top, small.width, small.height])
    expect(info.left).toBeGreaterThanOrEqual(button.right)
  })

  it('keeps the button\'s size where the row has no room for the Info button, which goes under it (ticket 1092)', async () => {
    const narrow = (open: boolean) => defineComponent(() => () => h('div', { style: { width: '240px', display: 'flex', flexDirection: 'column' } }, [h(BeadColorsEntry, { bead: findBead('miyuki/delica/11-0'), open, testid: 'entry' })]))
    const closed = await mountAt(narrow(false), {}, { locale: 'en', width: 1280 })
    const small = closed.root.querySelector<HTMLElement>('[data-testid="entry"]')!.getBoundingClientRect()
    unmountAll()

    const { root } = await mountAt(narrow(true), {}, { locale: 'en', width: 1280 })
    const button = root.querySelector<HTMLElement>('[data-testid="entry"]')!.getBoundingClientRect()
    const info = root.querySelector<HTMLElement>('[data-testid="bead-colors-info"]')!.getBoundingClientRect()
    expect([button.left, button.top, button.width, button.height]).toEqual([small.left, small.top, small.width, small.height])
    expect(info.top).toBeGreaterThanOrEqual(button.bottom)
  })

  it('shows Wrong or missing color? in the accent color', async () => {
    const withReport = { ...colors, report: () => {} } as unknown as BeadColors
    const { root } = await mountAt(defineComponent(() => () => h(BeadColorList, { colors: withReport })), {}, { locale: 'en', width: 1280 })
    const link = root.querySelector<HTMLElement>('[data-testid="bead-colors-report"]')!
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent-strong').trim()
    const probe = document.createElement('span')
    probe.style.color = accent
    document.body.append(probe)
    expect(getComputedStyle(link).color).toBe(getComputedStyle(probe).color)
    probe.remove()
  })
})
