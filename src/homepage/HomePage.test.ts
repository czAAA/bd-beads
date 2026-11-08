import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import HomePage from './HomePage.vue'
import { createProject } from '../domain/createProject'
import { en } from '../i18n/en'
import { chooseLanguage } from '../testUtils/chooseLanguage'
import { findBead } from '../domain/beads'
import { beadCell } from '../domain/weave'
import { fakeFeedback } from '../testUtils/fakeFeedback'

// What's inside stands in for itself here, saying what the page asks of it: its own tests mount the demo editor.
vi.mock('./inside/WhatsInside.vue', () => ({
  default: defineComponent({
    props: { withEditor: Boolean, shown: Boolean },
    setup: (props) => () => h('div', { 'data-testid': 'whats-inside', 'data-with-editor': String(props.withEditor), 'data-shown': String(props.shown) }),
  }),
}))

function page(projectCount = 0) {
  return mount(HomePage, { props: { projectCount, feedback: fakeFeedback() }, attachTo: document.body })
}

/** The page's width as What's inside reads it before the first resize report. */
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
    it('offers "Make your first Project" alone, a small primary button in the strip beside Menu (ticket 0822)', async () => {
      const wrapper = page()
      const wayIn = wrapper.get('[data-testid="canvas-strip"] [data-testid="strip-way-in"]')
      const make = wayIn.get('[data-testid="homepage-make-first"]')
      expect(make.text()).toBe('Make your first Project')
      expect(make.classes()).toEqual(expect.arrayContaining(['app-button--primary', 'app-button--sm']))
      expect(wayIn.findAll('button')).toHaveLength(1)

      await make.trigger('click')
      expect(wrapper.emitted('makeFirstProject')).toHaveLength(1)
    })
  })

  describe('no hero (ticket 0822)', () => {
    it('has nothing over the sections: they start right under the strip', () => {
      const wrapper = page()
      expect(wrapper.get('main').element.firstElementChild?.classList).toContain('homepage__sections')
    })
  })

  describe('with Projects saved', () => {
    it('offers "Open the editor" as the primary button and "Projects library · N" beside it, in the strip (tickets 0716, 0822)', async () => {
      const wrapper = page(3)
      const wayIn = wrapper.get('[data-testid="strip-way-in"]')
      expect(wayIn.find('[data-testid="homepage-make-first"]').exists()).toBe(false)
      const open = wayIn.get('[data-testid="homepage-open-editor"]')
      expect(open.classes()).toEqual(expect.arrayContaining(['app-button--primary', 'app-button--sm']))
      const saved = wayIn.get('[data-testid="homepage-saved-projects"]')
      expect(saved.text()).toBe(`${en.projects.heading} · 3`)
      // The name hides on a narrow strip, so it is a part of its own the strip can hide.
      expect(saved.get('.canvas-strip__way-in-name').text()).toBe(en.projects.heading)
      await open.trigger('click')
      await saved.trigger('click')
      expect(wrapper.emitted('openEditor')).toHaveLength(1)
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

  it('is one canvas box: the Canvas strip on top, the sections between, the Progress bar below, and no header of its own', () => {
    const wrapper = page()
    const box = wrapper.get('[data-testid="homepage"]')
    expect(box.element.children[0].firstElementChild).toBe(wrapper.get('[data-testid="canvas-strip"]').element)
    expect(box.element.lastElementChild).toBe(wrapper.get('[data-testid="section-bar"]').element)
    expect(wrapper.find('[data-testid="canvas-footer"]').exists()).toBe(false)
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
    expect(wrapper.get('[data-step="inside"]').text()).toBe('Что внутри')
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

    it('gives What\'s inside its editor from the zoomed width, not the screen\'s (ticket 0797)', async () => {
      const wrapper = page()
      expect(wrapper.get('[data-testid="whats-inside"]').attributes('data-with-editor')).toBe('true')

      for (let i = 0; i < 4; i++) await wrapper.get('[data-testid="zoom-in"]').trigger('click')
      expect(wrapper.get('[data-testid="whats-inside"]').attributes('data-with-editor')).toBe('false')
    })
  })

  it('starts in English on a device with no saved language', () => {
    localStorage.clear()
    expect(page().find('[data-testid="homepage-make-first"]').text()).toBe('Make your first Project')
  })
})

describe('HomePage sections (tickets 0739, 0801)', () => {
  const shown = (wrapper: ReturnType<typeof page>) =>
    ['inside', 'coffee', 'plans'].filter((id) => wrapper.get(`[data-testid="homepage-section-${id}"]`).classes().includes('homepage__section--shown'))
  const step = (wrapper: ReturnType<typeof page>, index: number) => wrapper.findAll('[data-testid="section-step"]')[index]!.trigger('click')

  it('shows one section at a time under the hero, What\'s inside first, the others slid away', () => {
    const wrapper = page()
    expect(shown(wrapper)).toEqual(['inside'])
    expect(wrapper.get('[data-testid="whats-inside"]').attributes('data-shown')).toBe('true')
    expect(wrapper.get('[data-testid="homepage-section-plans"]').classes()).toContain('homepage__section--after')
    expect(wrapper.get('[data-testid="section-counter"]').text()).toBe('1/3')
  })

  it('turns with Next and Back, the bar following, the page itself never scrolled', async () => {
    const wrapper = page()
    const el = wrapper.get('[data-testid="homepage-page"]').element as HTMLElement
    el.scrollTo = vi.fn() as typeof el.scrollTo
    await wrapper.get('[data-testid="section-next"]').trigger('click')
    expect(shown(wrapper)).toEqual(['coffee'])
    expect(wrapper.get('[data-testid="homepage-section-inside"]').classes()).toContain('homepage__section--before')
    expect(wrapper.get('[data-testid="section-track"]').attributes('aria-valuetext')).toBe('2/3 · Made by one family')
    // What's inside plays its tour only while it is the section shown (ticket 0797).
    expect(wrapper.get('[data-testid="whats-inside"]').attributes('data-shown')).toBe('false')
    await wrapper.get('[data-testid="section-back"]').trigger('click')
    expect(shown(wrapper)).toEqual(['inside'])
    expect(el.scrollTo).not.toHaveBeenCalled()
  })

  it('turns straight to the section a step asks for', async () => {
    const wrapper = page()
    await step(wrapper, 2)
    expect(shown(wrapper)).toEqual(['plans'])
    expect(wrapper.get('[data-testid="section-counter"]').text()).toBe('3/3')
  })

  it('turns with the keys from anywhere on the page, but not while the Menu is open', async () => {
    const wrapper = page()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', cancelable: true }))
    await nextTick()
    expect(shown(wrapper)).toEqual(['plans'])
    await wrapper.get('[data-testid="strip-menu"]').trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', cancelable: true }))
    await nextTick()
    expect(shown(wrapper)).toEqual(['plans'])
  })

  it('turns by the wheel on its first scroll', async () => {
    const wrapper = page()
    const event = new WheelEvent('wheel', { deltaY: 4, bubbles: true, cancelable: true })
    wrapper.get('[data-testid="canvas-strip"]').element.dispatchEvent(event)
    await nextTick()
    expect(event.defaultPrevented).toBe(true)
    expect(shown(wrapper)).toEqual(['coffee'])
  })

  it('says there is more with More below: a press turns to the next section, as Next does, and it is gone at the end (ticket 0826)', async () => {
    const wrapper = page()
    expect(wrapper.find('.homepage__body [data-testid="more-below"]').exists()).toBe(true)
    await wrapper.get('[data-testid="more-below-button"]').trigger('click')
    expect(shown(wrapper)).toEqual(['coffee'])
    await wrapper.get('[data-testid="more-below-button"]').trigger('click')
    expect(shown(wrapper)).toEqual(['plans'])
    await flushPromises()
    expect(wrapper.find('[data-testid="more-below"]').exists()).toBe(false)
  })

  describe('the nudge (ticket 0784)', () => {
    beforeEach(() => void vi.useFakeTimers())
    afterEach(() => void vi.useRealTimers())

    it('lifts What\'s inside and dips Next\'s arrow', async () => {
      const wrapper = page()
      vi.advanceTimersByTime(1500)
      await nextTick()
      expect(wrapper.get('[data-testid="homepage-section-inside"]').classes()).toContain('homepage__section--nudge')
      expect(wrapper.get('[data-testid="section-bar"]').classes()).toContain('section-bar--nudging')
    })
  })

  it('takes the focus when it opens', () => {
    const wrapper = page()
    expect(document.activeElement).toBe(wrapper.get('[data-testid="homepage-page"]').element)
  })

  it('has no drawn layer, only two faint X1 marks outside the box, hidden from screen readers', () => {
    const wrapper = page()
    const marks = wrapper.findAll('[data-testid="homepage-mark"]')
    expect(marks).toHaveLength(2)
    for (const mark of marks) {
      expect(mark.attributes('aria-hidden')).toBe('true')
      expect(wrapper.get('[data-testid="homepage"]').element.contains(mark.element)).toBe(false)
    }
    expect(wrapper.find('.drawn-layer').exists()).toBe(false)
  })

  describe('the free list (tickets 0742, 0801)', () => {
    /** A layout for the plans: a section 500 tall, the list 300 down it, its four rows 100 tall, the whole list 700, the
     * tile's padding 20 under it. The tile's foot may run 40 further down before it reaches the section's. */
    function laidOut(wrapper: ReturnType<typeof page>) {
      const rect = (el: Element, top: number, height: number) =>
        Object.defineProperty(el, 'getBoundingClientRect', { configurable: true, value: () => ({ top, bottom: top + height, height }) })
      const freeWindow = wrapper.get('[data-testid="free-window"]').element
      const list = freeWindow.firstElementChild!
      rect(wrapper.get('[data-testid="homepage-section-plans"]').element, 0, 500)
      rect(freeWindow, 300, 100)
      rect(list, 300, 700)
      rect(list.children[3]!, 380, 20)
      rect(wrapper.get('[data-testid="plan-no-account"]').element, 0, 420)
    }
    async function atThePlans() {
      const wrapper = page()
      laidOut(wrapper)
      await step(wrapper, 2)
      await flushPromises()
      return wrapper
    }
    /** The plans section scrolled `top` down in its own px. */
    async function scrollPlans(wrapper: ReturnType<typeof page>, top: number) {
      const el = wrapper.get('[data-testid="homepage-section-plans"]').element
      el.scrollTop = top
      el.dispatchEvent(new Event('scroll'))
      await flushPromises()
    }
    const list = (wrapper: ReturnType<typeof page>) => wrapper.get('[data-testid="free-window"]')

    it('shows four rows at the plans, and the section reaches on as far as the whole list needs', async () => {
      const wrapper = await atThePlans()
      expect(list(wrapper).attributes('style')).toContain('height: 100px')
      expect(list(wrapper).classes()).toContain('plan__free--fading')
      expect(wrapper.get('.homepage__free-room').attributes('style')).toContain('calc(100% + 560px)')
    })

    it('grows as the plans section scrolls, and shrinks back as it scrolls back', async () => {
      const wrapper = await atThePlans()
      await scrollPlans(wrapper, 10)
      expect(list(wrapper).attributes('style')).toContain('height: 125px')
      await scrollPlans(wrapper, 560)
      expect(list(wrapper).attributes('style')).toContain('height: 700px')
      expect(list(wrapper).classes()).not.toContain('plan__free--fading')
      await scrollPlans(wrapper, 0)
      expect(list(wrapper).attributes('style')).toContain('height: 100px')
    })
  })
})

describe('HomePage coffee tile', () => {
  it('sits below What\'s inside, for new and returning visitors alike', () => {
    for (const count of [0, 3]) {
      const html = page(count).html()
      expect(html.indexOf('data-testid="homepage-coffee"')).toBeGreaterThan(html.indexOf('data-testid="whats-inside"'))
    }
  })
  it("opens the Feedback sheet from Say hello's Send feedback, as the Menu's row does (ticket 0823)", async () => {
    const wrapper = page()
    await wrapper.get('[data-testid="homepage-send-feedback"]').trigger('click')
    expect(wrapper.get('[data-testid="feedback-sheet"]').attributes('data-kind')).toBe('general')
    wrapper.unmount()
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
    expect(positionMarkBackground).toHaveBeenLastCalledWith(expect.objectContaining({ technique: 'peyote', cell: beadCell(findBead('miyuki/delica/11-0'), 'peyote') }))
  })

  it("is the editor's tile: a bead across", () => {
    const style = page().find('[data-testid="homepage"]').attributes('style') ?? ''
    expect(style).toContain('--canvas-marks: url(data:image/png;base64,AAAA)')
    expect(style).toContain('--canvas-tile: 20px')
  })
})
