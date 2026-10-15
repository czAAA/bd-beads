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

  it('Piece selects the rectangle round the tapped bead\'s Piece, and a tap on empty space clears it (ticket 414)', async () => {
    const wrapper = await mountWithProject(6, 6) // 4x4
    await projectWithMotif(wrapper) // red (0,0) and blue (1,1) touch at a corner: one Piece
    await pickTool(wrapper, 'piece')

    await click(wrapper, 5)
    expect(selectedCount(wrapper)).toBe(4)

    await click(wrapper, 10) // (2,2) is empty
    expect(selectedCount(wrapper)).toBe(0)
  })

  it('Select all selects the rectangle round every bead and leaves Select active; on an empty canvas it does nothing (ticket 414)', async () => {
    const wrapper = await mountWithProject(6, 6)
    await pickTool(wrapper, 'select-all')
    expect(selectedCount(wrapper)).toBe(0)

    await projectWithMotif(wrapper)
    await pickTool(wrapper, 'select-all')

    expect(selectedCount(wrapper)).toBe(4)
    await openSheet(wrapper, 'dock-tool')
    expect(wrapper.find('[data-testid="sheet-tool-select"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[data-testid="sheet-tool-select-all"]').attributes('aria-pressed')).toBeUndefined()
  })

  it('keeps the Selection across Select and Piece, and drops it for any other tool (ticket 414)', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithMotif(wrapper)
    await pickTool(wrapper, 'select-all')

    await pickTool(wrapper, 'piece')
    expect(selectedCount(wrapper)).toBe(4)
    await pickTool(wrapper, 'select')
    expect(selectedCount(wrapper)).toBe(4)
    await pickTool(wrapper, 'paint')
    expect(selectedCount(wrapper)).toBe(0)
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

    await wrapper.find('[data-testid="strip-undo"]').trigger('click')

    expect(frameGrid(loadProjects()[0]!)[2]![2]!.color).toBeNull()
    expect(frameGrid(loadProjects()[0]!)[3]![3]!.color).toBeNull()
  })

  it('keeps the copied block armed after a stamp, so repeated stamps still work (ticket 415)', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithMotif(wrapper)
    await drag(wrapper, [0, 1, 5])
    await copySelection(wrapper)
    const stampAt = async (position: { row: number; column: number }) => {
      await pressBead(wrapper, position)
      await wrapper.find('.app-shell').trigger('mouseup')
    }

    await stampAt({ row: 2, column: 2 })
    await stampAt({ row: 2, column: 0 })

    const grid = frameGrid(loadProjects()[0]!)
    expect(grid[2]![2]!.color).toBe('#e63746')
    expect(grid[2]![0]!.color).toBe('#e63746')
    expect(grid[3]![1]!.color).toBe('#2f6fed')
  })

  it('Clear selection empties a partial Selection at once, with no confirmation, and keeps the Selection (ticket 415)', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithMotif(wrapper)
    await drag(wrapper, [0, 1])

    await wrapper.find('[data-testid="context-bar-clear"]').trigger('click')

    expect(wrapper.find('[data-testid="delete-all-modal"]').exists()).toBe(false)
    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBeNull()
    expect(frameGrid(loadProjects()[0]!)[1]![1]!.color).toBe('#2f6fed')
    expect(selectedCount(wrapper)).toBeGreaterThan(0)
  })

  it('Select all then Clear selection asks before wiping the drawing (ticket 415)', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithMotif(wrapper)
    await pickTool(wrapper, 'select-all')

    await wrapper.find('[data-testid="context-bar-clear"]').trigger('click')

    expect(wrapper.find('[data-testid="delete-all-modal"]').exists()).toBe(true)
    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#e63746')
  })

  it('Select all then the Eraser asks before wiping the drawing too (ticket 415)', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithMotif(wrapper)
    await pickTool(wrapper, 'select-all')

    await pickTool(wrapper, 'erase')

    expect(wrapper.find('[data-testid="delete-all-modal"]').exists()).toBe(true)
    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#e63746')
  })

  it('Frame on the Selection bar sets the Frame, and with a Frame already set moves it to the next Selection (ticket 407)', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithMotif(wrapper) // red (0,0) and blue (1,1): one Piece
    await pickColor(wrapper, 'red')
    await click(wrapper, 15) // a Piece of its own, at (3, 5)
    await pickTool(wrapper, 'piece')
    const tap = async (position: { row: number; column: number }) => {
      await pressBead(wrapper, position)
      await wrapper.find('.app-shell').trigger('mouseup')
    }

    await tap({ row: 1, column: 1 })
    await wrapper.get('[data-testid="context-bar-frame"]').trigger('click')
    await flushPromises()
    expect(loadProjects()[0]!.frame).toMatchObject({ row: 0, column: 0, rows: 2, columns: 2 })
    // Edit Frame starts on the new Frame (ticket 417); Done hands the canvas back to the Selection.
    expect(wrapper.find('[data-testid="edit-frame-steppers"]').exists()).toBe(true)
    await wrapper.get('[data-testid="context-bar-done-frame"]').trigger('click')
    expect(wrapper.find('[data-testid="edit-frame-steppers"]').exists()).toBe(false)

    await tap({ row: 3, column: 5 })
    await wrapper.get('[data-testid="context-bar-frame"]').trigger('click')
    await flushPromises()
    expect(loadProjects()[0]!.frame).toMatchObject({ row: 3, column: 5, rows: 1, columns: 1 })
  })

  it('Fill gives every position in the Selection the current colour (ticket 415)', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithMotif(wrapper)
    await drag(wrapper, [0, 1, 5])

    await wrapper.find('[data-testid="context-bar-fill"]').trigger('click')

    const grid = frameGrid(loadProjects()[0]!)
    expect(grid[0]![1]!.color).not.toBeNull()
    expect(grid[1]![0]!.color).not.toBeNull()
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
    // The new Project is a Canvas (ticket 342): the stamp lands at its first bead, with no Frame to count it in.
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
