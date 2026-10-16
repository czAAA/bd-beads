import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { pickColor, pickTool, toolState } from './testUtils/dock'
import { hoverBead, leaveSurface, pressBead, previewedBeads, selectedBeadCount } from './testUtils/beads'
import { frameGrid } from './domain/project'
import { loadProjects } from './services/libraryStore'
import { mountWithProject } from './testUtils/seedProject'

/*
 * The App's wiring for keys and the controls beside them: one happy path per group, proving the control or key
 * reaches its action and the result lands in the screen or storage (docs/testing.md, "Where a test goes"). The key
 * table, its guards (typing, open dialogs, focused buttons), Row progress, the Toolbox's labels and the Progress
 * bar live in their own tests: useAppShortcutTable, ProgressBar, Toolbox, usePaintStroke, useSelectionGesture.
 */

beforeEach(() => {
  localStorage.clear()
})

/**
 * Keydowns go to `window`, which every still-mounted App in this file hears, so each test unmounts its App (a
 * stray extra firing would break the tests that assert an incremental state).
 */
const mounted: ReturnType<typeof mount>[] = []
async function mountApp(widthMm: number, heightMm: number) {
  const wrapper = await mountWithProject(widthMm, heightMm)
  mounted.push(wrapper)
  return wrapper
}
afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
})

async function pressKey(init: KeyboardEventInit) {
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }))
  await flushPromises()
}

async function click(wrapper: ReturnType<typeof mount>, index: number) {
  await pressBead(wrapper, index)
  await wrapper.trigger('mouseup')
}

const firstCellColor = () => frameGrid(loadProjects()[0]!)[0]![0]!.color

describe('App Progress bar', () => {
  it('has Row progress on with the Project\'s Frame, and Row done moves the pointer, saved with the Project (ticket 426)', async () => {
    const wrapper = await mountApp(15, 30)
    const bar = wrapper.find('[data-testid="progress-bar"]')
    expect(wrapper.find('[data-testid="app-canvas"]').element.lastElementChild).toBe(bar.element)

    expect(wrapper.find('[data-testid="progress-bar-switch"]').exists()).toBe(false)
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

    expect(loadProjects()[0]!.rowProgress).toMatchObject({ currentRow: 1 })
  })
})

describe('App keyboard shortcuts', () => {
  it('Ctrl+Z undoes a painted bead and Ctrl+Shift+Z brings it back', async () => {
    const wrapper = await mountApp(15, 30)
    await pickColor(wrapper, 'red')
    await click(wrapper, 0)

    await pressKey({ key: 'z', ctrlKey: true })
    expect(firstCellColor()).toBeNull()

    await pressKey({ key: 'z', ctrlKey: true, shiftKey: true })
    expect(firstCellColor()).toBe('#e63746')
  })

  it('a digit picks its tool, as clicking it does, even with a Selection active', async () => {
    const wrapper = await mountApp(6, 6)
    await pickTool(wrapper, 'select')
    await pressBead(wrapper, 0)
    await hoverBead(wrapper, 1, { buttons: 1 })
    await wrapper.trigger('mouseup')

    await pressKey({ key: '2' })

    expect(toolState(wrapper, 'fill').pressed).toBe(true)
  })

  it('Escape switches Fill back to Paint', async () => {
    const wrapper = await mountApp(15, 30)
    await pickTool(wrapper, 'fill')

    await pressKey({ key: 'Escape' })

    expect(toolState(wrapper, 'paint').pressed).toBe(true)
  })

  it('Shift+a color key switches to Paint and paints with that Palette color', async () => {
    const wrapper = await mountApp(15, 30)
    await pickTool(wrapper, 'select')

    await pressKey({ code: 'Digit2', shiftKey: true })
    await click(wrapper, 0)

    expect(toolState(wrapper, 'paint').pressed).toBe(true)
    expect(firstCellColor()).not.toBeNull()
    expect(firstCellColor()).not.toBe('#e63746') // not the default red
  })

  it('Del empties the Selection as one undo step, keeping it and staying on Select', async () => {
    const wrapper = await mountApp(6, 6)
    await pickColor(wrapper, 'red')
    for (let index = 0; index < 16; index++) await click(wrapper, index)
    await pickTool(wrapper, 'select')
    await pressBead(wrapper, 0)
    await hoverBead(wrapper, 5, { buttons: 1 })
    await wrapper.trigger('mouseup')

    await pressKey({ key: 'Delete' })

    expect(firstCellColor()).toBeNull()
    expect(selectedBeadCount(wrapper)).toBe(4)
    await wrapper.find('[data-testid="strip-undo"]').trigger('click')
    expect(firstCellColor()).toBe('#e63746')
  })

  it('Ctrl+C copies the Selection, as the Copy button does', async () => {
    const wrapper = await mountApp(6, 6)
    await pickColor(wrapper, 'red')
    await click(wrapper, 0) // one drawn bead for Copy to take
    await pickTool(wrapper, 'select')
    await pressBead(wrapper, 0)
    await hoverBead(wrapper, 1, { buttons: 1 })
    await wrapper.trigger('mouseup')

    await pressKey({ key: 'c', ctrlKey: true })

    expect(selectedBeadCount(wrapper)).toBe(0) // Copy clears the Selection and arms paste mode (ticket 437)
    expect(wrapper.find('[data-testid="context-bar"]').exists()).toBe(false)
  })

  it('Ctrl+X cuts the Selection: copies it, empties it and keeps it (ticket 415)', async () => {
    const wrapper = await mountApp(6, 6)
    await pickTool(wrapper, 'select')
    await pressBead(wrapper, 0)
    await hoverBead(wrapper, 1, { buttons: 1 })
    await wrapper.trigger('mouseup')

    await pressKey({ key: 'x', ctrlKey: true })

    expect(selectedBeadCount(wrapper)).toBeGreaterThan(0)
  })

  it('R shows and hides the rulers, and the choice is kept on the device', async () => {
    const wrapper = await mountApp(15, 30)

    await pressKey({ key: 'r' })

    expect(wrapper.find('[data-testid="strip-rulers"]').attributes('aria-pressed')).toBe('false')
    expect(localStorage.getItem('openbeads:rulers')).toBe('off')
  })

  it('Enter moves to the next row, and Shift+Enter to the previous', async () => {
    await mountApp(15, 30)

    await pressKey({ key: 'Enter' })
    expect(loadProjects()[0]!.rowProgress.currentRow).toBe(1)

    await pressKey({ key: 'Enter', shiftKey: true })
    expect(loadProjects()[0]!.rowProgress.currentRow).toBe(0)
  })

  it('D turns the row direction and P does nothing (ticket 426)', async () => {
    await mountApp(15, 30)

    await pressKey({ key: 'p' })
    expect(loadProjects()[0]!.rowProgress.direction).toBe('rows')
    await pressKey({ key: 'd' })

    expect(loadProjects()[0]!.rowProgress.direction).toBe('columns')
  })

  it('Space held stops painting and shows the grab cursor', async () => {
    const wrapper = await mountApp(15, 30)
    await pickColor(wrapper, 'red')

    await pressKey({ key: ' ', code: 'Space', cancelable: true })
    await click(wrapper, 0)

    expect(wrapper.find('[data-testid="app-canvas"]').classes()).toContain('app-shell__canvas--pan')
    expect(firstCellColor()).toBeNull()
  })

  it('? opens the shortcuts help and Escape closes it without backing out of Select', async () => {
    const wrapper = await mountApp(6, 6)
    await pickTool(wrapper, 'select')
    await pressBead(wrapper, 0)
    await hoverBead(wrapper, 1, { buttons: 1 })
    await wrapper.trigger('mouseup')

    await pressKey({ key: '?' })
    expect(wrapper.find('[data-testid="shortcuts-help-dialog"]').exists()).toBe(true)

    await pressKey({ key: 'Escape' })
    expect(wrapper.find('[data-testid="shortcuts-help-dialog"]').exists()).toBe(false)
    expect(selectedBeadCount(wrapper)).toBe(2)
  })
})

describe('App Eraser tool', () => {
  it('erases just the pressed bead, not its same-color neighbours, as one undo step', async () => {
    const wrapper = await mountApp(3, 3) // 2x2
    await pickColor(wrapper, 'red')
    for (let index = 0; index < 4; index++) await click(wrapper, index)
    await pickTool(wrapper, 'erase')

    await click(wrapper, 0)

    const grid = frameGrid(loadProjects()[0]!)
    expect([grid[0]![0]!.color, grid[0]![1]!.color]).toEqual([null, '#e63746'])
    await wrapper.find('[data-testid="strip-undo"]').trigger('click')
    expect(frameGrid(loadProjects()[0]!).flat().every((cell) => cell.color === '#e63746')).toBe(true)
  })
})

describe('App picking a color', () => {
  it('while Fill is active keeps Fill, and the next press floods with the new color', async () => {
    const wrapper = await mountApp(15, 30)
    await pickColor(wrapper, 'red')
    await pressBead(wrapper, 0)
    await pressBead(wrapper, 1)
    await wrapper.trigger('mouseup')
    await pickTool(wrapper, 'fill')

    await pickColor(wrapper, 'blue')
    await click(wrapper, 0)

    const row = frameGrid(loadProjects()[0]!)[0]!
    expect([row[0]!.color, row[1]!.color]).toEqual(['#2f6fed', '#2f6fed'])
  })
})

describe('App hover preview', () => {
  it('shows a faint preview of the selected color at the hovered cell, clearing on mouse leave', async () => {
    const wrapper = await mountApp(15, 30)
    await pickColor(wrapper, 'red')

    await hoverBead(wrapper, 5)
    expect(previewedBeads(wrapper)).toEqual([{ row: 0, column: 5, color: '#e63746' }])

    await leaveSurface(wrapper)
    expect(previewedBeads(wrapper)).toEqual([])
  })
})
