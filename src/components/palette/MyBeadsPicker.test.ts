import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import MyBeadsPicker from './MyBeadsPicker.vue'
import { findBead } from '../../domain/beads'
import { catalogSwatches } from '../../domain/beadSwatch'
import type { ColorCatalog } from '../../domain/colorCatalog'
import { brandColors } from '../../domain/palette'
import { en } from '../../i18n/en'

beforeEach(() => {
  localStorage.setItem('openbeads:locale', 'en')
})

const words = en.convertImage.wizard.myBeads
const bead = findBead('miyuki/delica/11-0')!
const catalog: ColorCatalog = {
  id: 'miyuki-delica',
  codes: [
    { code: 'DB10', family: ['Black'], finish: 'opaque', wording: 'Opaque', sizes: ['11/0'] },
    { code: 'DB72', family: ['Red'], finish: 'opaque', wording: 'Opaque', sizes: ['11/0'] },
    { code: 'DB200', family: ['White'], finish: 'opaque', wording: 'Opaque', sizes: ['11/0'] },
    { code: 'DB721', family: ['Blue'], finish: 'opaque', wording: 'Opaque', sizes: ['11/0'] },
    { code: 'DB734', family: ['Green'], finish: 'matte', wording: 'Matte', sizes: ['11/0'] },
    { code: 'DB1721', family: ['Blue'], finish: 'matte', wording: 'Matte', sizes: ['11/0'] },
    { code: 'DB31', family: ['Gold'], finish: 'plated', wording: 'Plated', sizes: ['11/0'], discontinued: true },
  ],
}
const swatches = catalogSwatches(catalog, '11/0', [], brandColors(bead.brand.id))

/** The picker over a list held by the test, as its host keeps it: a tick, a paste and Clear list change it. */
function picker(codes: string[] = []) {
  const wrapper: VueWrapper = mount(MyBeadsPicker, {
    props: {
      bead,
      swatches,
      catalog,
      codes,
      'onToggle': (code: string) => wrapper.setProps({ codes: codes = codes.includes(code) ? codes.filter((held) => held !== code) : [...codes, code] }),
      'onAdd': (added: string[]) => wrapper.setProps({ codes: codes = [...codes, ...added] }),
      'onClear': () => wrapper.setProps({ codes: (codes = []) }),
    },
    attachTo: document.body,
  })
  return { wrapper, codes: () => codes }
}

const rowCodes = (wrapper: VueWrapper) => wrapper.findAll('[data-testid="convert-my-beads-row"]').map((row) => row.attributes('data-code'))
const row = (wrapper: VueWrapper, code: string) => wrapper.get(`[data-testid="convert-my-beads-row"][data-code="${code}"]`)
const find = (wrapper: VueWrapper, text: string) => wrapper.get('[data-testid="bead-colors-search"]').setValue(text)

describe('MyBeadsPicker (ticket 0903)', () => {
  it('finds a code as a shop writes it, the exact code first, or a color by its family name', async () => {
    const { wrapper } = picker()
    for (const typed of ['721', 'DB721', 'db-0721']) {
      await find(wrapper, typed)
      expect(rowCodes(wrapper)[0], typed).toBe('DB721')
    }
    await find(wrapper, '72')
    expect(rowCodes(wrapper)).toEqual(['DB72', 'DB721', 'DB1721'])
    expect(wrapper.get('[data-testid="convert-my-beads-shown"]').text()).toBe('codes: 3')

    await find(wrapper, 'blue')
    expect(rowCodes(wrapper)).toEqual(['DB721', 'DB1721'])
  })

  it('ticks a found row with the search kept, and filters by the Palette popover’s own Finish filter', async () => {
    const { wrapper, codes } = picker()
    await find(wrapper, 'blue')
    await row(wrapper, 'DB721').trigger('click')
    expect(codes()).toEqual(['DB721'])
    expect((wrapper.get('[data-testid="bead-colors-search"]').element as HTMLInputElement).value).toBe('blue')

    await find(wrapper, '')
    await wrapper.get('[data-testid="bead-colors-filters-toggle"]').trigger('click')
    await wrapper.get('[data-testid="bead-colors-finish"][data-value="matte"]').trigger('click')
    expect(rowCodes(wrapper)).toEqual(['DB734', 'DB1721'])
    expect(wrapper.get('[data-testid="bead-colors-filters-toggle"]').attributes('aria-label')).toBe('Filters, 1 on')
    await wrapper.get('[data-testid="bead-colors-filters-clear"]').trigger('click')
    expect(rowCodes(wrapper)).toHaveLength(6)
  })

  it('opens its filters with the Finishes it is given on', () => {
    const wrapper = mount(MyBeadsPicker, { props: { bead, swatches, catalog, codes: [], startFinishes: ['matte'] } })
    expect(rowCodes(wrapper)).toEqual(['DB734', 'DB1721'])
  })

  it('adds the pasted codes the catalog knows and says how many were added, already listed and not known', async () => {
    const { wrapper, codes } = picker(['DB10'])
    await wrapper.get('[data-testid="my-beads-paste"]').trigger('click')
    expect(wrapper.get('[data-testid="my-beads-paste"]').attributes('aria-expanded')).toBe('true')
    await wrapper.get('[data-testid="my-beads-paste-field"]').setValue('DB10, 200; 734\nDB9999')
    await wrapper.get('[data-testid="my-beads-add"]').trigger('click')

    expect(codes()).toEqual(['DB10', 'DB200', 'DB734'])
    expect(wrapper.find('[data-testid="my-beads-paste-box"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="my-beads-added"]').text()).toBe('2 added')
    expect(wrapper.get('[data-testid="my-beads-already"]').text()).toBe('1 already in the list')
    expect(wrapper.get('[data-testid="my-beads-unknown"]').text()).toBe('1 not known: DB9999')
    expect(rowCodes(wrapper)).toEqual(['DB10', 'DB200', 'DB734'])

    await wrapper.get('[data-testid="my-beads-dismiss"]').trigger('click')
    expect(wrapper.find('[data-testid="my-beads-result"]').exists()).toBe(false)
  })

  it('keeps nothing when the paste box is cancelled or closed with Escape', async () => {
    const { wrapper, codes } = picker()
    await wrapper.get('[data-testid="my-beads-paste"]').trigger('click')
    await wrapper.get('[data-testid="my-beads-paste-field"]').setValue('DB10')
    await wrapper.get('[data-testid="my-beads-paste-cancel"]').trigger('click')
    expect(wrapper.find('[data-testid="my-beads-paste-box"]').exists()).toBe(false)

    await wrapper.get('[data-testid="my-beads-paste"]').trigger('click')
    expect((wrapper.get('[data-testid="my-beads-paste-field"]').element as HTMLTextAreaElement).value).toBe('')
    wrapper.get('[data-testid="my-beads-paste-field"]').element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(wrapper.find('[data-testid="my-beads-paste-box"]').exists()).toBe(false)
    expect(codes()).toEqual([])
  })

  it('adds from the clipboard at once on a paste outside a text field, and leaves a paste into the search alone', async () => {
    const { wrapper, codes } = picker()
    const paste = (target: Element) => {
      const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent
      Object.defineProperty(event, 'clipboardData', { value: { getData: () => 'DB72 DB10' } })
      target.dispatchEvent(event)
      ;(wrapper.vm as unknown as { onPaste: (event: ClipboardEvent) => void }).onPaste(event)
      return event
    }
    expect(paste(wrapper.get('[data-testid="bead-colors-search"]').element).defaultPrevented).toBe(false)
    expect(codes()).toEqual([])

    expect(paste(row(wrapper, 'DB10').element).defaultPrevented).toBe(true)
    await flushPromises()
    expect(codes()).toEqual(['DB72', 'DB10'])
    expect(wrapper.find('[data-testid="my-beads-paste-box"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="my-beads-added"]').text()).toBe('2 added')
  })

  it('keeps a discontinued or unknown code in My beads, greyed and never matched, and unticks it like any other', async () => {
    const { wrapper, codes } = picker(['DB10', 'DB31', 'DB99999'])
    expect(rowCodes(wrapper)).toEqual(['DB10', 'DB31', 'DB99999'])
    expect(row(wrapper, 'DB31').classes()).toContain('my-beads-picker__row--never')
    expect(row(wrapper, 'DB31').text()).toContain('gold plated · discontinued, never matched')
    expect(row(wrapper, 'DB99999').text()).toContain(words.unknownRow)
    expect(row(wrapper, 'DB10').classes()).not.toContain('my-beads-picker__row--never')

    await row(wrapper, 'DB31').trigger('click')
    expect(codes()).toEqual(['DB10', 'DB99999'])
    // All codes lists only the codes made now.
    await wrapper.get('[data-testid="convert-my-beads-switch"] [data-value="all"]').trigger('click')
    expect(rowCodes(wrapper)).not.toContain('DB31')
  })

  it('clears the list only on Clear list in its inline confirm; Cancel keeps it', async () => {
    const { wrapper, codes } = picker(['DB10', 'DB72'])
    await wrapper.get('[data-testid="my-beads-clear"]').trigger('click')
    expect(wrapper.get('[data-testid="my-beads-clear-ask"]').text()).toBe('Clear all 2 codes?')
    await wrapper.get('[data-testid="my-beads-clear-cancel"]').trigger('click')
    expect(codes()).toEqual(['DB10', 'DB72'])

    await wrapper.get('[data-testid="my-beads-clear"]').trigger('click')
    await wrapper.get('[data-testid="my-beads-clear-confirm"]').trigger('click')
    expect(codes()).toEqual([])
    expect(wrapper.find('[data-testid="my-beads-clear"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="convert-my-beads-empty"]').text()).toBe(words.empty)
  })
})
