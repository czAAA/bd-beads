import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { en } from '../i18n/en'
import CoffeeBand from './CoffeeBand.vue'

const coffee = vi.hoisted(() => ({ url: 'https://buymeacoffee.com/openbeads' }))
vi.mock('../data/coffeeLink', () => ({
  get COFFEE_URL() {
    return coffee.url
  },
}))

function band(locale: 'en' | 'ru' = 'en') {
  localStorage.setItem('openbeads:locale', locale)
  return mount(CoffeeBand)
}

beforeEach(() => {
  localStorage.clear()
  coffee.url = 'https://buymeacoffee.com/openbeads'
})

describe('CoffeeBand', () => {
  it('says who made it, in one line, in English', () => {
    const wrapper = band()
    expect(wrapper.find('h3').text()).toBe('Made by one family')
    expect(wrapper.get('.coffee__text').text()).toContain('stays free and fully local')
  })

  it('says it in Russian too', () => {
    const wrapper = band('ru')
    expect(wrapper.find('h3').text()).toBe('Делает одна семья')
    expect(wrapper.get('.coffee__text').text()).toContain('остаётся бесплатным и полностью локальным')
    expect(wrapper.get('[data-testid="homepage-coffee-button"]').text()).toBe('Угостить кофе')
  })

  it('has a primary Buy me a coffee link that opens the Coffee link in a new tab', () => {
    const link = band().get('[data-testid="homepage-coffee-button"]')
    expect(link.element.tagName).toBe('A')
    expect(link.text()).toBe('Buy me a coffee')
    expect(link.classes()).toContain('app-button--primary')
    expect(link.attributes('href')).toBe('https://buymeacoffee.com/openbeads')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener')
  })

  it('makes the cup a pointer shortcut to the Coffee link, out of the Tab order and hidden from screen readers', () => {
    const cup = band().get('[data-testid="homepage-coffee-cup-link"]')
    expect(cup.element.tagName).toBe('A')
    expect(cup.attributes('href')).toBe('https://buymeacoffee.com/openbeads')
    expect(cup.attributes('target')).toBe('_blank')
    expect(cup.attributes('tabindex')).toBe('-1')
    expect(cup.attributes('aria-hidden')).toBe('true')
    expect(cup.find('[data-testid="coffee-cup"]').exists()).toBe(true)
  })

  it('makes the cup no link while the Coffee link is empty', () => {
    coffee.url = ''
    const cup = band().get('[data-testid="homepage-coffee-cup-link"]')
    expect(cup.element.tagName).toBe('DIV')
    expect(cup.attributes('href')).toBeUndefined()
  })

  it('shows the six promises, each an item with its icon and name, its line kept for screen readers, nothing to press', () => {
    const promises = band().findAll('[data-testid^="homepage-promise-"]')
    expect(promises.map((promise) => promise.element.tagName)).toEqual(Array(6).fill('LI'))
    expect(promises.map((promise) => promise.get('.coffee__promise-name').text())).toEqual(Object.values(en.homepage.promises).map((copy) => copy.name))
    expect(promises[1].text()).toBe(`${en.homepage.promises.offline.name}. ${en.homepage.promises.offline.text}`)
    expect(promises.every((promise) => promise.find('svg').exists() && !promise.find('button, a').exists())).toBe(true)
  })

  it('does nothing while the Coffee link is empty', async () => {
    coffee.url = ''
    const button = band().get('[data-testid="homepage-coffee-button"]')
    expect(button.element.tagName).toBe('BUTTON')
    expect(button.attributes('href')).toBeUndefined()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    await button.trigger('click')
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('hides the cup and steam from screen readers, with three beads of steam', () => {
    const cup = band().find('[data-testid="coffee-cup"]')
    expect(cup.attributes('aria-hidden')).toBe('true')
    expect(cup.findAll('.coffee-cup__steam')).toHaveLength(3)
  })
})
