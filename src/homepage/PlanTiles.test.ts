import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PlanTiles from './PlanTiles.vue'
import { freeListRows } from './freeList'
import { en } from '../i18n/en'

function tiles(locale: 'en' | 'ru' = 'en', props: { freeHeight?: number; freeOpen?: boolean } = {}) {
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

  it('gives each tile a strand of one to three beads', () => {
    expect(tiles().findAll('.plan__strand').map((s) => s.findAll('.plan__bead').length)).toEqual([1, 2, 3])
  })

  describe('the free list (ticket 0742)', () => {
    it('is No account’s list under "forever free:", every row read out, then "More on the way"', () => {
      const tile = tiles().get('[data-testid="plan-no-account"]')
      const list = tile.get('ul')
      expect(tile.get(`#${list.attributes('aria-labelledby')}`).text()).toBe('forever free:')
      expect(list.findAll('li').map((item) => item.text())).toEqual([...freeListRows(en, 'en'), 'More on the way'])
      expect(tile.get('[data-testid="free-more"]').classes()).toContain('free-list__item--more')
    })

    it('is as tall as the page has grown it, faded at its foot until the whole list is out', () => {
      const growing = tiles('en', { freeHeight: 140, freeOpen: false }).get('[data-testid="free-window"]')
      expect(growing.attributes('style')).toContain('height: 140px')
      expect(growing.classes()).toContain('plan__free--fading')
      expect(tiles('en', { freeHeight: 700, freeOpen: true }).get('[data-testid="free-window"]').classes()).not.toContain('plan__free--fading')
    })

    it('has no window of its own to scroll or tab to', () => {
      const window = tiles().get('[data-testid="free-window"]')
      expect(window.attributes('tabindex')).toBeUndefined()
      expect(window.attributes('role')).toBeUndefined()
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

  it('greys Free account and Pro out: disabled, listing nothing, a Coming soon stamp where the list was', async () => {
    const wrapper = tiles()
    const lines = { 'plan-free-account': 'Same as No account, plus more', 'plan-pro': 'Same as Free account, plus more' }
    for (const [id, line] of Object.entries(lines)) {
      const tile = wrapper.get(`[data-testid="${id}"]`)
      expect(tile.attributes('aria-disabled')).toBe('true')
      expect(tile.classes()).toContain('plan--off')
      expect(tile.text()).toContain(line)
      expect(tile.text()).not.toContain('coming later')
      expect(tile.find('ul').exists()).toBe(false)
      expect(tile.get('[role="img"]').attributes('aria-label')).toBe('Coming soon')
      expect(tile.get('[role="img"]').text()).toBe('COMING SOON')
      const button = tile.get('button')
      expect(button.attributes('aria-disabled')).toBe('true')
      await button.trigger('click')
    }
    expect(wrapper.emitted('openEditor')).toBeUndefined()
  })

  it('wears each stamp its own way', () => {
    const filters = tiles().findAll('[role="img"] filter')
    expect(new Set(filters.map((filter) => filter.attributes('id'))).size).toBe(2)
    expect(new Set(filters.map((filter) => filter.get('feTurbulence').attributes('seed'))).size).toBe(2)
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
    expect(wrapper.get('[data-testid="plan-pro"] [role="img"]').text()).toBe('СКОРО')
    expect(wrapper.get('[data-testid="plan-no-account"]').text()).toContain('бесплатно навсегда:')
  })
})
