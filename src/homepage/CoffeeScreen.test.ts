import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { RELEASE_NOTES } from '../data/releaseNotes'
import { en } from '../i18n/en'
import CoffeeScreen from './CoffeeScreen.vue'

beforeEach(() => localStorage.clear())

describe('CoffeeScreen (ticket 0823)', () => {
  it("has the band, then the What's new, Open source and Say hello tiles, each named by its heading", () => {
    const wrapper = mount(CoffeeScreen)
    expect(wrapper.find('[data-testid="homepage-coffee-band"]').exists()).toBe(true)
    const tiles = wrapper.get('[data-testid="homepage-tiles"]').findAll('article')
    expect(tiles.map((tile) => tile.get('h3').text())).toEqual([en.homepage.whatsNew.name, en.homepage.openSource.name, en.homepage.sayHello.name])
    expect(tiles[1].get('p').text()).toBe(en.homepage.openSource.text)
  })

  it("shows What's new: the three newest release notes, each dated, then Every change, the source's history in a new tab", () => {
    const tile = mount(CoffeeScreen).get('[data-testid="homepage-tile-whats-new"]')
    const notes = tile.findAll('[data-testid="homepage-release-note"]')
    expect(notes).toHaveLength(3)
    expect(notes[0].get('time').attributes('datetime')).toBe(RELEASE_NOTES[0].date)
    expect(notes[0].get('.whats-new__line').text()).toBe(RELEASE_NOTES[0].line.en)
    const link = tile.get('[data-testid="homepage-history"]')
    expect(link.element.tagName).toBe('A')
    expect(link.text()).toBe(en.homepage.whatsNew.history)
    expect(link.attributes('href')).toBe('https://github.com/czAAA/bd-beads/commits/main')
    expect(link.attributes('target')).toBe('_blank')
  })

  it("shows What's new in the language shown", () => {
    localStorage.setItem('openbeads:locale', 'ru')
    const tile = mount(CoffeeScreen).get('[data-testid="homepage-tile-whats-new"]')
    expect(tile.get('.whats-new__line').text()).toBe(RELEASE_NOTES[0].line.ru)
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

  it('on a phone lists the promises under the band, each with its line, but Keyboard shortcuts (ticket 0827)', () => {
    const wrapper = mount(CoffeeScreen, { props: { phone: true } })
    expect(wrapper.find('[data-testid="homepage-coffee-band"] [data-testid="homepage-promises"]').exists()).toBe(false)
    const list = wrapper.get('[data-testid="homepage-promises"]')
    expect(list.classes()).toContain('grouped-list')
    const rows = list.findAll('[data-testid^="homepage-promise-"]')
    expect(rows.map((row) => row.attributes('data-testid'))).toEqual(['device', 'offline', 'noAds', 'pencil', 'free'].map((id) => `homepage-promise-${id}`))
    expect(rows[1].text()).toBe(`${en.homepage.promises.offline.name}. ${en.homepage.promises.offline.text}`)
    const order = [...wrapper.get('[data-testid="homepage-coffee"]').element.children].map((el) => el.getAttribute('data-testid'))
    expect(order).toEqual(['homepage-coffee-band', 'homepage-promises', 'homepage-tiles'])
  })
})

