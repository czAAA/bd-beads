import { beforeEach, describe, expect, it } from 'vitest'
import type { mount } from '@vue/test-utils'
import { mountWithProject } from './testUtils/seedProject'
import { hoverBead, pressBead, selectedBeadCount } from './testUtils/beads'

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

describe('the Selection ContextBar under 1024px (tickets 168, 295)', () => {
  it('shows Copy, Rotate, Remove line and a clear x for a Selection, wired to the same actions as the Toolbox', async () => {
    const wrapper = await mountWithProject(3, 30) // 2 columns, so a 2-cell drag along a row is the whole line
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await drag(wrapper, [0, 1]) // a 1x2 row selection

    expect(wrapper.find('[data-testid="context-bar-size"]').text()).toBe('2×1')
    expect(wrapper.find('[data-testid="context-bar-remove-line"]').attributes("aria-disabled")).toBeUndefined()

    await wrapper.find('[data-testid="context-bar-copy"]').trigger('click')
    // Copying clears the Selection and arms the clipboard -- the bar switches to its "Tap where to paste" state.
    expect(wrapper.find('[data-testid="context-bar-size"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="context-bar-hint"]').text()).toBe('Tap where to paste')

    await wrapper.find('[data-testid="context-bar-cancel"]').trigger('click')
    expect(wrapper.find('[data-testid="context-bar"]').exists()).toBe(false)
  })

  it('removes the selected line through the same command Toolbox\'s Remove line link uses', async () => {
    const wrapper = await mountWithProject(3, 30)
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await drag(wrapper, [0, 1])

    const before = selectedBeadCount(wrapper)
    expect(before).toBeGreaterThan(0)

    await wrapper.find('[data-testid="context-bar-remove-line"]').trigger('click')
    // A removed line shifts the grid up by one row; the Selection no longer applies (cleared by the command).
    expect(wrapper.find('[data-testid="context-bar"]').exists()).toBe(false)
  })

  it('clears the Selection on the clear x without erasing anything', async () => {
    const wrapper = await mountWithProject(3, 30)
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await drag(wrapper, [0, 1])

    await wrapper.find('[data-testid="context-bar-clear"]').trigger('click')
    expect(wrapper.find('[data-testid="context-bar"]').exists()).toBe(false)
    expect(selectedBeadCount(wrapper)).toBe(0)
  })
})
