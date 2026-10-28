import { beforeEach, describe, expect, it } from 'vitest'
import { mountWithProject } from './testUtils/seedProject'
import { drawnProject, pressBead } from './testUtils/beads'
import { choosePanelOption } from './testUtils/choosePanelOption'
import { openPanel, pickColor } from './testUtils/pill'
import { frameGrid } from './testUtils/frameGrid'

// The Tool pill's wiring (ticket 439, ADR 0046): one test per control → flow. Where it docks and how it reads and keeps
// the edge are in ToolPill and devicePreferences, the recents and color keys in toolPill and useToolPill, the popover's
// Escape and press outside in useOverlayLayer.

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

const pillOf = (wrapper: Awaited<ReturnType<typeof mountWithProject>>) => wrapper.get('[data-testid="tool-pill"]')

describe('the Tool pill', () => {
  it('moves from the Menu panel\'s Tools position and remembers it on the device', async () => {
    const wrapper = await mountWithProject(15, 30)
    await openPanel(wrapper, 'strip-menu')

    await choosePanelOption(wrapper, 'menu-tools-position', 'right')

    expect(pillOf(wrapper).attributes('data-position')).toBe('right')
    expect(localStorage.getItem('openbeads:tool-pill-position')).toBe('right')
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
    expect({ html: pillOf(wrapper).html(), style: pillOf(wrapper).attributes('style') }).toEqual(before)
  })

  it('closes the colour popover on a press on the canvas, which paints nothing', async () => {
    const wrapper = await mountWithProject(15, 30, { attachTo: document.body })
    await wrapper.get('[data-testid="pill-color"]').trigger('click')
    expect(wrapper.find('[data-testid="color-popover"]').exists()).toBe(true)

    await pressBead(wrapper, 0)
    await wrapper.find('.app-shell').trigger('mouseup')

    expect(wrapper.find('[data-testid="color-popover"]').exists()).toBe(false)
    expect(frameGrid(drawnProject(wrapper)).flat().every((cell) => !cell.color)).toBe(true)
    wrapper.unmount()
  })

  it('shows a recent color as a chip, left out of the popover Palette, and the chip picks it', async () => {
    const wrapper = await mountWithProject(15, 30)
    await pickColor(wrapper, 'blue')
    expect(wrapper.find('[data-testid="color-popover"]').exists()).toBe(false) // a pick closes the popover
    await pickColor(wrapper, 'green')

    await wrapper.get('[data-testid="pill-color"]').trigger('click')
    expect(wrapper.find('[data-color-id="blue"]').exists()).toBe(false)
    await wrapper.get('[data-testid="pill-color"]').trigger('click')
    await wrapper.findAll('[data-testid="pill-recent"]')[0]!.trigger('click')

    expect(wrapper.get('[data-testid="pill-color"]').attributes('aria-label')).toBe('Color, Blue')
  })
})
