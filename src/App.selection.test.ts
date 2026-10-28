import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { hoverBead, pressBead, selectedBeadCount } from './testUtils/beads'
import { frameGrid } from './domain/project'
import { loadProjects } from './services/libraryStore'
import { createProjectViaForm, mountWithProject } from './testUtils/seedProject'
import { pressBar, copySelection, pickColor, pickTool, selectAll } from './testUtils/pill'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'ru') // these tests read the Russian dictionary
})

// One wiring test per control → flow path. What the Selection does is useSelectionGesture's to assert; what each
// control shows is its component's (ticket 0602).
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

  it('Piece selects the rectangle round the tapped bead\'s Piece, inside a Selection too (ticket 414)', async () => {
    const wrapper = await mountWithProject(6, 6) // 4x4
    await projectWithMotif(wrapper) // red (0,0) and blue (1,1) touch at a corner: one Piece
    await pickTool(wrapper, 'piece')

    await click(wrapper, 5)
    expect(selectedCount(wrapper)).toBe(4)

    // Inside a rectangle Selection the press goes to it, and is still a Piece tap, not Select's single bead.
    await selectAll(wrapper)
    await pickTool(wrapper, 'piece')
    await pressBead(wrapper, 5)
    await wrapper.find('[data-testid="project-surface"]').trigger('pointerup')
    expect(selectedCount(wrapper)).toBe(4)
  })

  it('Select all selects the Frame\'s inside from another tool, and makes Select active (tickets 414, 428)', async () => {
    const wrapper = await mountWithProject(6, 6) // a 4x4 Frame
    await projectWithMotif(wrapper)
    await pickTool(wrapper, 'paint')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }))
    await flushPromises()

    expect(selectedCount(wrapper)).toBe(16)
    expect(wrapper.find('[data-testid="pill-tool-select"]').attributes('aria-pressed')).toBe('true')
  })

  it('keeps the Selection across Select and Piece, and drops it for any other tool (ticket 414)', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithMotif(wrapper)
    await selectAll(wrapper)

    await pickTool(wrapper, 'piece')
    expect(selectedCount(wrapper)).toBe(16)
    await pickTool(wrapper, 'select')
    expect(selectedCount(wrapper)).toBe(16)
    await pickTool(wrapper, 'paint')
    expect(selectedCount(wrapper)).toBe(0)
  })

  it('marks out a rectangle as the cursor is dragged, and keeps it after the drag ends', async () => {
    const wrapper = await mountWithProject(6, 6) // 4x4
    await pickTool(wrapper, 'select')

    await drag(wrapper, [0, 1, 5]) // (0,0) -> (1,1)

    expect(selectedCount(wrapper)).toBe(4)
  })

  it('moves the Selection by a drag from inside it, and a press there that never moves selects that bead (ticket 414)', async () => {
    const wrapper = await mountWithProject(6, 6) // 4x4
    await projectWithMotif(wrapper) // the blue (1,1) is the colour chosen
    await drag(wrapper, [0, 1, 5]) // (0,0) -> (1,1): four beads, too few for handles

    await pressBead(wrapper, { row: 0, column: 0 })
    await hoverBead(wrapper, { row: 2, column: 2 }, { buttons: 1 })
    await wrapper.find('[data-testid="project-surface"]').trigger('pointerup')
    await pressBar(wrapper, 'fill')

    const grid = frameGrid(loadProjects()[0]!)
    expect(grid[0]![0]!.color).toBe('#e63746')
    expect(grid[0]![1]!.color).toBeNull()
    expect(grid[2]![2]!.color).toBe('#2f6fed')
    expect(grid[3]![3]!.color).toBe('#2f6fed')

    await pressBead(wrapper, { row: 2, column: 2 })
    await wrapper.find('[data-testid="project-surface"]').trigger('pointerup')
    expect(selectedCount(wrapper)).toBe(1)
  })

  it('stamps the copied block where it is clicked', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithMotif(wrapper)
    await drag(wrapper, [0, 1, 5])
    await copySelection(wrapper)

    await click(wrapper, 10) // (2,2)

    const grid = frameGrid(loadProjects()[0]!)
    expect(grid[2]![2]!.color).toBe('#e63746')
    expect(grid[3]![3]!.color).toBe('#2f6fed')
  })

  it('Clear selection empties a partial Selection at once, with no confirmation (ticket 415)', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithMotif(wrapper)
    await drag(wrapper, [0, 1])

    await pressBar(wrapper, 'clear')

    expect(wrapper.find('[data-testid="delete-all-modal"]').exists()).toBe(false)
    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBeNull()
    expect(frameGrid(loadProjects()[0]!)[1]![1]!.color).toBe('#2f6fed')
  })

  it('Select all then Clear selection asks before wiping the drawing (ticket 415)', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithMotif(wrapper)
    await selectAll(wrapper)

    await pressBar(wrapper, 'clear')

    expect(wrapper.find('[data-testid="delete-all-modal"]').exists()).toBe(true)
    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#e63746')
  })

  it('Select all then the Eraser asks before wiping the drawing too (ticket 415)', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithMotif(wrapper)
    await selectAll(wrapper)

    await pickTool(wrapper, 'erase')

    expect(wrapper.find('[data-testid="delete-all-modal"]').exists()).toBe(true)
    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#e63746')
  })

  it('Frame on the Selection bar moves the Frame to the Selection (ticket 407)', async () => {
    const wrapper = await mountWithProject(6, 6) // a 4x4 Frame
    await projectWithMotif(wrapper) // red (0,0) and blue (1,1): one Piece
    await pickTool(wrapper, 'piece')
    await click(wrapper, 5)

    await pressBar(wrapper, 'frame')
    await flushPromises()

    expect(loadProjects()[0]!.frame).toMatchObject({ row: 0, column: 0, rows: 2, columns: 2 })
  })

  it('Fill gives every position in the Selection the current colour (ticket 415)', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithMotif(wrapper)
    await drag(wrapper, [0, 1, 5])

    await pressBar(wrapper, 'fill')

    const grid = frameGrid(loadProjects()[0]!)
    expect(grid[0]![1]!.color).not.toBeNull()
    expect(grid[1]![0]!.color).not.toBeNull()
  })

  it('keeps the clipboard armed when a different Project is opened, but drops the Selection (ticket 92)', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithMotif(wrapper)
    const firstId = loadProjects()[0]!.id
    await drag(wrapper, [0, 1, 5])
    await copySelection(wrapper)

    await createProjectViaForm(wrapper)
    await pickTool(wrapper, 'select')
    const newProject = () => loadProjects().find((p) => p.id !== firstId)!

    // The clipboard survives the switch (ticket 92), so a click under Select still stamps the motif.
    // The new Project is a Canvas (ticket 342): the stamp lands at its first bead, with no Frame to count it in.
    await pressBead(wrapper, { row: 0, column: 0 })
    await wrapper.find('.app-shell').trigger('mouseup')
    expect(newProject().beads[0]?.[0]).toBe('#e63746')

    // A Selection does not (making one drops the clipboard, so the two are never held at once): its bar goes with it.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await pressBead(wrapper, { row: 0, column: 0 })
    await hoverBead(wrapper, { row: 1, column: 1 }, { buttons: 1 })
    await wrapper.find('.app-shell').trigger('mouseup')
    expect(wrapper.find('[data-testid="context-bar"]').exists()).toBe(true)
    await createProjectViaForm(wrapper)
    expect(wrapper.find('[data-testid="context-bar"]').exists()).toBe(false)
  })

  it('Ctrl/Cmd+V under another tool pastes at the pointer and turns paste mode back on under Select (tickets 92, 437)', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithMotif(wrapper)
    await drag(wrapper, [0])
    await copySelection(wrapper)
    await pickTool(wrapper, 'paint') // leaves paste mode
    await hoverBead(wrapper, 10) // (2,2)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true }))
    await flushPromises()

    expect(frameGrid(loadProjects()[0]!)[2]![2]!.color).toBe('#e63746')
    // Paste mode is on: its tile is lit, and a click stamps rather than starting a Selection.
    expect(wrapper.find('[data-testid="pill-tool-paste"]').attributes('aria-pressed')).toBe('true')
    await click(wrapper, 15) // (3,3)
    expect(frameGrid(loadProjects()[0]!)[3]![3]!.color).toBe('#e63746')
  })
})
