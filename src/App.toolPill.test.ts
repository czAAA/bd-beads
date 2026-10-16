import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { mountWithProject } from './testUtils/seedProject'
import { drawnProject, pressBead } from './testUtils/beads'
import { openSheet, pickColor, pickTool } from './testUtils/pill'
import { frameGrid } from './domain/project'
import { PALETTE } from './domain/palette'
import App from './App.vue'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

describe('App shell, the Tool pill layout (tickets 383, 439, ADR 0046, ADR 0059)', () => {
  it('shows the Tool pill, the Canvas strip and no header or Toolbox', async () => {
    const wrapper = await mountWithProject(15, 30)
    expect(wrapper.find('[data-testid="tool-pill"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="canvas-strip"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="app-topbar"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="app-main-panel"]').exists()).toBe(false)
  })

  it('shows the New Project bar in the Progress bar place with no Project open, and no pill', () => {
    const wrapper = mount(App)
    expect(wrapper.find('[data-testid="phone-project-bar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tool-pill"]').exists()).toBe(false)
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

describe('the Tool pill (ticket 439, ADR 0059)', () => {
  const pillOf = (wrapper: Awaited<ReturnType<typeof mountWithProject>>) => wrapper.get('[data-testid="tool-pill"]')

  it('docks at the bottom by default', async () => {
    expect(pillOf(await mountWithProject(15, 30)).attributes('data-position')).toBe('bottom')
  })

  it('docks to the stored edge when it is one of the four', async () => {
    localStorage.setItem('openbeads:tool-pill-position', 'left')
    expect(pillOf(await mountWithProject(15, 30)).attributes('data-position')).toBe('left')
  })

  it('falls back to the bottom when the stored value is not an edge', async () => {
    localStorage.setItem('openbeads:tool-pill-position', 'diagonal')
    expect(pillOf(await mountWithProject(15, 30)).attributes('data-position')).toBe('bottom')
  })

  it('moves from the Menu sheet\'s Tools position and remembers it on the device', async () => {
    const wrapper = await mountWithProject(15, 30)
    await openSheet(wrapper, 'strip-menu')
    const position = wrapper.get('[data-testid="menu-tools-position"]')
    expect(position.get('[data-value="bottom"]').attributes('aria-checked')).toBe('true')

    await position.get('[data-value="right"]').trigger('click')

    expect(pillOf(wrapper).attributes('data-position')).toBe('right')
    expect(localStorage.getItem('openbeads:tool-pill-position')).toBe('right')
    await position.get('[data-value="bottom"]').trigger('click')
    expect(localStorage.getItem('openbeads:tool-pill-position')).toBeNull()
  })

  it('moves with the grip\'s arrow keys', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.get('[data-testid="tool-pill-grip"]').trigger('keydown', { key: 'ArrowLeft' })
    expect(pillOf(wrapper).attributes('data-position')).toBe('left')
  })

  it('is not part of the zoomed canvas: a zoom step changes the Project and leaves the pill as it was', async () => {
    const wrapper = await mountWithProject(15, 30)
    const pill = pillOf(wrapper)
    const before = { html: pill.html(), style: pill.attributes('style') }
    const zoom = wrapper.get('[data-testid="project-surface"]').attributes('data-zoom')

    await wrapper.get('[data-testid="zoom-in"]').trigger('click')

    expect(wrapper.get('[data-testid="project-surface"]').attributes('data-zoom')).not.toBe(zoom)
    expect(pill.element.closest('[data-testid="project-surface"]')).toBeNull()
    expect(wrapper.get('[data-testid="app-canvas"]').find('[data-testid="project-surface"]').element.contains(pill.element)).toBe(false)
    expect({ html: pillOf(wrapper).html(), style: pillOf(wrapper).attributes('style') }).toEqual(before)
  })

  it('opens the colour popover from the colour tile and closes it on Escape, Close and a press outside, which only closes', async () => {
    const wrapper = await mountWithProject(15, 30, { attachTo: document.body })
    const popover = () => wrapper.find('[data-testid="color-popover"]')

    await wrapper.get('[data-testid="pill-color"]').trigger('click')
    expect(popover().exists()).toBe(true)
    expect(wrapper.find('[data-testid="bottom-sheet"]').exists()).toBe(false)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(popover().exists()).toBe(false)

    await wrapper.get('[data-testid="pill-color"]').trigger('click')
    await wrapper.get('[data-testid="color-popover-close"]').trigger('click')
    expect(popover().exists()).toBe(false)

    await wrapper.get('[data-testid="pill-color"]').trigger('click')
    await pressBead(wrapper, 0) // a press on the canvas outside the popover
    expect(popover().exists()).toBe(false)
    await wrapper.find('.app-shell').trigger('mouseup')
    expect(frameGrid(drawnProject(wrapper)).flat().every((cell) => !cell.color)).toBe(true)
    wrapper.unmount()
  })

  it('closes the popover when a colour is picked, and paints with it', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.get('[data-testid="pill-color"]').trigger('click')
    await wrapper.get('[data-testid="color-popover"] [data-color-id="blue"]').trigger('click')

    expect(wrapper.find('[data-testid="color-popover"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="pill-color"]').attributes('aria-label')).toBe('Color, Blue')
  })

  it('shows the recents beside the swatch by default, newest first, with the colour chosen last at the front, until One color is chosen', async () => {
    const wrapper = await mountWithProject(15, 30)
    await pickColor(wrapper, 'blue')
    await pickColor(wrapper, 'green')
    await pickColor(wrapper, 'yellow')

    expect(localStorage.getItem('openbeads:pill-colors')).toBeNull()
    const recents = wrapper.findAll('[data-testid="pill-recent"]')
    expect(recents).toHaveLength(3)
    expect(localStorage.getItem('openbeads:recent-colors')!.split(',')).toHaveLength(4) // red, blue, green, yellow
    await recents[0]!.trigger('click') // green: used just before yellow
    expect(wrapper.get('[data-testid="pill-color"]').attributes('aria-label')).toBe('Color, Green')
    expect(localStorage.getItem('openbeads:recent-colors')!.split(',')[0]).toBe(PALETTE.find((color) => color.id === 'green')!.hex)

    await wrapper.get('[data-testid="pill-color"]').trigger('click')
    await wrapper.get('[data-testid="color-popover-mode"] [data-value="one"]').trigger('click')
    await wrapper.get('[data-testid="color-popover-close"]').trigger('click')
    expect(localStorage.getItem('openbeads:pill-colors')).toBe('one')
    expect(wrapper.find('[data-testid="pill-recent"]').exists()).toBe(false)
  })

  it('has no standalone Select all: it is on Ctrl+A and, once a Selection exists, the Selection bar (ticket 439)', async () => {
    const wrapper = await mountWithProject(6, 6)
    await pickTool(wrapper, 'select')
    expect(wrapper.find('[data-testid="context-bar"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="context-bar-select-all"]').exists()).toBe(false)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }))
    await nextTick()
    expect(wrapper.find('[data-testid="context-bar-size"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="context-bar-select-all"]').exists()).toBe(true)
  })
})
