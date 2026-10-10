import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountWithProject } from './testUtils/seedProject'
import { en } from './i18n/en'

// Mirror is switched off (ticket 174, 365); these tests run it with the flag on, as the Tour's do.
vi.mock('./features', () => ({ TOUR_ENABLED: false, MIRROR_ENABLED: true }))

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
})

async function pressKey(init: KeyboardEventInit) {
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }))
  await flushPromises()
}

async function mountApp() {
  const wrapper = await mountWithProject(30, 30)
  await flushPromises()
  return wrapper
}

describe('App Mirror, switched on (ticket 365)', () => {
  it('shows the Mirror row in the Toolbox and opens its controls in place', async () => {
    const wrapper = await mountApp()
    const row = wrapper.get('[data-testid="tool-group-mirror"]')
    expect(row.text()).toContain(en.toolbox.groups.mirror)
    expect(row.text()).toContain('↔ 0 · ↕ 0')

    await row.get('button').trigger('click')

    expect(wrapper.find('[data-testid="mirror-left-right"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('steps the Left–right count with = and − and the Top–bottom count with ] and [', async () => {
    const wrapper = await mountApp()
    const summary = () => wrapper.get('[data-testid="tool-group-mirror"]').text()

    await pressKey({ key: '=' })
    await pressKey({ key: ']' })
    expect(summary()).toContain('↔ 1 · ↕ 1')

    await pressKey({ key: '-' })
    await pressKey({ key: '[' })
    expect(summary()).toContain('↔ 0 · ↕ 0')
    wrapper.unmount()
  })

  it('leaves Ctrl+= to Canvas zoom', async () => {
    const wrapper = await mountApp()

    await pressKey({ key: '=', ctrlKey: true })

    expect(wrapper.get('[data-testid="tool-group-mirror"]').text()).toContain('↔ 0 · ↕ 0')
    wrapper.unmount()
  })

  it('lists a Mirror group in the shortcuts help', async () => {
    const wrapper = await mountApp()

    await pressKey({ key: '?', shiftKey: true })

    const titles = wrapper.findAll('[data-testid="shortcuts-help-group"]').map((group) => group.text())
    expect(titles.some((text) => text.startsWith(en.toolbox.groups.mirror))).toBe(true)
    wrapper.unmount()
  })

  it('adds a Mirror button and sheet to the phone Dock', async () => {
    const wrapper = await mountApp()

    await wrapper.get('[data-testid="dock-mirror"]').trigger('click')

    expect(wrapper.get('[data-testid="bottom-sheet"]').find('[data-testid="mirror-left-right"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
