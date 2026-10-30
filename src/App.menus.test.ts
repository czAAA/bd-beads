import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import App from './App.vue'
import { createProject } from './domain/createProject'
import { loadProjects, saveProjects } from './services/libraryStore'

/** Menu (spec 0440, ticket 443): what only the whole App shows, the empty canvas raising New Project. Each panel
 * control reaching its flow is in AppPanels.test (ticket 0618), what the panels hold in MenuPanel and ProjectPanel,
 * opening, Back, Escape and focus in AppPanel and useOverlayLayer, and fitting in panelsFit. */

const moth = () => createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Moth', size: { width: 10, height: 10, unit: 'beads' } })

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
  saveProjects([moth()])
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

function mountApp() {
  return mount(App, { attachTo: document.body })
}

const escape = async () => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  await nextTick()
}

describe('Menu', () => {
  it('opens on the form by itself with an empty library, and again from the empty-canvas bar button', async () => {
    saveProjects([])
    const wrapper = mountApp()
    expect(wrapper.find('[data-testid="bead-section"]').exists()).toBe(true)

    await escape()
    expect(wrapper.find('[data-testid="panel-body"]').exists()).toBe(false)
    await wrapper.get('[data-testid="phone-bar-new-project"]').trigger('click')
    expect(wrapper.find('[data-testid="bead-section"]').exists()).toBe(true)

    await wrapper.get('[data-testid="panel-body"] form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('[data-testid="panel-body"]').exists()).toBe(false)
    expect(loadProjects()).toHaveLength(1)
  })
})

describe('Feedback (ticket 0700)', () => {
  it('opens the Feedback sheet from the Menu’s Send feedback and from the link under Language', async () => {
    const wrapper = mountApp()
    await flushPromises()
    const fromMenu = async (testid: string) => {
      await wrapper.get('[data-testid="strip-menu"]').trigger('click')
      await wrapper.get(`[data-testid="${testid}"]`).trigger('click')
      return wrapper.get('[data-testid="feedback-sheet"]').attributes('data-kind')
    }
    expect(await fromMenu('menu-item-feedback')).toBe('general')
    await wrapper.get('[data-testid="feedback-cancel"]').trigger('click')
    expect(await fromMenu('menu-report-translation')).toBe('translation')
    expect(wrapper.get('[data-testid="feedback-language"] [aria-checked="true"]').text()).toBe('English')
    wrapper.unmount()
  })
})
