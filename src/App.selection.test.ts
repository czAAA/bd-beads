import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { hoverBead, leaveSurface, pressBead, previewedBeads, selectedBeadCount } from './testUtils/beads'
import { frameGrid } from './domain/project'
import { loadProjects } from './services/libraryStore'
import { createProjectViaForm, mountWithProject } from './testUtils/seedProject'

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
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await click(wrapper, 0) // (0,0)
    await wrapper.find('[data-color-id="blue"]').trigger('click')
    await click(wrapper, 5) // (1,1)
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
  }

  it('offers Select alongside Paint and Fill, chosen the same way', async () => {
    const wrapper = await mountWithProject(15, 30)

    await wrapper.find('[data-testid="tool-select"]').trigger('click')

    expect(wrapper.find('[data-testid="tool-select"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[data-testid="tool-paint"]').attributes('aria-pressed')).toBe('false')
  })

  it('marks out a rectangle as the cursor is dragged, and keeps it after the drag ends', async () => {
    const wrapper = await mountWithProject(6, 6) // 4x4
    await wrapper.find('[data-testid="tool-select"]').trigger('click')

    await drag(wrapper, [0, 1, 5]) // (0,0) -> (1,1)

    expect(selectedCount(wrapper)).toBe(4)
  })

  it('leaves the grid alone while selecting: dragging under Select paints nothing', async () => {
    const wrapper = await mountWithProject(6, 6)
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.find('[data-testid="tool-select"]').trigger('click')

    await drag(wrapper, [0, 1, 5])

    expect(frameGrid(loadProjects()[0]!).flat().every((cell) => cell.color === null)).toBe(true)
    expect(wrapper.find<HTMLButtonElement>('[data-testid="undo-button"]').attributes('aria-disabled') === 'true').toBe(true)
  })

  it('replaces the previous selection when a new drag starts, leaving only one active', async () => {
    const wrapper = await mountWithProject(6, 6)
    await wrapper.find('[data-testid="tool-select"]').trigger('click')

    await drag(wrapper, [0, 1, 4, 5]) // a 2x2 rectangle
    expect(selectedCount(wrapper)).toBe(4)

    await drag(wrapper, [10, 11]) // (2,2) -> (2,3)

    expect(selectedCount(wrapper)).toBe(2)
  })

  it('enables Copy only once something is selected', async () => {
    const wrapper = await mountWithProject(6, 6)
    await wrapper.find('[data-testid="tool-select"]').trigger('click')

    expect(wrapper.find<HTMLButtonElement>('[data-testid="copy-button"]').attributes('aria-disabled') === 'true').toBe(true)

    await drag(wrapper, [0, 1])

    expect(wrapper.find<HTMLButtonElement>('[data-testid="copy-button"]').attributes('aria-disabled') === 'true').toBe(false)
  })

  it('previews the copied block in its own colors, following the cursor', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithMotif(wrapper)
    await drag(wrapper, [0, 1, 5]) // select the 2x2 holding both painted cells
    await wrapper.find('[data-testid="copy-button"]').trigger('click')

    await hoverBead(wrapper, 10) // hover (2,2)

    // The block's two painted cells, each in its own color; its two empty ones preview nothing.
    expect(previewedBeads(wrapper).map(({ color }) => color)).toEqual(['#e63746', '#2f6fed'])
  })

  it('stamps the copied block where it is clicked, as a single undo step', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithMotif(wrapper)
    await drag(wrapper, [0, 1, 5])
    await wrapper.find('[data-testid="copy-button"]').trigger('click')

    await click(wrapper, 10) // (2,2)

    const grid = frameGrid(loadProjects()[0]!)
    expect(grid[2]![2]!.color).toBe('#e63746')
    expect(grid[3]![3]!.color).toBe('#2f6fed')

    await wrapper.find('[data-testid="undo-button"]').trigger('click')

    expect(frameGrid(loadProjects()[0]!)[2]![2]!.color).toBeNull()
    expect(frameGrid(loadProjects()[0]!)[3]![3]!.color).toBeNull()
  })

  it('redoes a stamped paste as a single action', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithMotif(wrapper)
    await drag(wrapper, [0, 1, 5])
    await wrapper.find('[data-testid="copy-button"]').trigger('click')
    await click(wrapper, 10) // (2,2)
    await wrapper.find('[data-testid="undo-button"]').trigger('click')

    await wrapper.find('[data-testid="redo-button"]').trigger('click')

    const grid = frameGrid(loadProjects()[0]!)
    expect(grid[2]![2]!.color).toBe('#e63746')
    expect(grid[3]![3]!.color).toBe('#2f6fed')
  })

  it('leaves redo untouched: Select, Copy, and cancelling a Paste are not grid edits', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithMotif(wrapper)
    await drag(wrapper, [0, 1, 5])
    await wrapper.find('[data-testid="copy-button"]').trigger('click')
    await click(wrapper, 10) // (2,2), a real edit
    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    expect(wrapper.find<HTMLButtonElement>('[data-testid="redo-button"]').attributes('aria-disabled') === 'true').toBe(false)

    await drag(wrapper, [0, 1]) // a fresh Selection
    await wrapper.find('[data-testid="copy-button"]').trigger('click') // Copy
    await pressEscape(wrapper) // cancels the pending Paste

    expect(wrapper.find<HTMLButtonElement>('[data-testid="redo-button"]').attributes('aria-disabled') === 'true').toBe(false)
    await wrapper.find('[data-testid="redo-button"]').trigger('click')
    expect(frameGrid(loadProjects()[0]!)[2]![2]!.color).toBe('#e63746')
  })

  it('can stamp the same block again at another position without copying again', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithMotif(wrapper)
    await drag(wrapper, [0, 1, 5])
    await wrapper.find('[data-testid="copy-button"]').trigger('click')

    await click(wrapper, 8) // (2,0)
    await click(wrapper, 10) // (2,2)

    const grid = frameGrid(loadProjects()[0]!)
    expect(grid[2]![0]!.color).toBe('#e63746')
    expect(grid[2]![2]!.color).toBe('#e63746')
  })

  it('clips a stamp that runs off the edge instead of refusing it', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithMotif(wrapper)
    await drag(wrapper, [0, 1, 5])
    await wrapper.find('[data-testid="copy-button"]').trigger('click')

    await click(wrapper, 15) // (3,3), the last cell: only the block's own top-left corner fits

    expect(frameGrid(loadProjects()[0]!)[3]![3]!.color).toBe('#e63746')
  })

  it('leaves the destination untouched under the block’s empty cells', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithMotif(wrapper)
    await drag(wrapper, [0, 1, 5])
    await wrapper.find('[data-testid="copy-button"]').trigger('click')
    // Paint the destination green first, so the block's holes have something to spare.
    await wrapper.find('[data-testid="tool-paint"]').trigger('click')
    await wrapper.find('[data-color-id="green"]').trigger('click')
    await click(wrapper, 9) // (2,1) — lands under one of the block's empty cells
    await wrapper.find('[data-testid="tool-select"]').trigger('click')

    await click(wrapper, 8) // stamp at (2,0)

    expect(frameGrid(loadProjects()[0]!)[2]![1]!.color).toBe('#27ae60')
  })

  it('drops the clipboard when a new selection is drawn, so the next click selects rather than stamps', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithMotif(wrapper)
    await drag(wrapper, [0, 1, 5])
    await wrapper.find('[data-testid="copy-button"]').trigger('click')

    await drag(wrapper, [10, 11]) // a fresh selection replaces both it and the clipboard
    await click(wrapper, 8)

    expect(frameGrid(loadProjects()[0]!)[2]![0]!.color).toBeNull()
  })

  /** Escape is bound to the window, not to the canvas, so it is dispatched there rather than on an element. */
  async function pressEscape(wrapper: ReturnType<typeof mount>) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    return wrapper
  }

  async function copiedMotif(wrapper: ReturnType<typeof mount>) {
    await projectWithMotif(wrapper)
    await drag(wrapper, [0, 1, 5])
    await wrapper.find('[data-testid="copy-button"]').trigger('click')
  }

  it('drops the copied block on a right-click without reviving the selection, so the next click selects instead of stamping (ticket 49)', async () => {
    const wrapper = await mountWithProject(6, 6)
    await copiedMotif(wrapper)
    expect(selectedCount(wrapper)).toBe(0) // Copy already hid the marquee

    await pressBead(wrapper, 10, { button: 2 })

    expect(selectedCount(wrapper)).toBe(0)
    expect(wrapper.find<HTMLButtonElement>('[data-testid="copy-button"]').attributes('aria-disabled') === 'true').toBe(true)

    await click(wrapper, 10) // (2,2) — would have stamped the motif

    expect(frameGrid(loadProjects()[0]!)[2]![2]!.color).toBeNull()
    expect(selectedCount(wrapper)).toBe(1)
  })

  it('drops the copied block on Escape: no preview, no revived selection, and the next click selects instead of stamping (ticket 49)', async () => {
    const wrapper = await mountWithProject(6, 6)
    await copiedMotif(wrapper)
    expect(selectedCount(wrapper)).toBe(0) // Copy already hid the marquee
    await hoverBead(wrapper, 10)
    expect(previewedBeads(wrapper)).toHaveLength(2)

    await pressEscape(wrapper)

    expect(previewedBeads(wrapper)).toHaveLength(0)
    expect(selectedCount(wrapper)).toBe(0)
    expect(wrapper.find<HTMLButtonElement>('[data-testid="copy-button"]').attributes('aria-disabled') === 'true').toBe(true)

    await click(wrapper, 10)

    expect(frameGrid(loadProjects()[0]!)[2]![2]!.color).toBeNull()
    expect(selectedCount(wrapper)).toBe(1)
  })

  it('hides the Selection marquee immediately once Copy is clicked (ticket 49)', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithMotif(wrapper)
    await drag(wrapper, [0, 1, 5])
    expect(selectedCount(wrapper)).toBe(4)

    await wrapper.find('[data-testid="copy-button"]').trigger('click')

    expect(selectedCount(wrapper)).toBe(0)
    expect(wrapper.find<HTMLButtonElement>('[data-testid="copy-button"]').attributes('aria-disabled') === 'true').toBe(true)
  })

  it('still pastes normally after Copy hides the marquee, but needs a fresh drag to copy the same block again', async () => {
    const wrapper = await mountWithProject(6, 6)
    await copiedMotif(wrapper)

    // The clipboard stays armed even though nothing is highlighted, so the next click still pastes.
    await click(wrapper, 10)
    expect(frameGrid(loadProjects()[0]!)[2]![2]!.color).toBe('#e63746')

    // Nothing is left highlighted, so copying the same block again means dragging a new Selection over it first.
    expect(selectedCount(wrapper)).toBe(0)
    expect(wrapper.find<HTMLButtonElement>('[data-testid="copy-button"]').attributes('aria-disabled') === 'true').toBe(true)

    await drag(wrapper, [0, 1, 5]) // re-select the same motif, since copying it again needs a fresh drag
    await wrapper.find('[data-testid="copy-button"]').trigger('click')
    await click(wrapper, 8) // (2,0)

    expect(frameGrid(loadProjects()[0]!)[2]![0]!.color).toBe('#e63746')
  })

  it('clears a selection nothing has been copied from on Escape', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithMotif(wrapper)
    await drag(wrapper, [0, 1, 5])

    await pressEscape(wrapper)

    expect(selectedCount(wrapper)).toBe(0)
    expect(wrapper.find<HTMLButtonElement>('[data-testid="copy-button"]').attributes('aria-disabled') === 'true').toBe(true)
  })

  it('clears a selection nothing has been copied from on a right-click, without erasing anything', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithMotif(wrapper)
    await drag(wrapper, [0, 1, 5])

    await pressBead(wrapper, 0, { button: 2 }) // a painted cell

    expect(selectedCount(wrapper)).toBe(0)
    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#e63746')
  })

  it('still never erases under Select: a right-click cancels the paste rather than clearing a cell', async () => {
    const wrapper = await mountWithProject(6, 6)
    await copiedMotif(wrapper)

    await pressBead(wrapper, 0, { button: 2 }) // a painted cell

    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#e63746')
  })

  it('leaves the other tools alone: Escape is not a general-purpose cancel', async () => {
    const wrapper = await mountWithProject(6, 6)
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await click(wrapper, 0)

    await pressEscape(wrapper)

    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#e63746')
    expect(wrapper.find<HTMLButtonElement>('[data-testid="undo-button"]').attributes('aria-disabled') === 'true').toBe(false)
  })

  it.each(['tool-paint', 'tool-fill'])('forgets the selected area when the tool changes to %s', async (tool) => {
    const wrapper = await mountWithProject(6, 6)
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await drag(wrapper, [0, 1, 4, 5])
    expect(selectedCount(wrapper)).toBe(4)

    await wrapper.find(`[data-testid="${tool}"]`).trigger('click')

    expect(selectedCount(wrapper)).toBe(0)
  })

  it('forgets the copied block too, so returning to Select does not stamp out of nowhere', async () => {
    const wrapper = await mountWithProject(6, 6)
    await copiedMotif(wrapper)

    await wrapper.find('[data-testid="tool-paint"]').trigger('click')
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await click(wrapper, 10) // (2,2)

    expect(frameGrid(loadProjects()[0]!)[2]![2]!.color).toBeNull()
    expect(selectedCount(wrapper)).toBe(1) // a fresh selection, not a stamp
    expect(wrapper.find<HTMLButtonElement>('[data-testid="copy-button"]').attributes('aria-disabled') === 'true').toBe(false)
  })

  it('keeps the selection when Select is re-chosen while already active', async () => {
    const wrapper = await mountWithProject(6, 6)
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await drag(wrapper, [0, 1, 4, 5])

    await wrapper.find('[data-testid="tool-select"]').trigger('click')

    expect(selectedCount(wrapper)).toBe(4)
  })

  it('resets the Selection, but keeps the clipboard armed, when a different Project is opened (ticket 92)', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithMotif(wrapper)
    const firstId = loadProjects()[0]!.id
    await drag(wrapper, [0, 1, 5])
    await wrapper.find('[data-testid="copy-button"]').trigger('click')

    await wrapper.find('[data-testid="new-project-button"]').trigger('click')
    await createProjectViaForm(wrapper, '6', '6')
    await wrapper.find('[data-testid="tool-select"]').trigger('click')

    // The Selection itself still resets on a Project switch, same as before ticket 92.
    expect(selectedCount(wrapper)).toBe(0)
    expect(wrapper.find<HTMLButtonElement>('[data-testid="copy-button"]').attributes('aria-disabled') === 'true').toBe(true)

    // But the clipboard survives the switch (ticket 92), so a click under Select still stamps the motif.
    await click(wrapper, 0)
    expect(frameGrid(loadProjects().find((p) => p.id !== firstId)!)[0]![0]!.color).toBe('#e63746')
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
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await click(wrapper, 0) // (0,0)
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await drag(wrapper, [0])
    await wrapper.find('[data-testid="copy-button"]').trigger('click')
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

  it('is a no-op when the pointer is not over the grid', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithCopiedCell(wrapper)
    await hoverCell(wrapper, 10)
    await leaveSurface(wrapper)

    pasteAtHoveredCell()
    await flushPromises()

    expect(frameGrid(loadProjects()[0]!)[2]![2]!.color).toBeNull()
  })

  it.each(['tool-paint', 'tool-fill'])('pastes via Ctrl/Cmd+V while %s is the active tool', async (tool) => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithCopiedCell(wrapper)
    await wrapper.find(`[data-testid="${tool}"]`).trigger('click')
    await hoverCell(wrapper, 10)

    pasteAtHoveredCell()
    await flushPromises()

    expect(frameGrid(loadProjects()[0]!)[2]![2]!.color).toBe('#e63746')
  })

  it('keeps the clipboard armed after switching tools away from Select and back, for keyboard paste (ticket 92)', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithCopiedCell(wrapper)

    await wrapper.find('[data-testid="tool-fill"]').trigger('click')
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await hoverCell(wrapper, 10)

    pasteAtHoveredCell()
    await flushPromises()

    expect(frameGrid(loadProjects()[0]!)[2]![2]!.color).toBe('#e63746')
  })

  it('hides the live preview after switching away from Select, even though Ctrl/Cmd+V can still paste', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithCopiedCell(wrapper)

    await wrapper.find('[data-testid="tool-fill"]').trigger('click')
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await hoverCell(wrapper, 10)

    expect(previewedBeads(wrapper)).toHaveLength(0)
  })

  it('does not revive the click-to-stamp gesture after switching back to Select: a click marks out a Selection instead', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithCopiedCell(wrapper)

    await wrapper.find('[data-testid="tool-fill"]').trigger('click')
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await click(wrapper, 10)

    expect(frameGrid(loadProjects()[0]!)[2]![2]!.color).toBeNull()
    expect(selectedBeadCount(wrapper)).toBe(1)
  })

  it('can still paste via Ctrl/Cmd+V after Escape dismisses the projection', async () => {
    const wrapper = await mountWithProject(6, 6)
    await projectWithCopiedCell(wrapper)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    await hoverCell(wrapper, 10)

    pasteAtHoveredCell()
    await flushPromises()

    expect(frameGrid(loadProjects()[0]!)[2]![2]!.color).toBe('#e63746')
  })
})

describe('App Tool group Escape precedence (ticket 41)', () => {
  function selectedCount(wrapper: ReturnType<typeof mount>) {
    return selectedBeadCount(wrapper)
  }

  async function createProjectWithSelection(wrapper: ReturnType<typeof mount>) {
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await pressBead(wrapper, 0)
    await hoverBead(wrapper, 1, { buttons: 1 })
    await hoverBead(wrapper, 5, { buttons: 1 })
    await wrapper.find('.app-shell').trigger('mouseup')
  }

  /*
   * No real Tool group exceeds 14 controls yet (ToolGroup.test.ts covers the expand/collapse mechanics itself with
   * a synthetic one that does), so this stands in for "some Tool group is currently hover-expanded" by making the
   * mounted Toolbox's own exposed collapseExpandedGroup — the exact function the app's shortcut table calls — report
   * one was, for exactly one call. It's proving the wiring: Escape asks Toolbox first, and only backs out of Select
   * once that reports nothing was expanded.
   */
  function stubOneExpandedGroup(wrapper: ReturnType<typeof mount>) {
    // The exposed object itself, which is what the app holds on to: a spy on the test wrapper's own proxy would not reach it.
    const exposed = wrapper.findComponent({ name: 'Toolbox' }).vm.$.exposed as { collapseExpandedGroup: () => boolean }
    vi.spyOn(exposed, 'collapseExpandedGroup').mockReturnValueOnce(true)
  }

  it('lets an expanded Tool group swallow the first Escape, leaving the Selection untouched', async () => {
    const wrapper = await mountWithProject(6, 6)
    await createProjectWithSelection(wrapper)
    expect(selectedCount(wrapper)).toBe(4)

    stubOneExpandedGroup(wrapper)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()

    expect(selectedCount(wrapper)).toBe(4)
  })

  it('reaches Select as usual on the Escape after that, once no group reports being expanded', async () => {
    const wrapper = await mountWithProject(6, 6)
    await createProjectWithSelection(wrapper)

    stubOneExpandedGroup(wrapper)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) // swallowed by the (stubbed) expanded group
    await flushPromises()
    expect(selectedCount(wrapper)).toBe(4)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) // no group expanded now — clears the Selection
    await flushPromises()

    expect(selectedCount(wrapper)).toBe(0)
  })
})
