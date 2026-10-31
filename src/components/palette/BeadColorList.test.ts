import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { ref } from 'vue'
import BeadColorList from './BeadColorList.vue'
import type { BeadColors } from '../../composables/palette/useBeadColors'
import type { CatalogSwatch } from '../../domain/beadSwatch'
import type { ColorCatalog } from '../../domain/colorCatalog'
import { en } from '../../i18n/en'
import { findBead } from '../../domain/beads'

beforeEach(() => {
  localStorage.setItem('openbeads:locale', 'en')
})

const entry = (over: Partial<CatalogSwatch>): CatalogSwatch => ({ code: 'DB1', family: 'Blue', finish: 'metallic', hex: '#123456', approximate: true, discontinued: false, taken: false, ...over })

function setup(swatches: CatalogSwatch[], state: 'ready' | 'failed' | 'loading' = 'ready', options: { beadId?: string; catalog?: ColorCatalog } = {}) {
  const bead = ref(findBead(options.beadId ?? 'miyuki/delica/11-0'))
  const colors = { available: ref(true), state: ref(state), swatches: ref(swatches), bead, catalog: ref(options.catalog), load: vi.fn(), add: vi.fn(() => 'added' as const) } as unknown as BeadColors
  return { colors, bead, wrapper: mount(BeadColorList, { props: { colors } }) }
}

const codes = (wrapper: VueWrapper) => wrapper.findAll('[data-testid="bead-color"]').map((row) => row.attributes('data-code'))
const names = (wrapper: VueWrapper, testid: string) => wrapper.findAll(`[data-testid="${testid}"]`).map((button) => button.attributes('aria-label'))
const press = (wrapper: VueWrapper, testid: string, value: string) => wrapper.get(`[data-testid="${testid}"][data-value="${value}"]`).trigger('click')

/** Four codes of three families in three Finishes: enough for every count to differ. */
const four = [entry({}), entry({ code: 'DB2', family: 'Gray', finish: 'matte', discontinued: true }), entry({ code: 'DB3', family: 'Blue', finish: 'matte' }), entry({ code: 'DB4', family: 'Red', finish: 'opaque' })]

describe('BeadColorList', () => {
  it('lists a code with its family, Finish and an approximate swatch, and says a code is discontinued', () => {
    const { wrapper, colors } = setup([entry({}), entry({ code: 'DB2', family: 'Gray', finish: 'matte', discontinued: true })])

    const rows = wrapper.findAll('[data-testid="bead-color"]')
    expect(rows[0]!.text()).toContain(`DB1`)
    expect(rows[0]!.text()).toContain(`${en.colorNames.blue} · ${en.palette.beadColors.finishes.metallic}`)
    expect(rows[1]!.text()).toContain(en.palette.beadColors.discontinued)
    expect(colors.load).toHaveBeenCalled()
  })

  it('adds a code’s color when pressed', async () => {
    const { wrapper, colors } = setup([entry({})])

    await wrapper.get('[data-testid="bead-color"]').trigger('click')

    expect(colors.add).toHaveBeenCalledWith('#123456', 'DB1')
    expect(wrapper.emitted('added')).toEqual([['#123456']])
  })

  it('shows a code whose color is in the Palette as taken, with a message, and does not add it', async () => {
    const { wrapper, colors } = setup([entry({ taken: true })])
    const row = wrapper.get('[data-testid="bead-color"]')

    await row.trigger('click')

    expect(row.attributes('aria-disabled')).toBe('true')
    expect(row.text()).toContain(en.palette.beadColors.inPalette)
    expect(wrapper.text()).not.toContain(en.palette.beadColors.takenNote)
    expect(colors.add).not.toHaveBeenCalled()
  })

  it('narrows the list by code or color family, and names the search text when nothing matches', async () => {
    const { wrapper } = setup([entry({}), entry({ code: 'DB2', family: 'Red' })])

    await wrapper.get('[data-testid="bead-colors-search"]').setValue('red')
    expect(codes(wrapper)).toEqual(['DB2'])

    await wrapper.get('[data-testid="bead-colors-search"]').setValue('zzz')
    expect(wrapper.get('[data-testid="bead-colors-empty"]').text()).toBe('No code matches zzz.')
    expect(wrapper.find('[data-testid="bead-colors-clear-filters"]').exists()).toBe(false)
  })

  // The order itself is `searchBeadColors`'s rule (beadColorFilter.test.ts); here only that the list reads the Bead's shop code.
  it('lists a partly typed shop code’s matches in the search’s order (tickets 0696, 0713)', async () => {
    const { wrapper } = setup([entry({ code: 'DB40' }), entry({ code: 'DB433' }), entry({ code: 'DB4' }), entry({ code: 'DB1433' })])

    await wrapper.get('[data-testid="bead-colors-search"]').setValue('DB-04')

    expect(codes(wrapper)).toEqual(['DB4', 'DB40', 'DB433'])
  })

  it('says so when the catalog could not be loaded', () => {
    const { wrapper } = setup([], 'failed')

    expect(wrapper.get('[data-testid="bead-colors-failed"]').text()).toBe(en.palette.beadColors.failed)
  })
})

describe('the Bead colors filters (ticket 0713)', () => {
  it('offers the Brand’s families present as swatches in the Brand’s order, and the Finishes present as check lines, each named with its count', () => {
    const { wrapper } = setup(four)

    expect(wrapper.get('[data-testid="bead-colors-filter-color"]').attributes('aria-label')).toBe(en.palette.beadColors.colorFilter)
    expect(wrapper.get('[data-testid="bead-colors-filter-finish"]').attributes('aria-label')).toBe(en.palette.beadColors.finishFilter)
    expect(names(wrapper, 'bead-colors-family')).toEqual(['Red, 1', 'Blue, 2', 'Gray, 1'])
    expect(names(wrapper, 'bead-colors-finish')).toEqual(['Opaque, 1', 'Matte, 2', 'Metallic, 1'])
    expect(wrapper.findAll('[aria-pressed="true"]')).toHaveLength(0)
    expect(wrapper.get('[data-testid="bead-colors-family"][data-value="Blue"]').attributes('style')).toContain('background-color')
  })

  it('combines the rows with each other and the search, keeps every count live, and dims a value with no rows but still takes its press', async () => {
    const { wrapper } = setup(four)

    await press(wrapper, 'bead-colors-family', 'Blue')
    expect(codes(wrapper)).toEqual(['DB1', 'DB3'])
    expect(wrapper.get('[data-testid="bead-colors-family"][data-value="Blue"]').attributes('aria-pressed')).toBe('true')
    expect(names(wrapper, 'bead-colors-finish')).toEqual(['Opaque, 0', 'Matte, 1', 'Metallic, 1'])
    expect(names(wrapper, 'bead-colors-family')).toEqual(['Red, 1', 'Blue, 2', 'Gray, 1'])
    const opaque = wrapper.get('[data-testid="bead-colors-finish"][data-value="opaque"]')
    expect(opaque.attributes('data-none')).toBe('true')

    await press(wrapper, 'bead-colors-finish', 'matte')
    expect(codes(wrapper)).toEqual(['DB3'])

    await opaque.trigger('click')
    expect(opaque.attributes('aria-pressed')).toBe('true')

    await press(wrapper, 'bead-colors-family', 'Gray')
    await wrapper.get('[data-testid="bead-colors-search"]').setValue('DB1')
    expect(codes(wrapper)).toEqual([])
    expect(wrapper.get('[data-testid="bead-colors-empty"]').text()).toBe('No opaque or matte Blue or Gray codes match DB1.')

    await wrapper.get('[data-testid="bead-colors-clear-filters"]').trigger('click')
    expect(wrapper.findAll('[aria-pressed="true"]')).toHaveLength(0)
    expect((wrapper.get('[data-testid="bead-colors-search"]').element as HTMLInputElement).value).toBe('DB1')
    expect(codes(wrapper)).toEqual(['DB1'])
  })

  it('names the on values alone when they leave nothing and nothing is typed', async () => {
    const { wrapper } = setup(four)

    await press(wrapper, 'bead-colors-family', 'Red')
    await press(wrapper, 'bead-colors-finish', 'matte')

    expect(wrapper.get('[data-testid="bead-colors-empty"]').text()).toBe('No matte Red codes.')
  })

  it('says which sizes a typed code exists in when this Bead’s size lacks it', async () => {
    const catalog: ColorCatalog = {
      id: 'toho',
      codes: [
        { code: '4', family: ['Crystal'], finish: 'transparent', wording: 'Transparent', sizes: ['15/0', '11/0', '8/0'] },
        { code: '52', family: ['Red'], finish: 'opaque', wording: 'Opaque', sizes: ['6/0'] },
      ],
    }
    const { wrapper } = setup([entry({ code: '52', family: 'Red', finish: 'opaque' })], 'ready', { beadId: 'toho/round/6-0', catalog })

    await wrapper.get('[data-testid="bead-colors-search"]').setValue('#4')

    expect(wrapper.get('[data-testid="bead-colors-empty"]').text()).toBe('4 exists in 15/0, 11/0, and 8/0, not in 6/0.')
  })

  it('turns every value off when the Bead changes', async () => {
    const { wrapper, bead } = setup(four)
    await press(wrapper, 'bead-colors-family', 'Blue')
    expect(wrapper.findAll('[aria-pressed="true"]')).toHaveLength(1)

    bead.value = findBead('miyuki/delica/15-0')
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[aria-pressed="true"]')).toHaveLength(0)
  })

  it('gives each row one Tab stop', () => {
    const { wrapper } = setup(four)

    expect(wrapper.findAll('[data-testid="bead-colors-family"]').map((button) => button.attributes('tabindex'))).toEqual(['0', '-1', '-1'])
    expect(wrapper.findAll('[data-testid="bead-colors-finish"]').map((button) => button.attributes('tabindex'))).toEqual(['0', '-1', '-1'])
  })

  it('moves through the Finish list with Up, Down, Home and End, and through the Color swatches with the arrows (ticket 0746)', async () => {
    const wrapper = mount(BeadColorList, { props: { colors: setup(four).colors }, attachTo: document.body })
    const finish = wrapper.findAll<HTMLElement>('[data-testid="bead-colors-finish"]').map((button) => button.element)
    const color = wrapper.findAll<HTMLElement>('[data-testid="bead-colors-family"]').map((button) => button.element)
    const key = async (group: string, name: string, from: HTMLElement) => {
      from.focus()
      await wrapper.get(`[data-testid="${group}"]`).trigger('keydown', { key: name })
      return document.activeElement
    }

    expect(await key('bead-colors-filter-finish', 'ArrowDown', finish[0]!)).toBe(finish[1])
    expect(await key('bead-colors-filter-finish', 'ArrowUp', finish[1]!)).toBe(finish[0])
    expect(await key('bead-colors-filter-finish', 'ArrowRight', finish[0]!)).toBe(finish[0])
    expect(await key('bead-colors-filter-finish', 'End', finish[0]!)).toBe(finish[2])
    expect(await key('bead-colors-filter-finish', 'Home', finish[2]!)).toBe(finish[0])
    expect(await key('bead-colors-filter-color', 'ArrowRight', color[0]!)).toBe(color[1])
    expect(await key('bead-colors-filter-color', 'End', color[0]!)).toBe(color[2])
    wrapper.unmount()
  })

  it('lays the filters out in the DOM after the search and before the rows, for the focus order (ticket 0746)', () => {
    const { wrapper } = setup(four)
    const order = ['bead-colors-search', 'bead-colors-filters-toggle', 'bead-colors-filter-color', 'bead-colors-filter-finish', 'bead-color']
    const all = [...wrapper.element.querySelectorAll('[data-testid]')]

    const at = order.map((id) => all.findIndex((el) => el.getAttribute('data-testid') === id))

    expect(at.every((index) => index >= 0)).toBe(true)
    expect(at).toEqual([...at].sort((a, b) => a - b))
  })

  it('shows Clear filters in the filter column only while a value is on, and turns the values off but keeps the search', async () => {
    const { wrapper } = setup(four)
    expect(wrapper.find('[data-testid="bead-colors-filters-clear"]').exists()).toBe(false)

    await wrapper.get('[data-testid="bead-colors-search"]').setValue('DB')
    await press(wrapper, 'bead-colors-finish', 'matte')
    await wrapper.get('[data-testid="bead-colors-filters-clear"]').trigger('click')

    expect(wrapper.findAll('[aria-pressed="true"]')).toHaveLength(0)
    expect((wrapper.get('[data-testid="bead-colors-search"]').element as HTMLInputElement).value).toBe('DB')
    expect(wrapper.find('[data-testid="bead-colors-filters-clear"]').exists()).toBe(false)
  })
})

describe('the Filters disclosure of the narrow layout (ticket 0746)', () => {
  const toggle = (wrapper: VueWrapper) => wrapper.get('[data-testid="bead-colors-filters-toggle"]')

  it('starts closed, opens the filters on a press and names how many values are on, with a count badge', async () => {
    const { wrapper } = setup(four)
    const filters = wrapper.get('[data-testid="bead-colors-filters"]')

    expect(toggle(wrapper).attributes('aria-expanded')).toBe('false')
    expect(toggle(wrapper).attributes('aria-label')).toBe('Filters')
    expect(wrapper.find('[data-testid="bead-colors-filters-badge"]').exists()).toBe(false)
    expect(filters.classes()).not.toContain('bead-color-list__filters--open')

    await toggle(wrapper).trigger('click')
    expect(toggle(wrapper).attributes('aria-expanded')).toBe('true')
    expect(filters.classes()).toContain('bead-color-list__filters--open')

    await press(wrapper, 'bead-colors-family', 'Blue')
    await press(wrapper, 'bead-colors-finish', 'matte')
    expect(toggle(wrapper).attributes('aria-label')).toBe('Filters, 2 on')
    expect(wrapper.get('[data-testid="bead-colors-filters-badge"]').text()).toBe('2')
  })
})

describe('the count line (ticket 0746)', () => {
  const many = (count: number) => Array.from({ length: count }, (_, i) => entry({ code: `DB${i + 1}` }))

  it('counts the codes, and says only the first 60 are shown past 60', () => {
    expect(setup(four).wrapper.get('[data-testid="bead-colors-count"]').text()).toBe('codes: 4')

    const { wrapper } = setup(many(61))
    expect(wrapper.get('[data-testid="bead-colors-count"]').findAll('span').map((span) => span.text())).toEqual(['codes: 61', 'first 60 shown'])
    expect(codes(wrapper)).toHaveLength(60)
  })

  it('counts the matches, "codes: 0" included in the empty state, and has no Showing-the-first note', async () => {
    const { wrapper } = setup(four)
    await wrapper.get('[data-testid="bead-colors-search"]').setValue('zzz')

    expect(wrapper.get('[data-testid="bead-colors-count"]').text()).toBe('codes: 0')
    expect(wrapper.text()).not.toContain('Showing the first')
  })
})

describe('the foot row (ticket 0700)', () => {
  it('offers a color Report at its foot only when the list has one, from the row last focused', async () => {
    expect(setup([entry({})]).wrapper.find('[data-testid="bead-colors-report"]').exists()).toBe(false)
    const report = vi.fn()
    const bead = ref(findBead('miyuki/delica/11-0'))
    const colors = { available: ref(true), state: ref('ready'), swatches: ref(four), bead, catalog: ref(), load: vi.fn(), add: vi.fn(), report } as unknown as BeadColors
    const wrapper = mount(BeadColorList, { props: { colors }, attachTo: document.body })
    const foot = wrapper.get('[data-testid="bead-colors-report"]')
    expect(foot.text()).toBe(en.palette.beadColors.reportColor)
    await foot.trigger('click')
    expect(report).toHaveBeenLastCalledWith(undefined)
    await wrapper.get('[data-testid="bead-color"][data-code="DB3"]').trigger('focus')
    await foot.trigger('click')
    expect(report).toHaveBeenLastCalledWith({ code: 'DB3', hex: '#123456' })
    wrapper.unmount()
  })
})
