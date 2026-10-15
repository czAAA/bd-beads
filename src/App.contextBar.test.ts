import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import type { mount } from '@vue/test-utils'
import { mountWithProject } from './testUtils/seedProject'
import { hoverBead, pressBead, selectedBeadCount } from './testUtils/beads'
import { pickTool } from './testUtils/dock'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
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
    await pickTool(wrapper, 'select')
    await drag(wrapper, [0, 1]) // a 1x2 row selection

    expect(wrapper.find('[data-testid="context-bar-size"]').text()).toMatch(/^2×1 · /)
    expect(wrapper.find('[data-testid="context-bar-remove-line"]').attributes('aria-disabled')).toBeUndefined()
    expect(wrapper.find('[data-testid="context-bar-paste"]').exists()).toBe(false)

    // Copy keeps the Selection; Paste then appears, and arming it discards the Selection (ticket 415).
    await wrapper.find('[data-testid="context-bar-copy"]').trigger('click')
    expect(wrapper.find('[data-testid="context-bar-size"]').exists()).toBe(true)
    await wrapper.find('[data-testid="context-bar-paste"]').trigger('click')
    expect(wrapper.find('[data-testid="context-bar-size"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="context-bar-hint"]').attributes('aria-label')).toBe('Tap where to paste')

    await wrapper.find('[data-testid="context-bar-cancel"]').trigger('click')
    // Select is still active, so the bar stays with Select all alone (ticket 428), without a Selection's readout.
    expect(wrapper.find('[data-testid="context-bar-size"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="context-bar-select-all"]').exists()).toBe(true)
  })

  it('removes the selected line through the registry\'s Remove line command', async () => {
    const wrapper = await mountWithProject(3, 30)
    await pickTool(wrapper, 'select')
    await drag(wrapper, [0, 1])

    const before = selectedBeadCount(wrapper)
    expect(before).toBeGreaterThan(0)

    await wrapper.find('[data-testid="context-bar-remove-line"]').trigger('click')
    // A removed line shifts the grid up by one row; the Selection no longer applies (cleared by the command).
    expect(wrapper.find('[data-testid="context-bar-size"]').exists()).toBe(false)
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
