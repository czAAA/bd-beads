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
    expect(wrapper.find('p').text()).toBe("openbeads is made by one family, bead by bead, and it's free. If it saved you time, a coffee says thanks.")
  })

  it('says it in Russian too', () => {
    const wrapper = tile('ru')
    expect(wrapper.find('h3').text()).toBe('Делает одна семья')
    expect(wrapper.find('p').text()).toBe(
      'openbeads делает одна семья, бисеринка за бисеринкой, и приложение бесплатное. Если приложение сэкономило вам время, кофе будет лучшим спасибо.',
    )
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
