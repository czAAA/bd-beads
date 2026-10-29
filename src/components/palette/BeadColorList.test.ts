import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import BeadColorList from './BeadColorList.vue'
import type { BeadColors } from '../../composables/palette/useBeadColors'
import type { CatalogSwatch } from '../../domain/beadSwatch'
import { en } from '../../i18n/en'
import { findBead } from '../../domain/beads'

beforeEach(() => {
  localStorage.setItem('openbeads:locale', 'en')
})

const entry = (over: Partial<CatalogSwatch>): CatalogSwatch => ({ code: 'DB1', family: 'Blue', finish: 'metallic', hex: '#123456', approximate: true, discontinued: false, taken: false, ...over })

function setup(swatches: CatalogSwatch[], state: 'ready' | 'failed' | 'loading' = 'ready') {
  const bead = ref(findBead('miyuki/delica/11-0'))
  const colors = { available: ref(true), state: ref(state), swatches: ref(swatches), bead, load: vi.fn(), add: vi.fn(() => 'added' as const) } as unknown as BeadColors
  return { colors, wrapper: mount(BeadColorList, { props: { colors } }) }
}

describe('BeadColorList', () => {
  it('lists a code with its family, Finish and an approximate swatch, and says a code is discontinued', () => {
    const { wrapper, colors } = setup([entry({}), entry({ code: 'DB2', family: 'Gray', finish: 'matte', discontinued: true })])

    const rows = wrapper.findAll('[data-testid="bead-color"]')
    expect(rows[0]!.text()).toContain(`DB1`)
    expect(rows[0]!.text()).toContain(`${en.colorNames.blue} · ${en.palette.beadColors.finishes.metallic}`)
    expect(rows[1]!.text()).toContain(en.palette.beadColors.discontinued)
    expect(wrapper.get('[data-testid="bead-colors-approximate"]').text()).toContain(en.palette.beadColors.approximate)
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
    expect(wrapper.text()).toContain(en.palette.beadColors.takenNote)
    expect(colors.add).not.toHaveBeenCalled()
  })

  it('narrows the list by code or color family', async () => {
    const { wrapper } = setup([entry({}), entry({ code: 'DB2', family: 'Red' })])

    await wrapper.get('[data-testid="bead-colors-search"]').setValue('red')
    expect(wrapper.findAll('[data-testid="bead-color"]').map((row) => row.attributes('data-code'))).toEqual(['DB2'])

    await wrapper.get('[data-testid="bead-colors-search"]').setValue('zzz')
    expect(wrapper.find('[data-testid="bead-colors-empty"]').exists()).toBe(true)
  })

  it('finds a code typed the way a shop writes it, and a part of a code as before (ticket 0696)', async () => {
    const { wrapper } = setup([entry({ code: 'DB433' }), entry({ code: 'DB1433' })])
    const codes = () => wrapper.findAll('[data-testid="bead-color"]').map((row) => row.attributes('data-code'))

    await wrapper.get('[data-testid="bead-colors-search"]').setValue('DB-0433')
    expect(codes()).toEqual(['DB433'])

    await wrapper.get('[data-testid="bead-colors-search"]').setValue('433')
    expect(codes()).toEqual(['DB433', 'DB1433'])
  })

  it('says so when the catalog could not be loaded', () => {
    const { wrapper } = setup([], 'failed')

    expect(wrapper.get('[data-testid="bead-colors-failed"]').text()).toBe(en.palette.beadColors.failed)
  })
})
