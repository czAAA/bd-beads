import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { pickColor, pickTool } from './testUtils/pill'
import { hoverBead, leaveSurface, pressBead, previewedBeads, selectedBeadCount } from './testUtils/beads'
import { loadProjects } from './services/libraryStore'
import { mountWithProject } from './testUtils/seedProject'
import { frameGrid } from './testUtils/frameGrid'
import { rowProgressOf } from './domain/rowProgress'

// The App's wiring for keys and the canvas pointer, one test per key → flow (docs/testing.md). Guards and variants are
// in useAppShortcutTable, useSpaceDragPan, useCanvasPointer, usePaintStroke and ToolPill; Ctrl+Z is driven by App.frame,
// a digit by App.canvas, Shift+a digit by App.palette and Ctrl+V by App.selection.

beforeEach(() => {
  localStorage.clear()
})

/** Keydowns go to `window`, which every still-mounted App hears, so each test unmounts its App (a stray firing
 * breaks incremental asserts). */
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

/** Two red beads, and a Selection of the first and its empty neighbour: not the whole drawing, which Del asks about
 * first (ticket 415). */
async function selectPaintedBead(wrapper: ReturnType<typeof mount>) {
  await pickColor(wrapper, 'red')
  await click(wrapper, 0)
  await click(wrapper, 3)
  await pickTool(wrapper, 'select')
  await pressBead(wrapper, 0)
  await hoverBead(wrapper, 1, { buttons: 1 })
  await wrapper.trigger('mouseup')
}

const firstCellColor = () => frameGrid(loadProjects()[0]!)[0]![0]!.color

describe('App Progress bar', () => {
  it('is the last control in the page order bar the Selection bar\'s layer (ADR 0075)', async () => {
    const wrapper = await mountApp(15, 30)
    const layer = wrapper.find('[data-testid="selection-layer"]')
    expect(wrapper.find('[data-testid="app-canvas"]').element.lastElementChild).toBe(layer.element)
    expect(layer.element.previousElementSibling).toBe(wrapper.find('[data-testid="progress-bar"]').element)
  })
})

describe('App keyboard shortcuts', () => {
  it('Ctrl+Shift+Z brings back what Ctrl+Z undid', async () => {
    const wrapper = await mountApp(15, 30)
    await pickColor(wrapper, 'red')
    await click(wrapper, 0)

    await pressKey({ key: 'z', ctrlKey: true })
    await pressKey({ key: 'z', ctrlKey: true, shiftKey: true })

    expect(firstCellColor()).toBe('#e63746')
  })

  it('Del empties the Selection', async () => {
    const wrapper = await mountApp(6, 6)
    await selectPaintedBead(wrapper)

    await pressKey({ key: 'Delete' })

    expect(firstCellColor()).toBeNull()
  })

  it('Ctrl+C copies the Selection into paste mode, and the Paste tile and 7 enter it again (ticket 447)', async () => {
    const wrapper = await mountApp(6, 6)
    await selectPaintedBead(wrapper)

    await pressKey({ key: 'c', ctrlKey: true })
    await hoverBead(wrapper, 8)
    expect(previewedBeads(wrapper)).toHaveLength(1)

    await pressKey({ key: 'Escape' }) // leaves paste mode; the clipboard stays
    await wrapper.get('[data-testid="pill-tool-paste"]').trigger('click')
    await hoverBead(wrapper, 8)
    expect(previewedBeads(wrapper)).toHaveLength(1)

    await pressKey({ key: 'Escape' })
    await pressKey({ key: '7' })
    await hoverBead(wrapper, 8)
    expect(previewedBeads(wrapper)).toHaveLength(1)
    expect(frameGrid(loadProjects()[0]!).flat().filter((cell) => cell.color)).toHaveLength(2) // nothing stamped
  })

  it('Ctrl+X cuts the Selection into paste mode (ticket 447)', async () => {
    const wrapper = await mountApp(6, 6)
    await selectPaintedBead(wrapper)

    await pressKey({ key: 'x', ctrlKey: true })

    expect(firstCellColor()).toBeNull()
    await hoverBead(wrapper, 8)
    expect(previewedBeads(wrapper)).toHaveLength(1)
  })

  it('R shows and hides the rulers', async () => {
    const wrapper = await mountApp(15, 30)
    await pressKey({ key: 'r' })
    expect(wrapper.find('[data-testid="strip-rulers"]').attributes('aria-pressed')).toBe('false')
  })

  it('Enter moves to the next row and D turns the row direction, saved with the Project', async () => {
    await mountApp(15, 30)

    await pressKey({ key: 'Enter' })
    expect(rowProgressOf(loadProjects()[0]).currentRow).toBe(1)

    await pressKey({ key: 'd' })
    expect(rowProgressOf(loadProjects()[0]).direction).toBe('columns')
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
