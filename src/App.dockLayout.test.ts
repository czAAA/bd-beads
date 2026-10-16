import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { mountWithProject } from './testUtils/seedProject'
import App from './App.vue'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
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

  it('holds Rulers, Undo, Redo, zoom out, level, zoom in, Fit and Canvas color in that order, with no title, size line or hint (ticket 425)', async () => {
    const wrapper = await mountWithProject(15, 30)
    const strip = wrapper.get('[data-testid="canvas-strip"]')
    const order = strip.findAll('[data-testid]').map((element) => element.attributes('data-testid'))
    expect(order.filter((id) => ['strip-menu', 'strip-project', 'strip-rulers', 'strip-undo', 'strip-redo', 'zoom-out', 'zoom-level', 'zoom-in', 'zoom-reset', 'canvas-color-button'].includes(id!))).toEqual([
      'strip-menu',
      'strip-project',
      'strip-rulers',
      'strip-undo',
      'strip-redo',
      'zoom-out',
      'zoom-level',
      'zoom-in',
      'zoom-reset',
      'canvas-color-button',
    ])
    for (const gone of ['canvas-strip-title', 'canvas-strip-size', 'canvas-strip-hint']) expect(strip.find(`[data-testid="${gone}"]`).exists()).toBe(false)
    expect(strip.find('svg[data-icon="grid"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="zoom-pill"]').exists()).toBe(false)
  })

  it('leaves the Canvas color picker out of the Project sheet header', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.get('[data-testid="strip-project"]').trigger('click')
    const sheet = wrapper.get('[data-testid="bottom-sheet"]')
    expect(sheet.find('[data-testid="canvas-color-button"]').exists()).toBe(false)
  })
})
