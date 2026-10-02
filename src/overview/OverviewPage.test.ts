import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import OverviewPage from './OverviewPage.vue'
import { fakeMatchMedia } from '../testUtils/fakeMatchMedia'

const FEATURES = ['techniques', 'patternEditing', 'convertImage', 'rowProgress', 'beadsNeeded', 'exports', 'savedPatterns']

function page(patternCount = 0) {
  return mount(OverviewPage, { props: { patternCount, overviewHref: '/bd-beads/overview/' } })
}

afterEach(() => vi.unstubAllGlobals())

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
})

describe('OverviewPage', () => {
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
    expect(wrapper.find('[data-testid="feature-carousel"]').text()).toContain('Техники плетения')
    expect(localStorage.getItem('bd-beads:locale')).toBe('ru')
  })

  it('starts in English on a device with no saved language', () => {
    localStorage.clear()
    expect(page().find('[data-testid="overview-make-first"]').text()).toBe('Make your first Pattern')
  })
})

describe('the features carousel', () => {
  const wideQuery = '(min-width: 1024px)'
  const mountWide = () => {
    vi.stubGlobal('matchMedia', fakeMatchMedia({ [wideQuery]: true }).matchMedia)
    return mount(OverviewPage, { props: { patternCount: 0, overviewHref: '/' }, attachTo: document.body })
  }

  it('is a named tablist of the seven features in order, each with an icon, and no Mirror (from 1024)', () => {
    const wrapper = mountWide()
    const list = wrapper.find('[role="tablist"]')
    expect(list.attributes('aria-label')).toBe("What's inside")
    const tabs = list.findAll('[role="tab"]')
    expect(tabs.map((tab) => tab.attributes('data-feature'))).toEqual(FEATURES)
    for (const tab of tabs) expect(tab.find('svg[data-icon]').exists()).toBe(true)
    expect(tabs[0]!.text()).toContain('Loom, peyote and brick stitch')
    expect(wrapper.find('[data-testid="feature-carousel"]').text()).not.toMatch(/mirror/i)
    wrapper.unmount()
  })

  it('labels each panel by its tab and shows only the selected one', () => {
    const wrapper = mountWide()
    const panels = wrapper.findAll('[role="tabpanel"]')
    expect(panels).toHaveLength(7)
    panels.forEach((panel, i) => {
      const tab = wrapper.findAll('[role="tab"]')[i]!
      expect(panel.attributes('aria-labelledby')).toBe(tab.attributes('id'))
      expect(tab.attributes('aria-controls')).toBe(panel.attributes('id'))
    })
    expect(panels.map((p) => (p.element as HTMLElement).style.display)).toEqual(['', ...Array(6).fill('none')])
    wrapper.unmount()
  })

  it('moves with the arrow keys and keeps ‹ › and the count in step', async () => {
    const wrapper = mountWide()
    const count = () => wrapper.find('[data-testid="feature-count"]').text()
    expect(count()).toBe('1 / 7')
    await wrapper.findAll('[role="tab"]')[0]!.trigger('keydown', { key: 'ArrowDown' })
    expect(count()).toBe('2 / 7')
    expect(wrapper.findAll('[role="tab"]')[1]!.attributes('aria-selected')).toBe('true')
    expect(wrapper.findAll('[role="tab"]')[1]!.attributes('tabindex')).toBe('0')
    await wrapper.find('[data-testid="feature-next"]').trigger('click')
    expect(count()).toBe('3 / 7')
    await wrapper.find('[data-testid="feature-prev"]').trigger('click')
    await wrapper.find('[data-testid="feature-prev"]').trigger('click')
    await wrapper.find('[data-testid="feature-prev"]').trigger('click')
    expect(count()).toBe('7 / 7')
    expect(wrapper.findAll('[role="tab"]')[6]!.attributes('aria-selected')).toBe('true')
    wrapper.unmount()
  })

  it('shows swipe cards with dots and no tablist below 1024', async () => {
    const wrapper = page()
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false)
    const cards = wrapper.findAll('[data-testid="overview-features-track"] > [data-feature]')
    expect(cards.map((card) => card.attributes('data-feature'))).toEqual(FEATURES)
    expect(cards[2]!.text()).toContain('Turn a picture into a Pattern in up to 14 colors.')
    expect(wrapper.findAll('[data-testid="feature-dots"] i')).toHaveLength(7)
    await wrapper.find('[data-testid="feature-next"]').trigger('click')
    expect(wrapper.find('[data-testid="feature-count"]').text()).toBe('2 / 7')
    expect(wrapper.findAll('[data-testid="feature-dots"] i')[1]!.classes()).toContain('carousel__dot--on')
  })

  it('has the Russian arrow labels', async () => {
    const wrapper = page()
    await wrapper.find('[data-testid="language-switcher"]').trigger('click')
    expect(wrapper.find('[data-testid="feature-prev"]').attributes('aria-label')).toBe('Предыдущая возможность')
    expect(wrapper.find('[data-testid="feature-next"]').attributes('aria-label')).toBe('Следующая возможность')
  })
})

describe('OverviewPage coffee tile', () => {
  it('sits below the feature carousel, for new and returning visitors alike', () => {
    for (const count of [0, 3]) {
      const html = page(count).html()
      expect(html.indexOf('data-testid="overview-coffee"')).toBeGreaterThan(html.indexOf('feature-carousel'))
    }
  })
})

describe('OverviewPage plan tiles', () => {
  it('sit below the coffee tile, and their Open the editor opens the editor like the hero button', async () => {
    for (const count of [0, 3]) {
      const wrapper = page(count)
      const html = wrapper.html()
      expect(html.indexOf('data-testid="overview-plans"')).toBeGreaterThan(html.indexOf('data-testid="overview-coffee"'))
      await wrapper.find('[data-testid="plan-no-account"] button').trigger('click')
      expect(wrapper.emitted('openEditor')).toHaveLength(1)
    }
  })
})
