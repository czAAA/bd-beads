import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CoffeeTile from './CoffeeTile.vue'

const coffee = vi.hoisted(() => ({ url: 'https://buymeacoffee.com/openbeads' }))
vi.mock('../data/coffeeLink', () => ({
  get COFFEE_URL() {
    return coffee.url
  },
}))

function tile(locale: 'en' | 'ru' = 'en') {
  localStorage.setItem('openbeads:locale', locale)
  return mount(CoffeeTile)
}

beforeEach(() => {
  localStorage.clear()
  coffee.url = 'https://buymeacoffee.com/openbeads'
})

describe('CoffeeTile', () => {
  it('says who made it, in one line, in English', () => {
    const wrapper = tile()
    expect(wrapper.find('h3').text()).toBe('Made by one family')
    expect(wrapper.find('p').text()).toContain('stays free and fully local')
  })

  it('says it in Russian too', () => {
    const wrapper = tile('ru')
    expect(wrapper.find('h3').text()).toBe('Делает одна семья')
    expect(wrapper.find('p').text()).toContain('остаётся бесплатным и полностью локальным')
    expect(wrapper.get('[data-testid="homepage-coffee-button"]').text()).toBe('Угостить кофе')
  })

  it('has a Buy me a coffee link that opens the Coffee link in a new tab', () => {
    const link = tile().get('[data-testid="homepage-coffee-button"]')
    expect(link.element.tagName).toBe('A')
    expect(link.text()).toBe('Buy me a coffee')
    expect(link.classes()).toContain('app-button--secondary')
    expect(link.attributes('href')).toBe('https://buymeacoffee.com/openbeads')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener')
  })

  it('makes the cup a pointer shortcut to the Coffee link, out of the Tab order and hidden from screen readers', () => {
    const cup = tile().get('[data-testid="homepage-coffee-cup-link"]')
    expect(cup.element.tagName).toBe('A')
    expect(cup.attributes('href')).toBe('https://buymeacoffee.com/openbeads')
    expect(cup.attributes('target')).toBe('_blank')
    expect(cup.attributes('tabindex')).toBe('-1')
    expect(cup.attributes('aria-hidden')).toBe('true')
    expect(cup.find('[data-testid="coffee-cup"]').exists()).toBe(true)
  })

  it('makes the cup no link while the Coffee link is empty', () => {
    coffee.url = ''
    const cup = tile().get('[data-testid="homepage-coffee-cup-link"]')
    expect(cup.element.tagName).toBe('DIV')
    expect(cup.attributes('href')).toBeUndefined()
  })

  it('links to the source in a small line under the button', () => {
    const wrapper = tile()
    const link = wrapper.get('[data-testid="homepage-coffee-source"]')
    expect(link.element.tagName).toBe('A')
    expect(link.text()).toBe('View the source')
    expect(link.attributes('href')).toBe('https://github.com/czAAA/bd-beads')
    expect(link.attributes('target')).toBe('_blank')
    expect(wrapper.get('.coffee__star').text()).toContain('A star on GitHub helps too.')
  })

  it('does nothing while the Coffee link is empty', async () => {
    coffee.url = ''
    const button = tile().get('[data-testid="homepage-coffee-button"]')
    expect(button.element.tagName).toBe('BUTTON')
    expect(button.attributes('href')).toBeUndefined()
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
