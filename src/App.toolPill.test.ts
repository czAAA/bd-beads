import { beforeEach, describe, expect, it } from 'vitest'
import { mountWithProject } from './testUtils/seedProject'
import { beadColors, beadPoint, drawnProject, hoverBead, pressBead } from './testUtils/beads'
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

  it('Mirror (ticket 0703): key 8 turns it on, a stroke lands on both sides of the Frame, the tile opens the popover and an Axis chip is saved with the Project', async () => {
    const wrapper = await mountWithProject(15, 30, { attachTo: document.body })
    await pickColor(wrapper, 'red')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '8', bubbles: true }))
    await flushPromises()

    await pressBead(wrapper, 0)
    await wrapper.find('.app-shell').trigger('mouseup')
    const row = beadColors(wrapper)[0]!
    expect(row[0]).toBe('#e63746')
    expect(row[row.length - 1]).toBe('#e63746')
    expect(row.filter(Boolean)).toHaveLength(2)

    await wrapper.get('[data-testid="pill-tool-mirror"]').trigger('click')
    await wrapper.get('[data-testid="mirror-axis-topBottom"]').trigger('click')
    expect(loadProjects()[0]!.mirror).toMatchObject({ mode: 'mirror', axes: { leftRight: true, topBottom: true } })
    wrapper.unmount()
  })

  it('Radial (ticket 0705): the chip turns Radial on, and a stroke on a loom Frame lands at every corner in Mirror mode at Fold 2', async () => {
    const wrapper = await mountWithProject(15, 30, { attachTo: document.body })
    await pickColor(wrapper, 'red')
    await wrapper.get('[data-testid="pill-tool-mirror"]').trigger('click')
    await wrapper.get('[data-testid="mirror-axis-radial"]').trigger('click')
    expect(wrapper.get('[data-testid="mirror-fold-value"]').text()).toBe('2')
    await wrapper.get('[data-testid="mirror-popover-close"]').trigger('click')
    await flushPromises()

    await pressBead(wrapper, 0)
    await wrapper.find('.app-shell').trigger('mouseup')
    const grid = beadColors(wrapper)
    const corners = [grid[0]![0], grid[0]!.at(-1), grid.at(-1)![0], grid.at(-1)!.at(-1)]
    expect(corners).toEqual(['#e63746', '#e63746', '#e63746', '#e63746'])
    expect(grid.flat().filter(Boolean)).toHaveLength(4)
    expect(loadProjects()[0]!.mirror).toMatchObject({ mode: 'mirror', axes: { leftRight: false, topBottom: false, radial: true }, fold: 2 })
    wrapper.unmount()
  })

  it('Radial on a Star Frame (ticket 0706): the popover notes the five sides from the shape, and a stroke on one arm lands on every arm, reflected within each in Mirror mode', async () => {
    const open = withFrameSheet(createProject({ technique: 'loom', beadId: DEFAULT_BEAD.id, size: { width: 4, height: 4, unit: 'beads' } }), undefined)
    const placed = changeFrame(open, { custom: { shape: 'star', size: 3, centre: { row: 20, column: 20 } } })
    if (placed.kind !== 'changed') throw new Error('expected a Star')
    saveProjects([placed.project])
    const wrapper = mount(App, { attachTo: document.body })
    await nextTick()
    await pickColor(wrapper, 'red')
    await wrapper.get('[data-testid="pill-tool-mirror"]').trigger('click')
    await wrapper.get('[data-testid="mirror-axis-radial"]').trigger('click')
    // The shape reaches the popover: the Note in the Fold's place (what it says is the popover's own test).
    expect(wrapper.find('[data-testid="mirror-sides-note"]').exists()).toBe(true)
    await wrapper.get('[data-testid="mirror-popover-close"]').trigger('click')
    await flushPromises()

    // The Star's first bead (round 0, place 0), named from the Frame's corner as a Frame press is aimed.
    const own = frameOf(drawnProject(wrapper))!
    await pressBead(wrapper, { row: own.row, column: own.column, layer: 'frame' })
    await wrapper.find('.app-shell').trigger('mouseup')
    // The stroke reaches the other arms (which beads, and how many, is the domain's test).
    const beads = beadsOfLayer(drawnProject(wrapper), 'frame')!
    expect([0, 4, 8, 12, 16].map((column) => colorAt(beads, 0, column))).toEqual(['#e63746', '#e63746', '#e63746', '#e63746', '#e63746'])
    wrapper.unmount()
  })

  it('Area (ticket 0710): Select area closes the popover, a drag over the beads sets the Area, a stroke mirrors inside it, and Clear the area removes it', async () => {
    const wrapper = await mountWithProject(15, 30, { attachTo: document.body })
    const surface = wrapper.get('[data-testid="project-surface"]')
    await wrapper.get('[data-testid="pill-tool-mirror"]').trigger('click')
    await wrapper.get('[data-testid="mirror-select-area"]').trigger('click')
    expect(wrapper.find('[data-testid="mirror-popover"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="canvas-hint-picking"]').text()).toContain('click the margin for the whole Frame')

    await pressBead(wrapper, { row: 0, column: 0, layer: 'frame' })
    await hoverBead(wrapper, { row: 1, column: 3, layer: 'frame' }, { buttons: 1 })
    await surface.trigger('pointerup')
    await flushPromises()
    expect(wrapper.find('[data-testid="mirror-area"]').exists()).toBe(true)
    expect(loadProjects()[0]!.layers[1]!.mirrorArea).toEqual({ row: 0, column: 0, rows: 2, columns: 4 })
    await wrapper.get('[data-testid="mirror-popover-close"]').trigger('click')

    await pickColor(wrapper, 'red')
    await pressBead(wrapper, { row: 0, column: 0, layer: 'frame' })
    await surface.trigger('pointerup')
    const row = beadColors(wrapper)[0]!
    expect(row.flatMap((color, column) => (color ? [column] : []))).toEqual([0, 3])

    await wrapper.get('[data-testid="pill-tool-mirror"]').trigger('click')
    await wrapper.get('[data-testid="mirror-clear-area"]').trigger('click')
    expect(loadProjects()[0]!.layers[1]!.mirrorArea).toBeUndefined()
    wrapper.unmount()
  })

  it('Area (ticket 0710): a press on the keep-out margin while picking, taken on release, makes the whole Frame the Area', async () => {
    const wrapper = await mountWithProject(15, 30, { attachTo: document.body })
    const frame = frameOf(drawnProject(wrapper))!
    await wrapper.get('[data-testid="pill-tool-mirror"]').trigger('click')
    await wrapper.get('[data-testid="mirror-select-area"]').trigger('click')
    // Off the Frame and its margin a press sets nothing, picking or not.
    const outside = { row: frame.row - 8, column: frame.column }
    await pressBead(wrapper, outside)
    await wrapper.get('[data-testid="project-surface"]').trigger('pointerup', beadPoint(wrapper, outside))
    expect(loadProjects()[0]!.layers[1]!.mirrorArea).toBeUndefined()
    const margin = { row: frame.row - 1, column: frame.column }
    await pressBead(wrapper, margin)
    expect(loadProjects()[0]!.layers[1]!.mirrorArea).toBeUndefined()
    await hoverBead(wrapper, margin, { buttons: 1 })
    await wrapper.get('[data-testid="project-surface"]').trigger('pointerup', beadPoint(wrapper, margin))
    await flushPromises()
    expect(wrapper.get('[data-testid="mirror-area"]').text()).toContain('The whole Frame is the area')
    expect(loadProjects()[0]!.layers[1]!.mirrorArea).toEqual({ row: 0, column: 0, rows: frame.rows, columns: frame.columns })
    expect(wrapper.find('[data-testid="mirror-popover"]').exists()).toBe(true)
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
