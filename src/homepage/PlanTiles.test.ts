import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PlanTiles from './PlanTiles.vue'
import { en } from '../i18n/en'

function tiles(locale: 'en' | 'ru' = 'en', props = { lit: 0, unrolled: false }) {
  localStorage.setItem('openbeads:locale', locale)
  return mount(PlanTiles, { props })
}

beforeEach(() => localStorage.clear())

describe('PlanTiles', () => {
  it('shows the three plans in the design system order, with the reason written once', () => {
    const wrapper = tiles()
    expect(wrapper.find('h2').text()).toBe('Three ways to use it')
    expect(wrapper.findAll('h3').map((h) => h.text())).toEqual(['No account', 'Free account', 'Pro'])
    expect(wrapper.text().match(/aren't open yet/g)).toHaveLength(1)
    expect(wrapper.find('[data-testid="plan-no-account"]').text()).toContain('Draw, count and weave on this device.')
    expect(wrapper.find('[data-testid="plan-pro"]').text()).toContain('Price later')
  })

  it('gives each tile a strand of one to three beads, and the checks under "everything in … , plus"', () => {
    const wrapper = tiles()
    const filled = wrapper.findAll('.plan__strand').map((s) => s.findAll('.plan__bead--on').length)
    expect(filled).toEqual([1, 2, 3])
    expect(wrapper.find('[data-testid="plan-pro"]').text()).toContain('everything in Free account, plus')
    expect(wrapper.find('[data-testid="plan-free-account"]').findAll('li')).toHaveLength(3)
    expect(wrapper.find('[data-testid="plan-pro"]').findAll('li')).toHaveLength(4)
  })

  describe('the free list (ticket 0739)', () => {
    it('is the No account tile’s "what you get": every free feature, counted, in a window scrolled by hand', () => {
      const wrapper = tiles()
      const tile = wrapper.get('[data-testid="plan-no-account"]')
      expect(tile.text()).toContain('what you get')
      expect(tile.get('[data-testid="free-count"]').text()).toBe(`${en.homepage.plans.tiles[0]!.items.length} · free`)
      const window = tile.get('[data-testid="free-window"]')
      expect(window.attributes()).toMatchObject({ role: 'region', tabindex: '0', 'aria-label': 'Everything free, scroll to see all' })
      expect(window.findAll('li').map((item) => item.text())).toEqual(en.homepage.plans.tiles[0]!.items)
    })

    it('lights a bead beside the count per scroll the page counted, and says each scroll of the window', async () => {
      const wrapper = tiles('en', { lit: 2, unrolled: false })
      const ticks = wrapper.findAll('[data-testid="free-tick"]')
      expect(ticks.map((tick) => tick.classes().includes('plan__tick--on'))).toEqual([true, true, false])
      await wrapper.get('[data-testid="free-window"]').trigger('scroll')
      expect(wrapper.emitted('freeScroll')).toHaveLength(1)
    })

    it('leaves the window to the roll while the list is unrolled', () => {
      expect(tiles('en', { lit: 3, unrolled: true }).get('[data-testid="free-window"]').classes()).toContain('plan__free-window--unrolled')
    })
  })

  it('opens the editor from the No account tile, which is marked as the current one', async () => {
    const wrapper = tiles()
    const button = wrapper.find('[data-testid="plan-no-account"] button')
    expect(button.text()).toBe('Open the editor')
    expect(button.classes()).toContain('app-button--primary')
    expect(wrapper.find('[data-testid="plan-no-account"]').attributes('aria-current')).toBe('true')
    await button.trigger('click')
    expect(wrapper.emitted('openEditor')).toHaveLength(1)
  })

  it('switches Free account and Pro off: disabled, "coming later", and they do nothing', async () => {
    const wrapper = tiles()
    for (const id of ['plan-free-account', 'plan-pro']) {
      const tile = wrapper.find(`[data-testid="${id}"]`)
      const button = tile.find('button')
      expect(button.attributes('aria-disabled')).toBe('true')
      expect(tile.text()).toContain('coming later')
      await button.trigger('click')
    }
    expect(wrapper.emitted('openEditor')).toBeUndefined()
  })

  it('hides the "you are here" note from screen readers', () => {
    const note = tiles().find('[data-testid="plan-you-are-here"]')
    expect(note.text()).toBe('you are here')
    expect(note.attributes('aria-hidden')).toBe('true')
  })

  it('says it in Russian too', () => {
    const wrapper = tiles('ru')
    expect(wrapper.find('h2').text()).toBe('Три способа работать')
    expect(wrapper.findAll('h3').map((h) => h.text())).toEqual(['Без аккаунта', 'Бесплатный аккаунт', 'Pro'])
    expect(wrapper.find('[data-testid="plan-pro"] button').text()).toBe('Появится позже')
  })
})
