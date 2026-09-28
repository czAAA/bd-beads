import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import App from './App.vue'
import { beadColors, drawnPattern, pressBead, selectedBeadCount } from './testUtils/beads'
import type { Technique } from './domain/pattern'
import { loadPatterns } from './domain/patternStorage'

/**
 * The ruler-click Selection and "remove selected row/column" Tool (ticket 123): clicking a ruler number selects
 * that whole row/column exactly like a Select-tool drag would, and the new Tool removes it, shifting the rest of
 * the grid to close the gap, in one undo step.
 */

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
})

const RED = '#e63746'
const BLUE = '#2f6fed'

async function createInBeads(wrapper: ReturnType<typeof mount>, columns: number, rows: number, technique: Technique = 'loom') {
  await wrapper.find('[data-testid="bead-select"]').setValue('toho-cube-1.5mm')
  await wrapper.find(`[data-testid="technique-select"] [data-value="${technique}"]`).trigger('click')
  await wrapper.find('[data-testid="width-input"]').setValue(String(columns))
  await wrapper.find('[data-testid="height-input"]').setValue(String(rows))
  await wrapper.find('form').trigger('submit')
}

async function paint(wrapper: ReturnType<typeof mount>, index: number, colorId = 'red') {
  await wrapper.find(`[data-color-id="${colorId}"]`).trigger('click')
  await pressBead(wrapper, index)
  await wrapper.find('.app-shell').trigger('mouseup')
}

const stored = () => loadPatterns()[0]!

/** Every ruler-label button in one of the four gutters, in index order (1st = row/column 1). */
function rulerLabels(wrapper: ReturnType<typeof mount>, axis: 'row' | 'column', edge: 'start' | 'end' = 'start') {
  return wrapper.findAll(`[data-testid="pattern-ruler-${axis}-${edge}"] [data-testid="ruler-label"]`)
}

const removeLineButton = (wrapper: ReturnType<typeof mount>) =>
  wrapper.find<HTMLButtonElement>('[data-testid="tool-remove-line"]')
const undo = (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-testid="undo-button"]').trigger('click')

describe('Ruler click selects a whole row/column (ticket 123)', () => {
  it('selects the whole row when a row ruler number is clicked', async () => {
    const wrapper = mount(App)
    await createInBeads(wrapper, 4, 5)

    await rulerLabels(wrapper, 'row')[1]!.trigger('click') // row 2 (index 1)

    expect(selectedBeadCount(wrapper)).toBe(4)
  })

  it('selects the whole column when a column ruler number is clicked', async () => {
    const wrapper = mount(App)
    await createInBeads(wrapper, 4, 5)

    await rulerLabels(wrapper, 'column')[2]!.trigger('click') // column 3

    expect(selectedBeadCount(wrapper)).toBe(5)
  })

  it('works the same from either edge gutter (start or end)', async () => {
    const wrapper = mount(App)
    await createInBeads(wrapper, 4, 5)

    await rulerLabels(wrapper, 'row', 'end')[0]!.trigger('click')

    expect(selectedBeadCount(wrapper)).toBe(4)
  })

  it('works regardless of which tool is active — not just under Select', async () => {
    const wrapper = mount(App)
    await createInBeads(wrapper, 4, 5)
    // Paint is the default active tool; a ruler click still marks a Selection.

    await rulerLabels(wrapper, 'row')[0]!.trigger('click')

    expect(selectedBeadCount(wrapper)).toBe(4)
  })

  it('replaces whatever was copied, the same as a new drag-marked Selection does', async () => {
    const wrapper = mount(App)
    await createInBeads(wrapper, 4, 4)
    await paint(wrapper, 0)
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.find('.app-shell').trigger('mouseup')
    await wrapper.find('[data-testid="copy-button"]').trigger('click')
    expect(wrapper.find<HTMLButtonElement>('[data-testid="copy-button"]').element.disabled).toBe(true)

    await rulerLabels(wrapper, 'row')[1]!.trigger('click')

    // The new Selection re-enables Copy (a fresh block to copy) rather than leaving the old clipboard armed.
    expect(wrapper.find<HTMLButtonElement>('[data-testid="copy-button"]').element.disabled).toBe(false)
  })
})

describe('"Remove selected row/column" Tool (ticket 123)', () => {
  it('is disabled with no Selection, or one that is not a whole row/column', async () => {
    const wrapper = mount(App)
    await createInBeads(wrapper, 4, 4)
    expect(removeLineButton(wrapper).element.disabled).toBe(true)

    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await pressBead(wrapper, 0) // a single-cell Selection, not a whole row/column
    await wrapper.find('.app-shell').trigger('mouseup')

    expect(removeLineButton(wrapper).element.disabled).toBe(true)
  })

  it('enables once a ruler click selects a whole row or column', async () => {
    const wrapper = mount(App)
    await createInBeads(wrapper, 4, 4)

    await rulerLabels(wrapper, 'row')[0]!.trigger('click')

    expect(removeLineButton(wrapper).element.disabled).toBe(false)
  })

  it('removes exactly the selected row, from any index, and shifts the rest up, as one undo step', async () => {
    const wrapper = mount(App)
    await createInBeads(wrapper, 3, 4)
    await paint(wrapper, 1) // (0,1)
    await paint(wrapper, 10, 'blue') // (3,1), below the row that's about to go

    await rulerLabels(wrapper, 'row')[1]!.trigger('click') // row 2 (index 1), a middle row, no beads on it
    await removeLineButton(wrapper).trigger('click')

    expect(stored().rows).toBe(3)
    expect(beadColors(wrapper)).toEqual([
      [null, RED, null],
      [null, null, null],
      [null, BLUE, null],
    ])

    await undo(wrapper)

    expect(stored().rows).toBe(4)
    expect(beadColors(wrapper)[3]![1]).toBe(BLUE)
  })

  it('removes exactly the selected column the same way', async () => {
    const wrapper = mount(App)
    await createInBeads(wrapper, 4, 2)
    await paint(wrapper, 0) // (0,0)
    await paint(wrapper, 7, 'blue') // (1,3)

    await rulerLabels(wrapper, 'column')[1]!.trigger('click') // column 2 (index 1)
    await removeLineButton(wrapper).trigger('click')

    expect(stored().columns).toBe(3)
    expect(beadColors(wrapper)).toEqual([
      [RED, null, null],
      [null, null, BLUE],
    ])
  })

  it('clears the Selection once it lands, same as Resize', async () => {
    const wrapper = mount(App)
    await createInBeads(wrapper, 4, 4)
    await rulerLabels(wrapper, 'row')[0]!.trigger('click')

    await removeLineButton(wrapper).trigger('click')

    expect(selectedBeadCount(wrapper)).toBe(0)
  })

  it('is refused while Row progress is on, same as Resize', async () => {
    const wrapper = mount(App)
    await createInBeads(wrapper, 4, 4)
    await rulerLabels(wrapper, 'row')[0]!.trigger('click')
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')

    expect(removeLineButton(wrapper).element.disabled).toBe(true)

    // Even a stray click changes nothing: removeSelectedLine itself refuses under the lock.
    await removeLineButton(wrapper).trigger('click')
    expect(stored().rows).toBe(4)
  })

  it('is drawn as the resized grid', async () => {
    const wrapper = mount(App)
    await createInBeads(wrapper, 3, 4)
    await rulerLabels(wrapper, 'row')[0]!.trigger('click')

    await removeLineButton(wrapper).trigger('click')

    expect(drawnPattern(wrapper)).toMatchObject({ columns: 3, rows: 3 })
  })
})
