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
  it('is the beaded cup alone, with no words', () => {
    const wrapper = tile()
    expect(wrapper.text()).toBe('')
    expect(wrapper.find('h3').exists()).toBe(false)
    expect(wrapper.findAll('a')).toHaveLength(1)
  })

  it('makes the cup a Buy me a coffee link that opens the Coffee link in a new tab', () => {
    const link = tile().get('[data-testid="homepage-coffee-button"]')
    expect(link.element.tagName).toBe('A')
    expect(link.attributes('aria-label')).toBe('Buy me a coffee')
    expect(link.attributes('href')).toBe('https://buymeacoffee.com/openbeads')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener')
    expect(link.find('[data-testid="coffee-cup"]').exists()).toBe(true)
  })

  it('names the link in Russian too', () => {
    expect(tile('ru').get('[data-testid="homepage-coffee-button"]').attributes('aria-label')).toBe('Угостить кофе')
  })

  it('is no link while the Coffee link is empty', () => {
    coffee.url = ''
    const cup = tile().get('[data-testid="homepage-coffee-button"]')
    expect(cup.element.tagName).toBe('DIV')
    expect(cup.attributes('href')).toBeUndefined()
    expect(cup.attributes('aria-label')).toBeUndefined()
  })

  it('hides the cup and steam from screen readers, with three beads of steam', () => {
    const cup = tile().find('[data-testid="coffee-cup"]')
    expect(cup.attributes('aria-hidden')).toBe('true')
    expect(cup.findAll('.coffee-cup__steam')).toHaveLength(3)
  })
})
