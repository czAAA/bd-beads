import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { mountWithProject } from './testUtils/seedProject'
import { fakeMatchMedia } from './testUtils/fakeMatchMedia'
import App from './App.vue'

/** The flag is a build-time constant, so each value gets its own mock of it (ticket 383). */
const flag = vi.hoisted(() => ({ on: true }))
vi.mock('./features', () => ({
  TOUR_ENABLED: false,
  MIRROR_ENABLED: false,
  get DOCK_LAYOUT_ENABLED() {
    return flag.on
  },
}))

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
  vi.unstubAllGlobals()
})

/** A window wide enough for the Toolbox layout (the 1024px split, ADR 0032). */
function wideWindow() {
  const media = fakeMatchMedia({ '(max-width: 1023px)': false })
  vi.stubGlobal('matchMedia', media.matchMedia)
}

describe('App shell with the Dock layout on (ticket 383)', () => {
  beforeEach(() => {
    flag.on = true
    wideWindow()
  })

  it('shows the Dock, the Canvas strip and no header or Toolbox at a wide width', async () => {
    const wrapper = await mountWithProject(15, 30)
    expect(wrapper.find('[data-testid="dock"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="canvas-strip"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="app-topbar"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="app-main-panel"]').exists()).toBe(false)
    expect(wrapper.find('.app-shell').classes()).toContain('app-shell--dock')
  })

  it('shows the New Project bar where the Dock would be with no Project open', () => {
    const wrapper = mount(App)
    expect(wrapper.find('[data-testid="phone-project-bar"]').exists()).toBe(true)
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

describe('App shell with the Dock layout off (ticket 383)', () => {
  beforeEach(() => {
    flag.on = false
  })

  it('shows the header, the Toolbox column and the full strip at a wide width, as before', async () => {
    wideWindow()
    const wrapper = await mountWithProject(15, 30)
    expect(wrapper.find('[data-testid="app-topbar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="app-main-panel"]').exists()).toBe(true)
    expect(wrapper.find('.app-shell').classes()).not.toContain('app-shell--dock')
    expect(wrapper.find('[data-testid="canvas-strip"] [data-testid="rulers-toggle"]').exists()).toBe(true)
  })

  it('keeps the Canvas color picker in the Project sheet header under 1024px', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.get('[data-testid="dock-project"]').trigger('click')
    expect(wrapper.get('[data-testid="bottom-sheet"]').find('[data-testid="canvas-color-button"]').exists()).toBe(true)
  })
})
