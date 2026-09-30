import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import OverviewPage from './OverviewPage.vue'

const FEATURES = ['techniques', 'patternEditing', 'convertImage', 'rowProgress', 'beadsNeeded', 'exports', 'savedPatterns']

function page(patternCount = 0) {
  return mount(OverviewPage, { props: { patternCount, overviewHref: '/bd-beads/overview/' } })
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
})

describe('OverviewPage', () => {
  it('lists the seven features in order, each with an icon, and no Mirror', () => {
    const items = page().findAll('[data-testid="overview-features"] > li')
    expect(items.map((li) => li.attributes('data-feature'))).toEqual(FEATURES)
    for (const li of items) expect(li.find('svg[data-icon]').exists()).toBe(true)
    expect(items[0]!.text()).toContain('Loom, peyote and brick stitch')
    expect(items[6]!.text()).toContain('Kept on this device. No account needed.')
    expect(page().text()).not.toMatch(/mirror/i)
  })

  describe('for a new visitor', () => {
    it('offers "Make your first Pattern" as the primary button and "Open the editor" beside it', async () => {
      const wrapper = page()
      const make = wrapper.find('[data-testid="overview-make-first"]')
      expect(make.text()).toBe('Make your first Pattern')
      expect(make.classes()).toContain('app-button--primary')
      expect(wrapper.find('[data-testid="overview-open-editor"]').text()).toBe('Open the editor')

      await make.trigger('click')
      await wrapper.find('[data-testid="overview-open-editor"]').trigger('click')
      expect(wrapper.emitted('makeFirstPattern')).toHaveLength(1)
      expect(wrapper.emitted('openEditor')).toHaveLength(1)
    })
  })

  describe('the hero band and notes', () => {
    it('shows the Tour Pattern band and the notes to a new visitor, all hidden from screen readers', () => {
      const wrapper = page()
      expect(wrapper.find('[data-testid="tour-band"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="tour-band"]').attributes('aria-hidden')).toBe('true')
      for (const [id, text] of [
        ['you', 'you'],
        ['on-us', 'on us'],
        ['steps', 'eleven small steps'],
        ['make-this', "you'll make this"],
      ]) {
        const note = wrapper.find(`[data-testid="overview-note-${id}"]`)
        expect(note.text()).toBe(text)
        expect(note.attributes('aria-hidden')).toBe('true')
      }
    })

    it('puts "you" on the first word of the slogan and leaves the slogan reading as before', () => {
      const slogan = page().find('[data-testid="overview-slogan"]')
      expect(slogan.find('[data-testid="overview-note-you"]').exists()).toBe(true)
      expect(slogan.text().replace('you', '')).toBe('Draw. Joy. Weave.')
    })

    it('has the Russian notes', async () => {
      const wrapper = page()
      await wrapper.find('[data-testid="language-switcher"]').trigger('click')
      expect(wrapper.find('[data-testid="overview-note-make-this"]').text()).toBe('её вы и сделаете')
      expect(wrapper.find('[data-testid="overview-note-steps"]').text()).toBe('одиннадцать коротких шагов')
    })

    it('shows neither the band nor the notes once Patterns are saved', () => {
      const wrapper = page(2)
      expect(wrapper.find('[data-testid="tour-band"]').exists()).toBe(false)
      expect(wrapper.findAll('.overview__note')).toHaveLength(0)
      expect(wrapper.find('[data-testid="overview-slogan"]').text()).toBe('Draw. Joy. Weave.')
    })
  })

  describe('with Patterns saved', () => {
    it('offers only "Open the editor", as the primary button, and the count', () => {
      const wrapper = page(3)
      expect(wrapper.find('[data-testid="overview-make-first"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="overview-open-editor"]').classes()).toContain('app-button--primary')
      expect(wrapper.find('[data-testid="overview-saved"]').text()).toBe('Patterns saved: 3')
    })
  })

  it('has the header menu, Language and Theme but no Keyboard shortcuts', () => {
    const wrapper = page()
    expect(wrapper.find('[data-testid="header-menu"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="language-switcher"]').exists()).toBe(true)
    expect(wrapper.find('[role="radiogroup"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="shortcuts-button"]').exists()).toBe(false)
  })

  it('marks Overview as the current page in the header menu', async () => {
    const wrapper = page()
    await wrapper.find('[data-testid="header-menu"]').trigger('click')
    const item = wrapper.find('[data-testid="menu-item-overview"]')
    expect(item.attributes('aria-current')).toBe('page')
    expect(item.attributes('href')).toBe('/bd-beads/overview/')
  })

  it('switches to Russian with the language switcher, and remembers it', async () => {
    const wrapper = page()
    await wrapper.find('[data-testid="language-switcher"]').trigger('click')
    expect(wrapper.find('[data-testid="overview-make-first"]').text()).toBe('Сделать первую схему')
    expect(wrapper.find('[data-testid="overview-features"] li').text()).toContain('Техники плетения')
    expect(localStorage.getItem('bd-beads:locale')).toBe('ru')
  })

  it('starts in English on a device with no saved language', () => {
    localStorage.clear()
    expect(page().find('[data-testid="overview-make-first"]').text()).toBe('Make your first Pattern')
  })
})
