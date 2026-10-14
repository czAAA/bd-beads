import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { mountWithProject } from './testUtils/seedProject'
import App from './App.vue'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
})

describe('App shell, the Dock layout (ticket 383, ADR 0046; the only layout since ticket 412)', () => {
  it('shows the Dock, the Canvas strip and no header or Toolbox', async () => {
    const wrapper = await mountWithProject(15, 30)
    expect(wrapper.find('[data-testid="dock"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="canvas-strip"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="app-topbar"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="app-main-panel"]').exists()).toBe(false)
  })

  it('shows the New Project bar where the Dock would be with no Project open', () => {
    const wrapper = mount(App)
    expect(wrapper.find('[data-testid="phone-project-bar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="dock"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="app-main-panel"]').exists()).toBe(false)
  })

  it('keeps the strip to the title, size line and Canvas color picker, with no zoom buttons or Rulers toggle', async () => {
    const wrapper = await mountWithProject(15, 30)
    const strip = wrapper.get('[data-testid="canvas-strip"]')
    expect(strip.find('[data-testid="canvas-strip-title"]').exists()).toBe(true)
    expect(strip.find('[data-testid="canvas-strip-size"]').exists()).toBe(true)
    expect(strip.find('[data-testid="canvas-color-button"]').exists()).toBe(true)
    expect(strip.find('[data-testid="rulers-toggle"]').exists()).toBe(false)
    expect(strip.find('[data-testid="zoom-in"]').exists()).toBe(false)
  })

  it('leaves the Canvas color picker out of the Project sheet header', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.get('[data-testid="dock-project"]').trigger('click')
    const sheet = wrapper.get('[data-testid="bottom-sheet"]')
    expect(sheet.find('[data-testid="canvas-color-button"]').exists()).toBe(false)
  })
})
