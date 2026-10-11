import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CoffeeTile from './CoffeeTile.vue'

function tile(locale: 'en' | 'ru' = 'en') {
  localStorage.setItem('bd-beads:locale', locale)
  return mount(CoffeeTile)
}

beforeEach(() => localStorage.clear())

describe('CoffeeTile', () => {
  it('says who made it, in one line, in English', () => {
    const wrapper = tile()
    expect(wrapper.find('h3').text()).toBe('Made by one person')
    expect(wrapper.find('p').text()).toContain('bd-beads is made by one person')
  })

  it('says it in Russian too', () => {
    const wrapper = tile('ru')
    expect(wrapper.find('h3').text()).toBe('Один человек')
    expect(wrapper.find('button').text()).toBe('Угостить кофе')
  })

  it('has a real Buy me a coffee button that goes nowhere', async () => {
    const wrapper = tile()
    const button = wrapper.find('button')
    expect(button.text()).toBe('Buy me a coffee')
    expect(button.classes()).toContain('app-button--secondary')
    expect(wrapper.find('a').exists()).toBe(false)
    expect(button.attributes('type')).toBe('button')
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    await button.trigger('click')
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('hides the cup and steam from screen readers, with three beads of steam', () => {
    const cup = tile().find('[data-testid="coffee-cup"]')
    expect(cup.attributes('aria-hidden')).toBe('true')
    expect(cup.findAll('.coffee-cup__steam')).toHaveLength(3)
  })
})
