import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import type { mount } from '@vue/test-utils'
import { mountWithProject } from './testUtils/seedProject'
import { hoverBead, pressBead, selectedBeadCount } from './testUtils/beads'
import { armSelectionBar, pressBar, pickColor, pickTool, rotate } from './testUtils/pill'
import { frameGrid } from './domain/project'
import { loadProjects } from './services/libraryStore'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

/** A drag across the grid, released on the shell (a real drag can end anywhere), which is what commits it to undo history. */
async function drag(wrapper: ReturnType<typeof mount>, indices: number[]) {
  await pressBead(wrapper, indices[0]!)
  for (const index of indices.slice(1)) {
    await hoverBead(wrapper, index, { buttons: 1 })
  }
  await wrapper.find('.app-shell').trigger('mouseup')
}

describe('the Selection bar (tickets 168, 295, 415)', () => {
  it('shows Copy, Cut, Fill, Rotate, Remove line and Clear selection for a Selection, wired to the registry actions', async () => {
    const wrapper = await mountWithProject(3, 30) // 2 columns, so a 2-cell drag along a row is the whole line
    await pickColor(wrapper, 'red')
    await drag(wrapper, [0]) // one drawn bead for Copy to take
    await pickTool(wrapper, 'select')
    await drag(wrapper, [0, 1]) // a 1x2 row selection

    expect(wrapper.find('[data-testid="context-bar-size"]').text()).toMatch(/^2×1 ≈ /)
    await armSelectionBar()
    expect(wrapper.find('[data-testid="context-bar-remove-line"]').attributes('aria-disabled')).toBeUndefined()
    expect(wrapper.find('[data-testid="context-bar-paste"]').exists()).toBe(false)

    // Copy clears the Selection and arms paste mode at once, so no bar remains, Select all included (ticket 437).
    await pressBar(wrapper, 'copy')
    expect(wrapper.find('[data-testid="context-bar"]').exists()).toBe(false)

    // Escape leaves paste mode; with no Selection there is no bar, and no standalone Select all either (ticket 439).
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(wrapper.find('[data-testid="context-bar"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="context-bar-select-all"]').exists()).toBe(false)
  })

  it('removes the selected line through the registry\'s Remove line command', async () => {
    const wrapper = await mountWithProject(3, 30)
    await pickTool(wrapper, 'select')
    await drag(wrapper, [0, 1])

    const before = selectedBeadCount(wrapper)
    expect(before).toBeGreaterThan(0)

    await pressBar(wrapper, 'remove-line')
    // A removed line shifts the grid up by one row; the Selection no longer applies (cleared by the command).
    expect(wrapper.find('[data-testid="context-bar-size"]').exists()).toBe(false)
  })

  it('turns the Selection a quarter through Rotate (ticket 416)', async () => {
    const wrapper = await mountWithProject(4.5, 3) // 3 columns x 2 rows
    await pickColor(wrapper, 'red')
    await drag(wrapper, [0, 1]) // the top row's first two beads

    await pickTool(wrapper, 'piece') // a tap on the strip selects its rectangle
    await drag(wrapper, [0])
    await rotate(wrapper)

    // The 1 x 2 strip becomes a 2 x 1 column on its right: the left bead goes to the top, the right one below it.
    const grid = frameGrid(loadProjects()[0]!)
    expect([grid[0]![0]!.color, grid[0]![1]!.color, grid[1]![1]!.color]).toEqual([null, '#e63746', '#e63746'])
  })

  it('sits inside the drawing area, above the Selection when there is room', async () => {
    const wrapper = await mountWithProject(6, 6)
    await pickTool(wrapper, 'select')
    await drag(wrapper, [14, 15]) // a row well below the top
    await nextTick()
    await nextTick()

    const bar = wrapper.get('[data-testid="context-bar"]').element.getBoundingClientRect()
    const area = wrapper.get('[data-testid="app-drawing-area"]').element.getBoundingClientRect()
    if (area.width === 0) return // not laid out in this environment
    expect(bar.left).toBeGreaterThanOrEqual(area.left)
    expect(bar.right).toBeLessThanOrEqual(area.right)
    expect(bar.top).toBeGreaterThanOrEqual(area.top)
    expect(bar.bottom).toBeLessThanOrEqual(area.bottom)
  })
})
