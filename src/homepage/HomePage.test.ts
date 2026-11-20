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
import { memoryAccount } from '../services/memoryAccount'
import { choosePanelOption } from '../testUtils/choosePanelOption'
import { hasOpenLayer } from '../composables/ui/useOverlayLayer'
import type { NotesSource } from '../services/notesFile'
import WelcomeCuff from './WelcomeCuff.vue'

/** What the stand-in What's inside's Open editor from here gives. */
const demoSnapshot = vi.hoisted(() => ({ value: undefined as unknown }))

// What's inside stands in for itself here, saying what the page asks of it: its own tests mount the demo editor.
vi.mock('./inside/WhatsInside.vue', () => ({
  default: defineComponent({
    props: { withEditor: Boolean, shown: Boolean, wide: Boolean },
    emits: ['openFromHere'],
    setup: (props, { emit }) => () =>
      h('div', { 'data-testid': 'whats-inside', 'data-with-editor': String(props.withEditor), 'data-shown': String(props.shown), 'data-wide': String(props.wide) }, [
        h('button', { 'data-testid': 'demo-open-from-here', onClick: () => emit('openFromHere', demoSnapshot.value) }),
      ]),
  }),
}))

function page(projectCount = 0, notes?: NotesSource) {
  return mount(HomePage, { props: { projectCount, feedback: fakeFeedback(), notes }, attachTo: document.body })
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

  describe('landmarks (ticket 0856)', () => {
    it('has one main, the strip not in it, and the section bar a navigation named Sections', () => {
      const wrapper = page()
      expect(wrapper.findAll('main')).toHaveLength(1)
      expect(wrapper.get('[data-testid="canvas-strip"]').element.closest('main')).toBeNull()
      const bar = wrapper.get('[data-testid="section-bar"]')
      expect(bar.attributes('role')).toBe('navigation')
      expect(bar.attributes('aria-label')).toBe(en.homepage.sections.label)
    })

    it('has one h1, the Welcome heading, and no heading a level deeper than the one before it (ticket 0995)', () => {
      for (const count of [0, 3]) {
        const wrapper = page(count)
        const levels = wrapper.findAll('h1, h2, h3, h4, h5, h6').map((heading) => Number(heading.element.tagName[1]))
        expect(levels.filter((level) => level === 1), `${count} Projects`).toHaveLength(1)
        expect(levels[0], `${count} Projects`).toBe(1)
        levels.forEach((level, i) => expect(level, `${count} Projects, heading ${i}`).toBeLessThanOrEqual((levels[i - 1] ?? 0) + 1))
        wrapper.unmount()
      }
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

    it('shows the loading state, after the loading delay, in Saved Projects until the library arrives (spec 1018)', async () => {
      vi.useFakeTimers()
      try {
        const project = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Moth', size: { width: 4, height: 4, unit: 'beads' } })
        const library = { projects: shallowRef([project]), sealed: shallowRef([]), removeProject: vi.fn(), restoreRemoved: vi.fn(), forgetRemoved: vi.fn(), addProjects: vi.fn(), entryOf: (id: string) => ({ id, name: 'Moth' }) }
        let arrive: (opened: typeof library) => void = () => undefined
        const openLibrary = vi.fn(() => new Promise<typeof library>((resolve) => (arrive = resolve)))
        const wrapper = mount(HomePage, { props: { projectCount: 1, openLibrary, feedback: fakeFeedback() }, attachTo: document.body })
        await wrapper.get('[data-testid="strip-menu"]').trigger('click')
        await wrapper.get('[data-testid="menu-saved-projects"]').trigger('click')

        expect(wrapper.find('[data-testid="loading"]').exists()).toBe(false)
        await vi.advanceTimersByTimeAsync(400)
        expect(wrapper.get('[data-testid="loading"]').text()).toBe(en.projects.loading)
        expect(wrapper.find(`[data-testid="select-project-${project.id}"]`).exists()).toBe(false)

        arrive(library)
        await flushPromises()
        expect(wrapper.find('[data-testid="loading"]').exists()).toBe(false)
        expect(wrapper.find(`[data-testid="select-project-${project.id}"]`).exists()).toBe(true)
        expect(openLibrary).toHaveBeenCalledOnce()
      } finally {
        vi.useRealTimers()
      }
    })

    it('says in Saved Projects that the Projects could not be opened when the library fails to open (spec 1018)', async () => {
      const openLibrary = vi.fn(() => Promise.reject(new Error('unopened')))
      const wrapper = mount(HomePage, { props: { projectCount: 0, libraryUnopened: true, openLibrary, feedback: fakeFeedback() }, attachTo: document.body })
      // Not a new visitor: the way in to Saved Projects is there although no count is known, and names none.
      expect(wrapper.get('[data-testid="homepage-saved-projects"]').text()).not.toContain('·')
      await wrapper.get('[data-testid="strip-menu"]').trigger('click')
      await wrapper.get('[data-testid="menu-saved-projects"]').trigger('click')
      await flushPromises()

      expect(wrapper.find('[data-testid="library-unopened"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="loading"]').exists()).toBe(false)
    })

    it('lists the library in the Menu\'s Saved Projects, opened only then, with × asking Delete first and a pick opening it (tickets 0716, 0842)', async () => {
      const project = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Moth', size: { width: 4, height: 4, unit: 'beads' } })
      const projects = shallowRef([project])
      const library = { projects, sealed: shallowRef([]), removeProject: vi.fn(() => void (projects.value = [])), restoreRemoved: vi.fn(), forgetRemoved: vi.fn(), addProjects: vi.fn(), entryOf: (id: string) => ({ id, name: 'Moth' }) }
      const openLibrary = vi.fn(async () => library)
      const wrapper = mount(HomePage, { props: { projectCount: 1, openLibrary, feedback: fakeFeedback() }, attachTo: document.body })
      await wrapper.get('[data-testid="strip-menu"]').trigger('click')
      expect(openLibrary).not.toHaveBeenCalled()

      await wrapper.get('[data-testid="menu-saved-projects"]').trigger('click')
      await flushPromises()
      await wrapper.get(`[data-testid="select-project-${project.id}"]`).trigger('click')
      expect(wrapper.emitted('openProject')).toEqual([[project.id]])
      await wrapper.get('[data-testid="menu-export-all"]').trigger('click')
      expect(wrapper.emitted('exportAll')).toEqual([[[project], []]])
      await wrapper.get(`[data-testid="remove-project-${project.id}"]`).trigger('click')
      expect(library.removeProject).not.toHaveBeenCalled()
      // The editor's Delete question (ticket 0842): its Save Project file asks for the Project's file and stays open.
      await wrapper.get('[data-testid="delete-project-modal"] [data-testid="confirm-modal-extra"]').trigger('click')
      expect(wrapper.emitted('saveProjectFile')).toEqual([[project]])
      await wrapper.get('[data-testid="delete-project-modal"] [data-testid="confirm-modal-confirm"]').trigger('click')

      expect(library.removeProject).toHaveBeenCalledWith(project.id)
      expect(wrapper.find('[data-testid="homepage-saved-projects"]').exists()).toBe(false)
      // Its toast's Undo brings it back (ticket 0983).
      await wrapper.get('[data-testid="project-deleted"] [data-testid="toast-action"]').trigger('click')
      expect(library.restoreRemoved).toHaveBeenCalledOnce()
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
    expect(wrapper.find('[data-testid="theme-picker"]').exists()).toBe(false)
  })

  it('has the strip with Menu, the Brand as the current page, the zoom and Language, but no Project controls', () => {
    const wrapper = page()
    expect(wrapper.find('[data-testid="strip-menu"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="strip-project"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="strip-undo"]').exists()).toBe(false)
    const brand = wrapper.get('[data-testid="canvas-brand"]')
    expect(brand.attributes('aria-current')).toBe('page')
    expect(brand.attributes('href')).toBeUndefined()
    expect(wrapper.find('[data-testid="zoom-reset"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="language-switcher"]').exists()).toBe(true)
  })

  it('opens the editor\'s Menu panel from the strip, with Homepage as the current page', async () => {
    const wrapper = page()
    expect(wrapper.find('[data-testid="menu-panel"]').exists()).toBe(false)
    await wrapper.get('[data-testid="strip-menu"]').trigger('click')

    expect(wrapper.get('[data-testid="strip-menu"]').attributes('aria-expanded')).toBe('true')
    const item = wrapper.get('[data-testid="menu-item-homepage"]')
    expect(item.attributes('aria-current')).toBe('page')
    expect(item.attributes('href')).toBe(import.meta.env.BASE_URL)
  })

  it.each([
    ['menu-new-project', 'newProject'],
    ['menu-convert-image', 'convertImage'],
    ['menu-sign-in', 'createAccount'],
  ])('opens the editor from the Menu\'s %s (ticket 1113)', async (row, asked) => {
    const wrapper = page()
    await wrapper.get('[data-testid="strip-menu"]').trigger('click')
    await wrapper.get(`[data-testid="${row}"]`).trigger('click')
    await flushPromises()
    expect(wrapper.emitted(asked)).toHaveLength(1)
  })

  it('shows the Shortcuts help over the page, the Menu put away, and keeps Tools position on the device (ticket 1113)', async () => {
    const wrapper = page()
    await wrapper.get('[data-testid="strip-menu"]').trigger('click')
    await choosePanelOption(wrapper, 'menu-tools-position', 'left')
    expect(localStorage.getItem('openbeads:tool-pill-position')).toBe('left')

    await wrapper.get('[data-testid="menu-item-shortcuts"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="menu-panel"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="shortcuts-help-dialog"]').exists()).toBe(true)
    await wrapper.get('[data-testid="shortcuts-help-close"]').trigger('click')
    expect(wrapper.find('[data-testid="shortcuts-help-dialog"]').exists()).toBe(false)
  })

  it('names the strip\'s buttons from What the buttons do, until Escape (tickets 0927, 1113)', async () => {
    const wrapper = page()
    await wrapper.get('[data-testid="strip-menu"]').trigger('click')
    await wrapper.get('[data-testid="menu-item-button-names"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="menu-panel"]').exists()).toBe(false)
    expect(hasOpenLayer()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(hasOpenLayer()).toBe(false)
  })

  it('asks before it deletes the account, from the Menu\'s Account section (ticket 1113)', async () => {
    const account = memoryAccount({ remembered: { email: 'ann@example.com', plan: 'free' }, session: { email: 'ann@example.com', plan: 'free' } })
    const wrapper = mount(HomePage, { props: { projectCount: 0, feedback: fakeFeedback(), account }, attachTo: document.body })
    await flushPromises()
    await wrapper.get('[data-testid="strip-menu"]').trigger('click')
    expect(wrapper.get('[data-testid="menu-account-email"]').text()).toBe('ann@example.com')

    await wrapper.get('[data-testid="menu-delete-account"]').trigger('click')
    expect(wrapper.find('[data-testid="delete-account-modal"]').exists()).toBe(true)
    await wrapper.get('[data-testid="delete-account-modal"] [data-testid="confirm-modal-confirm"]').trigger('click')
    await flushPromises()
    expect(account.state.session).toBeUndefined()
    expect(wrapper.find('[data-testid="delete-account-modal"]').exists()).toBe(false)
  })

  it('signs out from the Menu, the Account section offering Sign in again (ticket 1113)', async () => {
    const ann = { email: 'ann@example.com', plan: 'free' } as const
    const account = memoryAccount({ remembered: ann, session: ann })
    const wrapper = mount(HomePage, { props: { projectCount: 0, feedback: fakeFeedback(), account }, attachTo: document.body })
    await flushPromises()
    await wrapper.get('[data-testid="strip-menu"]').trigger('click')
    await wrapper.get('[data-testid="menu-sign-out"]').trigger('click')
    await flushPromises()
    expect(account.remembered()).toBeUndefined()
    expect(wrapper.find('[data-testid="menu-sign-in"]').exists()).toBe(true)
  })

  it('sends a signed-in person\'s theme changed from the Homepage\'s Menu, as the editor does (ticket 1086)', async () => {
    const ann = { email: 'ann@example.com', plan: 'free' } as const
    const account = memoryAccount({ remembered: ann, session: ann })
    const wrapper = mount(HomePage, { props: { projectCount: 0, feedback: fakeFeedback(), account }, attachTo: document.body })
    await flushPromises()
    await wrapper.get('[data-testid="strip-menu"]').trigger('click')
    await choosePanelOption(wrapper, 'theme-picker', 'dark')
    await flushPromises()
    expect(account.state.sent.some((sent) => sent.theme?.value === 'dark')).toBe(true)
  })

  it("opens the editor on a copy of What's inside's Project at the demo's bead size on screen, the page's zoom taken in (ticket 0879)", async () => {
    const project = createProject({ name: 'Ring', technique: 'peyote', beadId: 'miyuki/delica/11-0' })
    demoSnapshot.value = { project, view: { zoom: 1.5, at: { row: 4, column: 9 } } }
    const wrapper = page()
    await wrapper.get('[data-testid="zoom-in"]').trigger('click')
    await wrapper.get('[data-testid="demo-open-from-here"]').trigger('click')
    const [[copied]] = wrapper.emitted('openDemoCopy') as [[{ project: unknown; view: { zoom: number; at: unknown } }]]
    expect(copied.project).toBe(project)
    expect(copied.view.zoom).toBeCloseTo(1.65)
    expect(copied.view.at).toEqual({ row: 4, column: 9 })
    expect(wrapper.emitted('makeFirstProject')).toBeUndefined()
  })

  it('opens the editor plainly should the demo have no Project yet (ticket 0879)', async () => {
    demoSnapshot.value = undefined
    const wrapper = page(3)
    await wrapper.get('[data-testid="demo-open-from-here"]').trigger('click')
    expect(wrapper.emitted('openEditor')).toHaveLength(1)
    expect(wrapper.emitted('openDemoCopy')).toBeUndefined()
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

  it("switches to Russian with the strip's Language, and remembers it", async () => {
    const wrapper = page()
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

    it("stands What's inside's list beside its demo from a 1000px page, by the zoomed width (ticket 0830)", async () => {
      setScreenWidth(1150)
      const wrapper = page()
      expect(wrapper.get('[data-testid="whats-inside"]').attributes('data-wide')).toBe('true')

      // 1150 at 110% is a 1045px page; at 120% it is 958px.
      await wrapper.get('[data-testid="zoom-in"]').trigger('click')
      expect(wrapper.get('[data-testid="whats-inside"]').attributes('data-wide')).toBe('true')
      await wrapper.get('[data-testid="zoom-in"]').trigger('click')
      expect(wrapper.get('[data-testid="whats-inside"]').attributes('data-wide')).toBe('false')
      setScreenWidth(1024)
    })
  })

  it('starts in English on a device with no saved language', () => {
    localStorage.clear()
    expect(page().find('[data-testid="homepage-make-first"]').text()).toBe('Make your first Project')
  })
})

describe('HomePage sections (tickets 0739, 0801)', () => {
  const shown = (wrapper: ReturnType<typeof page>) =>
    ['welcome', 'inside', 'coffee', 'plans'].filter((id) => wrapper.get(`[data-testid="homepage-section-${id}"]`).classes().includes('homepage__section--shown'))
  const step = (wrapper: ReturnType<typeof page>, index: number) => wrapper.findAll('[data-testid="section-step"]')[index]!.trigger('click')

  it("closes What's new once the coffee screen is turned away (ticket 0880)", async () => {
    const wrapper = page()
    await step(wrapper, 2)
    const toggle = () => wrapper.get('[data-testid="homepage-whats-new-toggle"]')
    await toggle().trigger('click')
    expect(toggle().attributes('aria-expanded')).toBe('true')
    await step(wrapper, 3)
    await step(wrapper, 2)
    expect(shown(wrapper)).toEqual(['coffee'])
    expect(toggle().attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })

  it("opens at What's new, unfolded, from Update ready's link, and closes it once turned away (ticket 1048)", async () => {
    const notes = vi.fn<NotesSource>(async () => ({ version: '1.1.0', releases: [{ version: '1.0.0', date: '2026-11-17' }], notes: [] }))
    const wrapper = mount(HomePage, { props: { projectCount: 1, feedback: fakeFeedback(), notes, atWhatsNew: true }, attachTo: document.body })
    await flushPromises()
    const toggle = () => wrapper.get('[data-testid="homepage-whats-new-toggle"]')
    expect(shown(wrapper)).toEqual(['coffee'])
    expect(toggle().attributes('aria-expanded')).toBe('true')
    await step(wrapper, 3)
    await step(wrapper, 2)
    expect(toggle().attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })

  it("hands What's new the page's notes file, read in the language shown when it opens (ticket 1047)", async () => {
    const notes = vi.fn<NotesSource>(async () => ({ version: '1.1.0', releases: [{ version: '1.0.0', date: '2026-11-17' }], notes: [] }))
    const wrapper = page(0, notes)
    await step(wrapper, 2)
    await wrapper.get('[data-testid="homepage-whats-new-toggle"]').trigger('click')
    await flushPromises()
    expect(notes).toHaveBeenCalledWith('en')
    expect(wrapper.get('[data-testid="homepage-whats-new-release"]').text()).toContain('Release 1.0.0')
    wrapper.unmount()
  })

  it('shows one section at a time, Welcome first (ticket 0830), the others slid away', () => {
    const wrapper = page()
    expect(shown(wrapper)).toEqual(['welcome'])
    expect(wrapper.get('[data-testid="whats-inside"]').attributes('data-shown')).toBe('false')
    expect(wrapper.get('[data-testid="homepage-section-plans"]').classes()).toContain('homepage__section--after')
    expect(wrapper.get('[data-testid="section-counter"]').text()).toBe('1/4')
    // Welcome's heading is a sentence, so its step has a name of its own.
    expect(wrapper.get('[data-testid="section-track"]').attributes('aria-valuetext')).toBe('1/4 · Welcome')
    expect(wrapper.get('[data-testid="homepage-section-welcome"] h1').text()).toBe('A free bead pattern editor that works in three techniques')
  })

  it('turns with Next and Back, the bar following, the page itself never scrolled', async () => {
    const wrapper = page()
    const el = wrapper.get('[data-testid="homepage-page"]').element as HTMLElement
    el.scrollTo = vi.fn() as typeof el.scrollTo
    await wrapper.get('[data-testid="section-next"]').trigger('click')
    expect(shown(wrapper)).toEqual(['inside'])
    expect(wrapper.get('[data-testid="homepage-section-welcome"]').classes()).toContain('homepage__section--before')
    expect(wrapper.get('[data-testid="section-track"]').attributes('aria-valuetext')).toBe("2/4 · What's inside")
    // What's inside plays its tour only while it is the section shown (ticket 0797).
    expect(wrapper.get('[data-testid="whats-inside"]').attributes('data-shown')).toBe('true')
    await wrapper.get('[data-testid="section-next"]').trigger('click')
    expect(shown(wrapper)).toEqual(['coffee'])
    expect(wrapper.get('[data-testid="whats-inside"]').attributes('data-shown')).toBe('false')
    await wrapper.get('[data-testid="section-back"]').trigger('click')
    await wrapper.get('[data-testid="section-back"]').trigger('click')
    expect(shown(wrapper)).toEqual(['welcome'])
    expect(el.scrollTo).not.toHaveBeenCalled()
  })

  it('turns straight to the section a step asks for', async () => {
    const wrapper = page()
    await step(wrapper, 3)
    expect(shown(wrapper)).toEqual(['plans'])
    expect(wrapper.get('[data-testid="section-counter"]').text()).toBe('4/4')
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
    expect(shown(wrapper)).toEqual(['inside'])
  })

  it('wires More below to the section shown: it shows once the section scrolls further, a press scrolling it on (tickets 0826, 0870)', async () => {
    const wrapper = page()
    await step(wrapper, 3)
    const plans = wrapper.get('[data-testid="homepage-section-plans"]').element as HTMLElement
    plans.style.overflowY = 'auto'
    Object.defineProperties(plans, { clientHeight: { configurable: true, value: 300 }, scrollHeight: { configurable: true, value: 700 } })
    plans.scrollBy = vi.fn() as typeof plans.scrollBy
    plans.dispatchEvent(new Event('scroll'))
    await nextTick()
    await wrapper.get('.homepage__body [data-testid="more-below-button"]').trigger('click')
    expect(plans.scrollBy).toHaveBeenCalledOnce()
    expect(shown(wrapper)).toEqual(['plans'])
  })

  describe('the nudge (ticket 0784)', () => {
    beforeEach(() => void vi.useFakeTimers())
    afterEach(() => void vi.useRealTimers())

    it("lifts the first section, Welcome, and dips Next's arrow", async () => {
      const wrapper = page()
      vi.advanceTimersByTime(1500)
      await nextTick()
      expect(wrapper.get('[data-testid="homepage-section-welcome"]').classes()).toContain('homepage__section--nudge')
      expect(wrapper.get('[data-testid="section-bar"]').classes()).toContain('section-bar--nudging')
    })
  })

  describe('Welcome (ticket 0830)', () => {
    const wayIn = (wrapper: ReturnType<typeof page>) => wrapper.get('[data-testid="strip-way-in"]')

    it('weaves its cuff while Welcome is shown, and stops once the page turns from it (ticket 1157)', async () => {
      const wrapper = page()
      expect(wrapper.getComponent(WelcomeCuff).props('shown')).toBe(true)
      await wrapper.get('[data-testid="section-next"]').trigger('click')
      expect(shown(wrapper)).toEqual(['inside'])
      expect(wrapper.findComponent(WelcomeCuff).exists() && wrapper.getComponent(WelcomeCuff).props('shown')).toBe(false)
    })

    it("goes into the editor from its tile's way in, as the strip's does", async () => {
      const fresh = page()
      await fresh.get('[data-testid="welcome-make-first"]').trigger('click')
      expect(fresh.emitted('makeFirstProject')).toHaveLength(1)

      const returning = page(3)
      await returning.get('[data-testid="welcome-open-editor"]').trigger('click')
      expect(returning.emitted('openEditor')).toHaveLength(1)
      const library = returning.get('[data-testid="welcome-saved-projects"]')
      expect(library.text()).toBe(`${en.projects.heading} · 3`)
      await library.trigger('click')
      expect(returning.emitted('openSavedProjects')).toHaveLength(1)
    })

    it('starts the first Project from a ready design from its tile (ticket 0953)', async () => {
      const fresh = page()
      await fresh.get('[data-testid="welcome-start-from-starter"]').trigger('click')
      expect(fresh.emitted('startFromStarter')).toHaveLength(1)
      expect(fresh.emitted('makeFirstProject')).toBeUndefined()
    })

    it("keeps the strip's way in away on Welcome, out of the Tab order and unread, and brings it back from the second section", async () => {
      const wrapper = page()
      expect(wayIn(wrapper).classes()).toContain('canvas-strip__way-in--away')
      expect(wayIn(wrapper).attributes('aria-hidden')).toBe('true')
      expect(wayIn(wrapper).attributes('inert')).toBeDefined()
      // Its place is kept, so the slogan never moves: the button is still there to take its room.
      expect(wayIn(wrapper).find('[data-testid="homepage-make-first"]').exists()).toBe(true)

      await wrapper.get('[data-testid="section-next"]').trigger('click')
      expect(wayIn(wrapper).classes()).not.toContain('canvas-strip__way-in--away')
      expect(wayIn(wrapper).attributes('aria-hidden')).toBeUndefined()
      expect(wayIn(wrapper).attributes('inert')).toBeUndefined()

      await wrapper.get('[data-testid="section-back"]').trigger('click')
      expect(wayIn(wrapper).classes()).toContain('canvas-strip__way-in--away')
    })
  })

  it('takes the focus when it opens', () => {
    const wrapper = page()
    expect(document.activeElement).toBe(wrapper.get('[data-testid="homepage-page"]').element)
  })

  describe('the marks around the box', () => {
    afterEach(() => void vi.useRealTimers())
    const on = (date: string) => vi.useFakeTimers({ toFake: ['Date'], now: new Date(date) })

    it('has no drawn layer, only two faint X1 marks outside the box, hidden from screen readers', () => {
      on('2026-11-18T12:00:00')
      const wrapper = page()
      const marks = wrapper.findAll('[data-testid="homepage-mark"]')
      expect(marks).toHaveLength(2)
      for (const mark of marks) {
        expect(mark.attributes('aria-hidden')).toBe('true')
        expect(wrapper.get('[data-testid="homepage"]').element.contains(mark.element)).toBe(false)
      }
      expect(wrapper.find('.drawn-layer').exists()).toBe(false)
      expect(wrapper.find('[data-testid="winter-charms"]').exists()).toBe(false)
    })

    it('in winter has the Winter charms and their three marks in place of the two, outside the box (ticket 1102)', async () => {
      on('2026-11-19T12:00:00')
      const wrapper = page()
      await vi.waitFor(() => expect(wrapper.findAll('[data-testid="winter-mark"]')).toHaveLength(3))
      expect(wrapper.find('[data-testid="homepage-mark"]').exists()).toBe(false)
      const charms = wrapper.get('[data-testid="winter-charms"]')
      expect(charms.attributes('aria-hidden')).toBe('true')
      expect(charms.find('[tabindex]').exists()).toBe(false)
      expect(wrapper.get('[data-testid="homepage"]').element.contains(charms.element)).toBe(false)
    })
  })

  describe('the free list (tickets 0742, 0801)', () => {
    /** A layout for the plans: a section `room` tall (500 unless set), the list 300 down it, its first four rows 100 tall
     * and every other 50, the whole list 700, the tile's padding 20 under it. The tile's foot may run 40 further down before
     * it reaches the section's, so in 500 the rows may reach 140 down the list: the four, the least it starts with. */
    function laidOut(wrapper: ReturnType<typeof page>, room = 500) {
      const rect = (el: Element, top: number, height: number) =>
        Object.defineProperty(el, 'getBoundingClientRect', { configurable: true, value: () => ({ top, bottom: top + height, height }) })
      const freeWindow = wrapper.get('[data-testid="free-window"]').element
      const list = freeWindow.firstElementChild!
      rect(wrapper.get('[data-testid="homepage-section-plans"]').element, 0, room)
      rect(freeWindow, 300, 100)
      rect(list, 300, 700)
      ;[...list.children].forEach((row, i) => rect(row, i < 4 ? 300 + 25 * i : 400 + 50 * (i - 4), i < 4 ? 25 : 50))
      rect(wrapper.get('[data-testid="plan-no-account"]').element, 0, 420)
    }
    async function atThePlans(room?: number) {
      const wrapper = page(3)
      laidOut(wrapper, room)
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

    it('starts with as many whole rows as fit a taller room (ticket 1060)', async () => {
      // In 700 the rows may reach 340 down the list: the four and the next four, 50 tall each.
      const wrapper = await atThePlans(700)
      expect(list(wrapper).attributes('style')).toContain('height: 300px')
      expect(list(wrapper).classes()).toContain('plan__free--fading')
    })

    it('has nothing to grow where the whole list fits at the start (ticket 1060)', async () => {
      const wrapper = await atThePlans(2000)
      expect(list(wrapper).attributes('style')).toContain('height: 700px')
      expect(list(wrapper).classes()).not.toContain('plan__free--fading')
      expect(wrapper.get('.homepage__free-room').attributes('style')).toContain('calc(100% + 0px)')
    })

    it('has nothing to grow for a new visitor, so the section reaches no further than its room (ticket 0947)', async () => {
      const wrapper = page(0)
      await step(wrapper, 2)
      await flushPromises()
      expect(wrapper.find('[data-testid="free-window"]').exists()).toBe(false)
      expect(wrapper.get('.homepage__free-room').attributes('style')).toContain('calc(100% + 0px)')
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
  // Ticket 0923: No account's button runs the strip's way in, Make your first Project for a new visitor.
  it('sit below the coffee tile, and their button makes the first Project, or opens the editor once Projects are saved', async () => {
    for (const [count, event] of [[0, 'makeFirstProject'], [3, 'openEditor']] as const) {
      const wrapper = page(count)
      const html = wrapper.html()
      expect(html.indexOf('data-testid="homepage-plans"')).toBeGreaterThan(html.indexOf('data-testid="homepage-coffee"'))
      await wrapper.get(count ? '[data-testid="plan-no-account"] button' : '[data-testid="free-to-use-way-in"]').trigger('click')
      expect(wrapper.emitted(event)).toHaveLength(1)
    }
  })
  // Tickets 0871, 0947: a first visit doesn't end on Coming soon, nor on one tile; the step is named by the heading.
  it('show a new visitor no tiles, the step named for Free to use, and the three once Projects are saved', () => {
    const plans = (count: number) => {
      const wrapper = page(count)
      return {
        step: wrapper.get('[data-testid="section-step"][data-step="plans"]').text(),
        tiles: wrapper.findAll('[data-testid="homepage-plans"] .plan').length,
      }
    }
    expect(plans(0)).toEqual({ step: 'Free to use', tiles: 0 })
    expect(plans(3)).toEqual({ step: 'Three ways to use it', tiles: 3 })
  })
})

describe('HomePage on a phone (ticket 0827)', () => {
  beforeEach(() => setScreenWidth(390))
  const shown = (wrapper: ReturnType<typeof page>) =>
    ['welcome', 'inside', 'coffee', 'plans'].find((id) => wrapper.get(`[data-testid="homepage-section-${id}"]`).classes().includes('homepage__section--shown'))

  it('has its own bar in place of the Progress bar, ↑ and ↓ turning the page as Back and Next do', async () => {
    const wrapper = page()
    expect(wrapper.find('[data-testid="section-bar"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="phone-bar-name"]').text()).toBe('Welcome')
    await wrapper.get('[data-testid="phone-bar-next"]').trigger('click')
    expect(shown(wrapper)).toBe('inside')
    expect(wrapper.get('[data-testid="phone-bar-counter"]').text()).toBe('2/4')
    await wrapper.get('[data-testid="phone-bar-back"]').trigger('click')
    expect(shown(wrapper)).toBe('welcome')
  })

  it('goes into the editor from the bar\'s main button as the strip\'s way in does, which is not in the strip', async () => {
    const fresh = page()
    expect(fresh.find('[data-testid="strip-way-in"]').exists()).toBe(false)
    const make = fresh.get('[data-testid="homepage-phone-way-in"]')
    expect(make.text()).toBe('Make your first Project')
    await make.trigger('click')
    expect(fresh.emitted('makeFirstProject')).toHaveLength(1)

    const returning = page(3)
    const open = returning.get('[data-testid="homepage-phone-way-in"]')
    expect(open.text()).toBe('Open the editor')
    await open.trigger('click')
    expect(returning.emitted('openEditor')).toHaveLength(1)
  })

  it('keeps Projects library in the strip as its icon and count, named with both, opening the library', async () => {
    const wrapper = page(3)
    const wayIn = wrapper.get('[data-testid="strip-way-in"]')
    expect(wayIn.findAll('button')).toHaveLength(1)
    const library = wayIn.get('[data-testid="homepage-saved-projects"]')
    expect(library.text()).toBe('3')
    expect(library.get('[data-icon]').attributes('data-icon')).toBe('library')
    expect(library.attributes('aria-label')).toBe(`${en.projects.heading}, 3`)
    expect(library.classes()).toContain('app-button--box')
    // It is not the way in, so Welcome leaves it shown (ticket 0830).
    expect(wayIn.classes()).not.toContain('canvas-strip__way-in--away')
    await library.trigger('click')
    expect(wrapper.emitted('openSavedProjects')).toHaveLength(1)
  })

  it('does not zoom, whatever was remembered', async () => {
    setScreenWidth(600)
    const first = page()
    await first.get('[data-testid="zoom-in"]').trigger('click')
    first.unmount()
    setScreenWidth(390)
    expect((page().get('.homepage__page').element as HTMLElement).style.zoom).toBe('1')
  })

  it('ends each section but the last with "Next · {section}"', () => {
    const wrapper = page()
    const line = (id: string) => wrapper.find(`[data-testid="homepage-section-${id}"] [data-testid="homepage-next-line"]`)
    expect(line('welcome').text()).toBe("Next · What's inside")
    expect(line('inside').text()).toBe('Next · Made by one family')
    expect(line('coffee').text()).toBe('Next · Free to use')
    expect(line('plans').exists()).toBe(false)
  })

  it('lays the sections out for it: no editor, the promises listed, the plans stacked with no growing', () => {
    const wrapper = page()
    // Welcome has no way in of its own: the bar's main button is the way in (ticket 0830); its cuff keeps its moves.
    const buttons = wrapper.findAll('[data-testid="homepage-welcome"] button').map((button) => button.attributes('data-testid'))
    expect(buttons).toEqual(['welcome-cuff-previous', 'welcome-cuff-next'])
    expect(wrapper.get('[data-testid="homepage-welcome"] > [data-testid="welcome-promises"]').classes()).toContain('grouped-list')
    expect(wrapper.get('[data-testid="whats-inside"]').attributes('data-with-editor')).toBe('false')
    expect(wrapper.get('[data-testid="homepage-coffee"] > [data-testid="homepage-promises"]').classes()).toContain('grouped-list')
    expect(wrapper.get('[data-testid="homepage-plans"]').classes()).toContain('plans--phone')
    expect(wrapper.find('.homepage__free-room').exists()).toBe(false)
    expect(wrapper.get('[data-testid="free-window"]').attributes('style')).toBeUndefined()
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

describe('HomePage: Create free account (ticket 0391)', () => {
  it('asks for the editor on the Sign in Subpanel from the plans’ Free account tile', async () => {
    const wrapper = page(3)
    await flushPromises()
    await wrapper.get('[data-testid="plan-create-account"]').trigger('click')
    expect(wrapper.emitted('createAccount')).toHaveLength(1)
    expect(wrapper.emitted('openEditor')).toBeUndefined()
    wrapper.unmount()
  })
})
