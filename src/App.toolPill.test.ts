import { beforeEach, describe, expect, it } from 'vitest'
import { mountWithProject } from './testUtils/seedProject'
import { beadColors, drawnProject, hoverBead, pressBead } from './testUtils/beads'
import { beadsOfLayer, frameOf, withFrameSheet } from './domain/layerRecord'
import { colorAt } from './domain/canvas'
import { changeFrame } from './domain/changeFrame'
import { createProject } from './domain/createProject'
import { DEFAULT_BEAD } from './domain/beads'
import { saveProjects } from './services/libraryStore'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import App from './App.vue'
import { flushPromises } from '@vue/test-utils'
import { loadProjects } from './services/libraryStore'
import { choosePanelOption } from './testUtils/choosePanelOption'
import { copySelection, openPanel, pickColor, pickTool, selectAll } from './testUtils/pill'
import { withMirrorPlace } from './domain/mirror'
import type { GridPosition } from './domain/grid'
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

  /** A drag on the Canvas between two positions, released on the shell, as a real drag can end anywhere. */
  async function dragOn(wrapper: Awaited<ReturnType<typeof mountWithProject>>, from: GridPosition, to: GridPosition) {
    await pressBead(wrapper, from)
    await hoverBead(wrapper, to, { buttons: 1 })
    await wrapper.find('.app-shell').trigger('mouseup')
    await flushPromises()
  }

  /** A Canvas position well clear of the Frame and its keep-out margin, above it. */
  const aboveFrame = (wrapper: Awaited<ReturnType<typeof mountWithProject>>) => {
    const frame = frameOf(drawnProject(wrapper))!
    return { row: frame.row - 12, column: frame.column }
  }

  it('Mirror (ADR 0082): key 7 enters Mirror mode, a drag on the Canvas makes the Mirror there, saved, with its bar, and a Canvas stroke lands inside it', async () => {
    const wrapper = await mountWithProject(15, 30, { attachTo: document.body })
    const top = aboveFrame(wrapper)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '7', bubbles: true }))
    await flushPromises()
    expect(wrapper.get('[data-testid="pill-tool-mirror"]').attributes('aria-pressed')).toBe('true')

    await dragOn(wrapper, top, { row: top.row + 1, column: top.column + 3 })
    expect(loadProjects()[0]!.mirror?.place).toEqual({ layer: 'canvas', area: { ...top, rows: 2, columns: 4 } })
    expect(wrapper.find('[data-testid="mirror-bar"]').exists()).toBe(true)

    await pickColor(wrapper, 'red')
    await pickTool(wrapper, 'paint')
    await pressBead(wrapper, top)
    await wrapper.find('.app-shell').trigger('mouseup')
    expect(beadsOfLayer(drawnProject(wrapper), 'canvas')[top.row]).toEqual({ [top.column]: '#e63746', [top.column + 3]: '#e63746' })
    wrapper.unmount()
  })

  it('Mirror mode (ADR 0082): its drag is the Mirror\'s, so the clipboard stays and Paste with it', async () => {
    const wrapper = await mountWithProject(15, 30, { attachTo: document.body })
    await pickColor(wrapper, 'red')
    await pressBead(wrapper, 0)
    await wrapper.find('.app-shell').trigger('mouseup')
    await selectAll(wrapper)
    await copySelection(wrapper)
    expect(wrapper.find('[data-testid="pill-tool-paste"]').exists()).toBe(true)

    const top = aboveFrame(wrapper)
    await wrapper.get('[data-testid="pill-tool-mirror"]').trigger('click')
    await dragOn(wrapper, top, { row: top.row + 2, column: top.column + 2 })
    expect(loadProjects()[0]!.mirror?.place).toEqual({ layer: 'canvas', area: { ...top, rows: 3, columns: 3 } })
    expect(wrapper.find('[data-testid="pill-tool-paste"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('the Mirror bar (ADR 0082): its Mode and Close mirror reach the Project', async () => {
    const wrapper = await mountWithProject(15, 30, { attachTo: document.body })
    const top = aboveFrame(wrapper)
    await wrapper.get('[data-testid="pill-tool-mirror"]').trigger('click')
    await dragOn(wrapper, top, { row: top.row + 3, column: top.column + 3 })

    await wrapper.get('[data-testid="mirror-bar-mode-repeat"]').trigger('click')
    await flushPromises()
    expect(loadProjects()[0]!.mirror?.mode).toBe('repeat')
    await wrapper.get('[data-testid="mirror-bar-close"]').trigger('click')
    await flushPromises()
    expect(loadProjects()[0]!.mirror).toMatchObject({ mode: 'repeat', place: null })
    expect(wrapper.find('[data-testid="mirror-bar"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('Mirror the whole Frame (MarginSheet card): the margin\'s button makes the whole Frame the Mirror, a stroke on the Frame lands at its counterpart, and pressed again it turns the Mirror off', async () => {
    const wrapper = await mountWithProject(15, 30, { attachTo: document.body })
    await wrapper.get('[data-testid="margin-mirror-frame"]').trigger('click')
    await flushPromises()
    expect(loadProjects()[0]!.mirror?.place).toEqual({ layer: 'frame' })

    await pickColor(wrapper, 'red')
    await pickTool(wrapper, 'paint')
    await pressBead(wrapper, 0)
    await wrapper.find('.app-shell').trigger('mouseup')
    const row = beadColors(wrapper)[0]!
    expect([row[0], row.at(-1)]).toEqual(['#e63746', '#e63746'])

    await wrapper.get('[data-testid="margin-mirror-frame"]').trigger('click')
    await flushPromises()
    expect(loadProjects()[0]!.mirror?.place).toBeNull()
    wrapper.unmount()
  })

  it('Mirror the whole Frame on a Star Frame (ticket 0706): the shape\'s own Radial, a stroke on one arm landing on every arm', async () => {
    const open = withFrameSheet(createProject({ technique: 'loom', beadId: DEFAULT_BEAD.id, size: { width: 4, height: 4, unit: 'beads' } }), undefined)
    const placed = changeFrame(open, { custom: { shape: 'star', size: 3, centre: { row: 20, column: 20 } } })
    if (placed.kind !== 'changed') throw new Error('expected a Star')
    saveProjects([withMirrorPlace(placed.project, { layer: 'frame' })])
    const wrapper = mount(App, { attachTo: document.body })
    await nextTick()
    await pickColor(wrapper, 'red')
    await pickTool(wrapper, 'paint')

    // The Star's first bead (round 0, place 0), named from the Frame's corner as a Frame press is aimed.
    const own = frameOf(drawnProject(wrapper))!
    await pressBead(wrapper, { row: own.row, column: own.column, layer: 'frame' })
    await wrapper.find('.app-shell').trigger('mouseup')
    // The stroke reaches the other arms (which beads, and how many, is the domain's test).
    const beads = beadsOfLayer(drawnProject(wrapper), 'frame')!
    expect([0, 4, 8, 12, 16].map((column) => colorAt(beads, 0, column))).toEqual(['#e63746', '#e63746', '#e63746', '#e63746', '#e63746'])
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
