import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { en } from '../i18n/en'
import CoffeeScreen from './CoffeeScreen.vue'

beforeEach(() => localStorage.clear())

describe('CoffeeScreen (ticket 0823)', () => {
  it('has the band, then the Open source and Say hello tiles, each named by its heading', () => {
    const wrapper = mount(CoffeeScreen)
    expect(wrapper.find('[data-testid="homepage-coffee-band"]').exists()).toBe(true)
    const tiles = wrapper.get('[data-testid="homepage-tiles"]').findAll('article')
    expect(tiles.map((tile) => tile.get('h3').text())).toEqual([en.homepage.openSource.name, en.homepage.sayHello.name])
    expect(tiles[0].get('p').text()).toBe(en.homepage.openSource.text)
    expect(tiles[1].get('p').text()).toBe("A bug, an idea, a pattern you made: send it to the family. It's also in Menu → Send feedback.")
  })

  it('links to the source from Open source, in a new tab, with the star line beside it', () => {
    const tile = mount(CoffeeScreen).get('[data-testid="homepage-tile-open-source"]')
    const link = tile.get('[data-testid="homepage-coffee-source"]')
    expect(link.element.tagName).toBe('A')
    expect(link.text()).toBe('View the source')
    expect(link.attributes('href')).toBe('https://github.com/czAAA/bd-beads')
    expect(link.attributes('target')).toBe('_blank')
    expect(tile.text()).toContain('A star on GitHub helps too.')
  })

  it("asks for the Feedback sheet from Say hello's Send feedback", async () => {
    const wrapper = mount(CoffeeScreen)
    const button = wrapper.get('[data-testid="homepage-send-feedback"]')
    expect(button.text()).toBe(en.panels.menu.sendFeedback)
    await button.trigger('click')
    expect(wrapper.emitted('feedback')).toHaveLength(1)
  })
})
