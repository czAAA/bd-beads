import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { shallowRef } from 'vue'
import HomePage from './HomePage.vue'
import { createProject } from '../domain/createProject'
import { en } from '../i18n/en'
import { chooseLanguage } from '../testUtils/chooseLanguage'
import { findBead } from '../domain/beads'
import { beadCell } from '../domain/weave'
import { fakeFeedback } from '../testUtils/fakeFeedback'

const FEATURES = ['techniques', 'projectEditing', 'convertImage', 'rowProgress', 'beadsNeeded', 'exports', 'savedProjects']

function page(projectCount = 0) {
  return mount(HomePage, { props: { projectCount, feedback: fakeFeedback() }, attachTo: document.body })
}

/** The page's width as the carousel's tier reads it before the first resize report. */
function setScreenWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
  setScreenWidth(600)
})

describe('HomePage', () => {
  describe('for a new visitor', () => {
    it('offers "Make your first Project" as the primary button and "Open the editor" beside it', async () => {
      const wrapper = page()
      const make = wrapper.find('[data-testid="homepage-make-first"]')
      expect(make.text()).toBe('Make your first Project')
      expect(make.classes()).toContain('app-button--primary')
      expect(wrapper.find('[data-testid="homepage-open-editor"]').text()).toBe('Open the editor')

      await make.trigger('click')
      await wrapper.find('[data-testid="homepage-open-editor"]').trigger('click')
      expect(wrapper.emitted('makeFirstProject')).toHaveLength(1)
      expect(wrapper.emitted('openEditor')).toHaveLength(1)
    })
  })

  describe('the hero band and notes', () => {
    it('shows the notes, hidden from screen readers', () => {
      const wrapper = page()
      for (const [id, text] of [
        ['on-us', 'on us'],
      ]) {
        const note = wrapper.find(`[data-testid="homepage-note-${id}"]`)
        expect(note.text()).toBe(text)
        expect(note.attributes('aria-hidden')).toBe('true')
      }
    })

    it('shows the slogan as the one stable label "openbeads"', () => {
      const slogan = page().get('[data-testid="homepage-slogan"]')
      expect(slogan.attributes('aria-label')).toBe('openbeads')
      expect(slogan.find('[data-testid="homepage-note-you"]').exists()).toBe(false)
    })

    it('shows "on us" once Projects are saved too', () => {
      expect(page(2).find('[data-testid="homepage-note-on-us"]').text()).toBe('on us')
    })
  })

  describe('with Projects saved', () => {
    it('offers "Open the editor" as the primary button and "Saved Projects · N" beside it (ticket 0716)', async () => {
      const wrapper = page(3)
      expect(wrapper.find('[data-testid="homepage-make-first"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="homepage-open-editor"]').classes()).toContain('app-button--primary')
      const saved = wrapper.get('[data-testid="homepage-saved-projects"]')
      expect(saved.text()).toBe(`${en.projects.heading} · 3`)
      await saved.trigger('click')
      expect(wrapper.emitted('openSavedProjects')).toHaveLength(1)
      expect(page(0).find('[data-testid="homepage-saved-projects"]').exists()).toBe(false)
    })

    it('lists the library in the Menu\'s Saved Projects, opened only then, with Remove asking first and a pick opening it (ticket 0716)', async () => {
      const project = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Moth', size: { width: 4, height: 4, unit: 'beads' } })
      const projects = shallowRef([project])
      const library = { projects, sealed: shallowRef([]), removeProject: vi.fn(() => void (projects.value = [])), addProjects: vi.fn(), entryOf: (id: string) => ({ id, name: 'Moth' }) }
      const openLibrary = vi.fn(() => library)
      const wrapper = mount(HomePage, { props: { projectCount: 1, openLibrary, feedback: fakeFeedback() }, attachTo: document.body })
      await wrapper.get('[data-testid="strip-menu"]').trigger('click')
      expect(openLibrary).not.toHaveBeenCalled()

      await wrapper.get('[data-testid="menu-saved-projects"]').trigger('click')
      await wrapper.get(`[data-testid="select-project-${project.id}"]`).trigger('click')
      expect(wrapper.emitted('openProject')).toEqual([[project.id]])
      await wrapper.get('[data-testid="menu-export-all"]').trigger('click')
      expect(wrapper.emitted('exportAll')).toEqual([[[project], []]])
      await wrapper.get(`[data-testid="remove-project-${project.id}"]`).trigger('click')
      expect(library.removeProject).not.toHaveBeenCalled()
      await wrapper.get('[data-testid="remove-project-modal"] [data-testid="confirm-modal-confirm"]').trigger('click')

      expect(library.removeProject).toHaveBeenCalledWith(project.id)
      expect(wrapper.find('[data-testid="homepage-saved-projects"]').exists()).toBe(false)
    })
  })

  it('is a canvas box: the Canvas strip on top, the content between, an empty Canvas footer below, and no header of its own', () => {
    const wrapper = page()
    const box = wrapper.get('[data-testid="homepage"]')
    expect(box.element.children[0]).toBe(wrapper.get('[data-testid="canvas-strip"]').element)
    expect(box.get('[data-testid="homepage-scroll"]').find('[data-testid="homepage-slogan"]').exists()).toBe(true)
    expect(box.element.lastElementChild).toBe(wrapper.get('[data-testid="canvas-footer"]').element)
    expect(wrapper.get('[data-testid="canvas-footer"]').text()).toBe('')
    expect(wrapper.find('.homepage__header').exists()).toBe(false)
    expect(wrapper.find('[data-testid="header-menu"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="language-switcher"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="theme-picker"]').exists()).toBe(false)
  })

  it('has the strip with Menu, the Brand as the current page, and the zoom, but no Project controls', () => {
    const wrapper = page()
    expect(wrapper.find('[data-testid="strip-menu"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="strip-project"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="strip-undo"]').exists()).toBe(false)
    const brand = wrapper.get('[data-testid="canvas-brand"]')
    expect(brand.text()).toBe('openbeads')
    expect(brand.attributes('aria-current')).toBe('page')
    expect(brand.attributes('href')).toBeUndefined()
    expect(wrapper.find('[data-testid="zoom-reset"]').exists()).toBe(true)
  })

  it('opens the editor\'s Menu panel from the strip, with Language and Theme and Homepage as the current page', async () => {
    const wrapper = page()
    expect(wrapper.find('[data-testid="menu-panel"]').exists()).toBe(false)
    await wrapper.get('[data-testid="strip-menu"]').trigger('click')

    expect(wrapper.get('[data-testid="strip-menu"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[data-testid="language-switcher"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="theme-picker"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-item-shortcuts"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="menu-new-project"]').exists()).toBe(false)
    const item = wrapper.get('[data-testid="menu-item-homepage"]')
    expect(item.attributes('aria-current')).toBe('page')
    expect(item.attributes('href')).toContain('homepage/')
  })

  it('sends a general Report from the Menu’s Send feedback, and thanks with a toast of its own', async () => {
    const feedback = fakeFeedback()
    const wrapper = mount(HomePage, { props: { projectCount: 0, feedback }, attachTo: document.body })
    await wrapper.get('[data-testid="strip-menu"]').trigger('click')
    await wrapper.get('[data-testid="menu-item-feedback"]').trigger('click')
    expect(wrapper.get('[data-testid="feedback-sheet"]').attributes('data-kind')).toBe('general')
    await wrapper.get('[data-testid="feedback-message"]').setValue('The editor does not open on my tablet.')
    await wrapper.get('form#feedback-sheet-form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('[data-testid="feedback-sheet"]').exists()).toBe(false))
    expect(feedback.send).toHaveBeenCalledOnce()
    expect(wrapper.get('[data-testid="feedback-sent"]').text()).toContain('Thanks, your report was sent')
    wrapper.unmount()
  })

  it('switches to Russian with the language switcher in the Menu, and remembers it', async () => {
    const wrapper = page()
    await wrapper.get('[data-testid="strip-menu"]').trigger('click')
    await chooseLanguage(wrapper, 'ru')
    expect(wrapper.find('[data-testid="homepage-make-first"]').text()).toBe('Сделать первый проект')
    expect(wrapper.find('[data-testid="feature-carousel"]').text()).toContain('Техники плетения')
    expect(localStorage.getItem('openbeads:locale')).toBe('ru')
  })

  describe('zoom', () => {
    const zoomOf = (wrapper: ReturnType<typeof page>) => (wrapper.get('.homepage__page').element as HTMLElement).style.zoom

    it('scales the content from 75% to 200% in 10% steps with the buttons, and Fit resets it', async () => {
      const wrapper = page()
      await wrapper.get('[data-testid="zoom-in"]').trigger('click')
      expect(zoomOf(wrapper)).toBe('1.1')

      for (let i = 0; i < 20; i++) await wrapper.get('[data-testid="zoom-in"]').trigger('click')
      expect(zoomOf(wrapper)).toBe('2')
      expect(wrapper.get('[data-testid="zoom-in"]').attributes('aria-disabled')).toBeDefined()

      await wrapper.get('[data-testid="zoom-reset"]').trigger('click')
      expect(zoomOf(wrapper)).toBe('1')

      for (let i = 0; i < 6; i++) await wrapper.get('[data-testid="zoom-out"]').trigger('click')
      expect(zoomOf(wrapper)).toBe('0.75')
      expect(wrapper.get('[data-testid="zoom-out"]').attributes('aria-disabled')).toBeDefined()
    })

    it('is remembered on the device', async () => {
      const first = page()
      await first.get('[data-testid="zoom-in"]').trigger('click')
      first.unmount()

      expect(zoomOf(page())).toBe('1.1')
    })

    it('decides the carousel\'s tier from the zoomed width, not the screen\'s', async () => {
      setScreenWidth(1200)
      const wrapper = page()
      expect(wrapper.find('[role="tablist"]').exists()).toBe(true)

      for (let i = 0; i < 3; i++) await wrapper.get('[data-testid="zoom-in"]').trigger('click')
      expect(wrapper.find('[role="tablist"]').exists()).toBe(false)
    })
  })

  it('starts in English on a device with no saved language', () => {
    localStorage.clear()
    expect(page().find('[data-testid="homepage-make-first"]').text()).toBe('Make your first Project')
  })
})

describe('the features carousel', () => {
  const mountWide = () => {
    setScreenWidth(1200)
    return mount(HomePage, { props: { projectCount: 0, feedback: fakeFeedback() }, attachTo: document.body })
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
    const cards = wrapper.findAll('[data-testid="homepage-features-track"] > [data-feature]')
    expect(cards.map((card) => card.attributes('data-feature'))).toEqual(FEATURES)
    expect(cards[2]!.text()).toContain('Turn a picture into a Schema in up to 14 colors.')
    expect(wrapper.findAll('[data-testid="feature-dots"] i')).toHaveLength(7)
    await wrapper.find('[data-testid="feature-next"]').trigger('click')
    expect(wrapper.find('[data-testid="feature-count"]').text()).toBe('2 / 7')
    expect(wrapper.findAll('[data-testid="feature-dots"] i')[1]!.classes()).toContain('carousel__dot--on')
  })

  it('has the Russian arrow labels', async () => {
    const wrapper = page()
    await wrapper.get('[data-testid="strip-menu"]').trigger('click')
    await chooseLanguage(wrapper, 'ru')
    expect(wrapper.find('[data-testid="feature-prev"]').attributes('aria-label')).toBe('Предыдущая возможность')
    expect(wrapper.find('[data-testid="feature-next"]').attributes('aria-label')).toBe('Следующая возможность')
  })
})

describe('HomePage coffee tile', () => {
  it('sits below the feature carousel, for new and returning visitors alike', () => {
    for (const count of [0, 3]) {
      const html = page(count).html()
      expect(html.indexOf('data-testid="homepage-coffee"')).toBeGreaterThan(html.indexOf('feature-carousel'))
    }
  })
})

describe('HomePage plan tiles', () => {
  it('sit below the coffee tile, and their Open the editor opens the editor like the hero button', async () => {
    for (const count of [0, 3]) {
      const wrapper = page(count)
      const html = wrapper.html()
      expect(html.indexOf('data-testid="homepage-plans"')).toBeGreaterThan(html.indexOf('data-testid="homepage-coffee"'))
      await wrapper.find('[data-testid="plan-no-account"] button').trigger('click')
      expect(wrapper.emitted('openEditor')).toHaveLength(1)
    }
  })
})

// jsdom has no canvas to draw the tile on: a stand-in gives the picture and the size the editor's tile would have.
const { positionMarkBackground } = vi.hoisted(() => ({
  positionMarkBackground: vi.fn((_input: { technique: string }) => ({ url: 'data:image/png;base64,AAAA', width: 20, height: 30 })),
}))
vi.mock('../rendering/positionMarks', () => ({ positionMarkBackground }))

describe('HomePage background', () => {
  it("draws the Canvas's empty positions of a Delica 11/0 peyote Project at the Bead's real cell, not the loom's square grid", () => {
    page()
    expect(positionMarkBackground).toHaveBeenLastCalledWith(expect.objectContaining({ technique: 'peyote', cell: beadCell(findBead('miyuki/delica/11-0')) }))
  })

  it("is the editor's tile: a bead across", () => {
    const style = page().find('[data-testid="homepage"]').attributes('style') ?? ''
    expect(style).toContain('--canvas-marks: url(data:image/png;base64,AAAA)')
    expect(style).toContain('--canvas-tile: 20px')
  })
})
