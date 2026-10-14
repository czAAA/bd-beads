import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { hoverBead, pressBead, selectedBeadCount } from './testUtils/beads'
import { frameGrid } from './domain/project'
import { loadProjects } from './services/libraryStore'
import { createProjectViaForm, mountWithProject } from './testUtils/seedProject'
import { copySelection, openSheet, pickColor, pickTool } from './testUtils/dock'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'ru') // these tests read the Russian dictionary
})

describe('App select, copy and paste', () => {
  /** A drag across the grid: press on one cell, move through the rest, release (release is on the shell, as a real drag can end anywhere). */
  async function drag(wrapper: ReturnType<typeof mount>, indices: number[]) {
    await pressBead(wrapper, indices[0]!)
    for (const index of indices.slice(1)) {
      await hoverBead(wrapper, index, { buttons: 1 })
    }
    await wrapper.find('.app-shell').trigger('mouseup')
  }

  /** Presses and releases one cell without moving — a click, which is what stamps a copied block. */
  async function click(wrapper: ReturnType<typeof mount>, index: number) {
    await pressBead(wrapper, index)
    await wrapper.find('.app-shell').trigger('mouseup')
  }

  function selectedCount(wrapper: ReturnType<typeof mount>) {
    return selectedBeadCount(wrapper)
  }

  /** A 4x4 Project with a red cell at (0,0) and a blue one at (1,1), ready to copy as a two-color motif. */
  async function projectWithMotif(wrapper: ReturnType<typeof mount>) {
    await pickColor(wrapper, 'red')
    await click(wrapper, 0) // (0,0)
    await pickColor(wrapper, 'blue')
    await click(wrapper, 5) // (1,1)
    await pickTool(wrapper, 'select')
  }

  it('offers Select alongside Paint and Fill, chosen the same way', async () => {
    const wrapper = await mountWithProject(15, 30)

    await pickTool(wrapper, 'select')

    await openSheet(wrapper, 'dock-tool')
    expect(wrapper.find('[data-testid="sheet-tool-select"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[data-testid="sheet-tool-paint"]').attributes('aria-pressed')).toBe('false')
  })

  it('marks out a rectangle as the cursor is dragged, and keeps it after the drag ends', async () => {
    const wrapper = await mountWithProject(6, 6) // 4x4
    await pickTool(wrapper, 'select')

    await drag(wrapper, [0, 1, 5]) // (0,0) -> (1,1)

    expect(selectedCount(wrapper)).toBe(4)
  })

  it('enables Copy only once something is selected', async () => {
    const wrapper = await mountWithProject(6, 6)
    await pickTool(wrapper, 'select')

    expect(wrapper.find('[data-testid=\"context-bar-copy\"]').exists()).toBe(false)

    await drag(wrapper, [0, 1])

    expect(wrapper.find('[data-testid=\"context-bar-copy\"]').exists()).toBe(true)
  })

  it('stamps the copied block where it is clicked, as a single undo step', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithMotif(wrapper)
    await drag(wrapper, [0, 1, 5])
    await copySelection(wrapper)

    await click(wrapper, 10) // (2,2)

    const grid = frameGrid(loadProjects()[0]!)
    expect(grid[2]![2]!.color).toBe('#e63746')
    expect(grid[3]![3]!.color).toBe('#2f6fed')

    await wrapper.find('[data-testid="zoom-pill-undo"]').trigger('click')

    expect(frameGrid(loadProjects()[0]!)[2]![2]!.color).toBeNull()
    expect(frameGrid(loadProjects()[0]!)[3]![3]!.color).toBeNull()
  })

  it.each(['paint', 'fill'] as const)('forgets the selected area when the tool changes to %s', async (tool) => {
    const wrapper = await mountWithProject(6, 6)
    await pickTool(wrapper, 'select')
    await drag(wrapper, [0, 1, 4, 5])
    expect(selectedCount(wrapper)).toBe(4)

    await pickTool(wrapper, tool)

    expect(selectedCount(wrapper)).toBe(0)
  })

  it('resets the Selection, but keeps the clipboard armed, when a different Project is opened (ticket 92)', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithMotif(wrapper)
    const firstId = loadProjects()[0]!.id
    await drag(wrapper, [0, 1, 5])
    await copySelection(wrapper)

    await createProjectViaForm(wrapper)
    await pickTool(wrapper, 'select')
    const newProject = () => loadProjects().find((p) => p.id !== firstId)!

    // The Selection itself still resets on a Project switch, same as before ticket 92.
    expect(selectedCount(wrapper)).toBe(0)
    expect(wrapper.find('[data-testid=\"context-bar-copy\"]').exists()).toBe(false)

    // But the clipboard survives the switch (ticket 92), so a click under Select still stamps the motif.
    // The new Project is an open canvas (ticket 342): the stamp lands at its first bead, with no Frame to count it in.
    await pressBead(wrapper, { row: 0, column: 0 })
    await wrapper.find('.app-shell').trigger('mouseup')
    expect(newProject().beads[0]?.[0]).toBe('#e63746')
  })
})

describe('App clipboard lifecycle (ticket 92)', () => {
  async function drag(wrapper: ReturnType<typeof mount>, indices: number[]) {
    await pressBead(wrapper, indices[0]!)
    for (const index of indices.slice(1)) {
      await hoverBead(wrapper, index, { buttons: 1 })
    }
    await wrapper.find('.app-shell').trigger('mouseup')
  }

  async function click(wrapper: ReturnType<typeof mount>, index: number) {
    await pressBead(wrapper, index)
    await wrapper.find('.app-shell').trigger('mouseup')
  }

  /** A 4x4 Project with a red cell at (0,0), Select active and that cell copied. */
  async function projectWithCopiedCell(wrapper: ReturnType<typeof mount>) {
    await pickColor(wrapper, 'red')
    await click(wrapper, 0) // (0,0)
    await pickTool(wrapper, 'select')
    await drag(wrapper, [0])
    await copySelection(wrapper)
  }

  async function hoverCell(wrapper: ReturnType<typeof mount>, index: number) {
    await hoverBead(wrapper, index)
  }

  function pasteAtHoveredCell() {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true }))
  }

  it('pastes at the cell under the pointer on Ctrl/Cmd+V, matching a click-to-paste stamp', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithCopiedCell(wrapper)
    await hoverCell(wrapper, 10) // (2,2)

    pasteAtHoveredCell()
    await flushPromises()

    expect(frameGrid(loadProjects()[0]!)[2]![2]!.color).toBe('#e63746')
  })

  it.each(['paint', 'fill'] as const)('pastes via Ctrl/Cmd+V while %s is the active tool', async (tool) => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithCopiedCell(wrapper)
    await pickTool(wrapper, tool)
    await hoverCell(wrapper, 10)

    pasteAtHoveredCell()
    await flushPromises()

    expect(frameGrid(loadProjects()[0]!)[2]![2]!.color).toBe('#e63746')
  })
})
