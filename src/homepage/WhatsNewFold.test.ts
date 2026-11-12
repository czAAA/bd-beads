import { beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { RELEASE_NOTES } from '../data/releaseNotes'
import { en } from '../i18n/en'
import WhatsNewFold from './WhatsNewFold.vue'

beforeEach(() => localStorage.clear())

describe("What's new, folded (tickets 0824, 0880)", () => {
  const head = (wrapper: VueWrapper) => wrapper.get('[data-testid="homepage-whats-new-toggle"]')

  it("starts closed, showing its name and the newest note's date", () => {
    const wrapper = mount(WhatsNewFold)
    expect(head(wrapper).attributes('aria-expanded')).toBe('false')
    expect(head(wrapper).text()).toContain(en.homepage.whatsNew.name)
    expect(head(wrapper).get('time').attributes('datetime')).toBe(RELEASE_NOTES[0].date)
    expect(wrapper.get('[data-testid="homepage-whats-new-notes"]').isVisible()).toBe(false)
  })

  it("opens to the three newest release notes and Every change, the source's history in a new tab, and closes again", async () => {
    const wrapper = mount(WhatsNewFold)
    await head(wrapper).trigger('click')
    expect(head(wrapper).attributes('aria-expanded')).toBe('true')
    const body = wrapper.get('[data-testid="homepage-whats-new-notes"]')
    expect(body.isVisible()).toBe(true)
    expect(head(wrapper).attributes('aria-controls')).toBe(body.attributes('id'))
    const notes = body.findAll('[data-testid="homepage-release-note"]')
    expect(notes).toHaveLength(3)
    expect(notes[0].get('time').attributes('datetime')).toBe(RELEASE_NOTES[0].date)
    expect(notes[0].get('.whats-new__line').text()).toBe(RELEASE_NOTES[0].line.en)
    const link = body.get('[data-testid="homepage-history"]')
    expect(link.text()).toBe(en.homepage.whatsNew.history)
    expect(link.attributes('href')).toBe('https://github.com/czAAA/bd-beads/commits/main')
    expect(link.attributes('target')).toBe('_blank')
    await head(wrapper).trigger('click')
    expect(head(wrapper).attributes('aria-expanded')).toBe('false')
  })

  it('is in the language shown', async () => {
    localStorage.setItem('openbeads:locale', 'ru')
    const wrapper = mount(WhatsNewFold)
    await head(wrapper).trigger('click')
    expect(wrapper.get('.whats-new__line').text()).toBe(RELEASE_NOTES[0].line.ru)
  })

})
