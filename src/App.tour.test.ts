import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { afterStep, gridsEqual } from './domain/tour'
import { BEAD_CATALOG } from './domain/beads'
import { createPattern, frameGrid } from './domain/pattern'
import { loadPatterns, savePatterns } from './services/libraryStore'
import { en } from './i18n/en'
import { ru } from './i18n/ru'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
  localStorage.setItem('bd-beads:tour', 'running')
})

function mountApp() {
  return mount(App, { attachTo: document.body })
}

const card = (wrapper: ReturnType<typeof mountApp>) => wrapper.find('[data-testid="tour-card"]')

async function next(wrapper: ReturnType<typeof mountApp>) {
  await wrapper.find('[data-testid="tour-next"]').trigger('click')
  await flushPromises()
}

describe('App Tour (ticket 80)', () => {
  it('opens on step 1 of a running Tour, named for screen readers', async () => {
    const wrapper = mountApp()
    await flushPromises()

    expect(card(wrapper).attributes('role')).toBe('dialog')
    expect(card(wrapper).attributes('aria-label')).toBe(en.tour.stepLabel.replace('{n}', '1').replace('{total}', '11').replace('{title}', en.tour.steps.create.title))
    expect(wrapper.find('[data-testid="tour-progress"]').text()).toBe('1 of 11')
    expect(wrapper.find('[data-testid="tour-back-to-loom"]').text()).toBe(en.tour.backToLoom)
  })

  it('stays away from a device that has not started it', async () => {
    localStorage.removeItem('bd-beads:tour')
    const wrapper = mountApp()
    await flushPromises()
    expect(card(wrapper).exists()).toBe(false)
  })

  it('sets an open Pattern aside in step 1, so the New Pattern form is what it points at', async () => {
    savePatterns([createPattern({ technique: 'loom', beadId: BEAD_CATALOG[0]!.id, name: 'Fox', size: { width: 10, height: 10, unit: 'beads' } })])
    const wrapper = mountApp()
    await flushPromises()

    expect(wrapper.find('[data-testid="new-pattern-box"]').exists()).toBe(true)
    expect(card(wrapper).exists()).toBe(true)
  })

  it('says so when the control is not on screen, and Next does the step', async () => {
    const wrapper = mountApp()
    await flushPromises()
    expect(wrapper.find('[data-testid="tour-off-screen"]').text()).toBe(en.tour.offScreen)
  })

  it('walks all eleven steps with Next and leaves the real Pattern the artwork, in the Pattern library', async () => {
    const wrapper = mountApp()
    await flushPromises()

    for (let step = 1; step <= 11; step++) {
      expect(wrapper.find('[data-testid="tour-progress"]').text()).toBe(`${step} of 11`)
      await next(wrapper)
    }

    expect(card(wrapper).attributes('aria-label')).toBe(en.tour.final.title)
    expect(wrapper.find('[data-testid="tour-export"]').exists()).toBe(true)
    expect(localStorage.getItem('bd-beads:tour')).toBe('finished')

    const [pattern] = loadPatterns()
    expect(pattern).toMatchObject({ technique: 'loom', frame: { columns: 10, rows: 75 } })
    expect(gridsEqual(frameGrid(pattern!), afterStep(8))).toBe(true)

    await wrapper.find('[data-testid="tour-keep-editing"]').trigger('click')
    expect(card(wrapper).exists()).toBe(false)
  })

  it('Skip tour turns it off for good, with the toast', async () => {
    const wrapper = mountApp()
    await flushPromises()
    await wrapper.find('[data-testid="tour-skip"]').trigger('click')

    expect(card(wrapper).exists()).toBe(false)
    expect(localStorage.getItem('bd-beads:tour')).toBe('off')
    expect(wrapper.find('[data-testid="tour-off"]').text()).toBe(en.tour.skipToast)
  })

  it('Escape skips it too', async () => {
    const wrapper = mountApp()
    await flushPromises()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await flushPromises()

    expect(card(wrapper).exists()).toBe(false)
    expect(localStorage.getItem('bd-beads:tour')).toBe('off')
  })

  it('Take the tour in the menu starts it again from step 1', async () => {
    localStorage.setItem('bd-beads:tour', 'off')
    const wrapper = mountApp()
    await flushPromises()
    expect(card(wrapper).exists()).toBe(false)

    await wrapper.find('[data-testid="header-menu"]').trigger('click')
    await wrapper.find('[data-testid="menu-item-tour"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="tour-progress"]').text()).toBe('1 of 11')
    expect(localStorage.getItem('bd-beads:tour')).toBe('running')
  })

  it('speaks Russian', async () => {
    localStorage.setItem('bd-beads:locale', 'ru')
    const wrapper = mountApp()
    await flushPromises()

    expect(wrapper.find('[data-testid="tour-skip"]').text()).toBe(ru.tour.skip)
    expect(wrapper.find('[data-testid="tour-progress"]').text()).toBe('1 из 11')
  })

  it('resumes where it stopped, at the first step not done', async () => {
    const first = mountApp()
    await flushPromises()
    await next(first)
    await next(first)
    first.unmount()

    const again = mountApp()
    await flushPromises()
    expect(again.find('[data-testid="tour-progress"]').text()).toBe('3 of 11')
  })
})
