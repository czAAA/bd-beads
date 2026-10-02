import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PlanTiles from './PlanTiles.vue'

function tiles(locale: 'en' | 'ru' = 'en') {
  localStorage.setItem('bd-beads:locale', locale)
  return mount(PlanTiles)
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
    expect(wrapper.find('[data-testid="plan-free-account"]').findAll('li')).toHaveLength(4)
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
      expect(button.attributes('disabled')).toBeDefined()
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
