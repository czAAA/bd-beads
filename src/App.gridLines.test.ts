import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import App from './App.vue'
import { beadColors, pressBead, pressRulerNumber, selectedBeadCount } from './testUtils/beads'
import { createProject, type Technique } from './domain/project'
import { loadProjects, saveProjects } from './services/libraryStore'
import { pickColor } from './testUtils/dock'

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

/** Mounts the App on a saved Loom/Peyote/Brick Project of Toho Cube 1.5mm beads with a Frame of `columns` x `rows` beads: the New Project form states no size (ticket 342). */
async function mountSized(columns: number, rows: number, technique: Technique = 'loom') {
  saveProjects([createProject({ technique, beadId: 'toho-cube-1.5mm', size: { width: columns, height: rows, unit: 'beads' } })])
  const wrapper = mount(App)
  await nextTick()
  return wrapper
}

async function paint(wrapper: ReturnType<typeof mount>, index: number, colorId = 'red') {
  await pickColor(wrapper, colorId)
  await pressBead(wrapper, index)
  await wrapper.find('.app-shell').trigger('mouseup')
}

const stored = () => loadProjects()[0]!

const removeLineButton = (wrapper: ReturnType<typeof mount>) =>
  wrapper.find<HTMLButtonElement>('[data-testid="context-bar-remove-line"]')
const undo = (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-testid="zoom-pill-undo"]').trigger('click')

describe('Ruler click selects a whole row/column (ticket 123)', () => {
  it('selects the whole row when a row ruler number is clicked', async () => {
    const wrapper = await mountSized(4, 5)

    await pressRulerNumber(wrapper, 'row', 1) // row 2 (index 1)

    expect(selectedBeadCount(wrapper)).toBe(4)
  })
})

describe('"Remove selected row/column" Tool (ticket 123)', () => {

  it('enables once a ruler click selects a whole row or column', async () => {
    const wrapper = await mountSized(4, 4)

    await pressRulerNumber(wrapper, 'row', 0)

    expect(removeLineButton(wrapper).attributes('aria-disabled')).toBeUndefined()
  })

  it('removes exactly the selected row, from any index, and shifts the rest up, as one undo step', async () => {
    const wrapper = await mountSized(3, 4)
    await paint(wrapper, 1) // (0,1)
    await paint(wrapper, 10, 'blue') // (3,1), below the row that's about to go

    await pressRulerNumber(wrapper, 'row', 1) // row 2 (index 1), a middle row, no beads on it
    await removeLineButton(wrapper).trigger('click')

    expect(stored().frame!.rows).toBe(3)
    expect(beadColors(wrapper)).toEqual([
      [null, RED, null],
      [null, null, null],
      [null, BLUE, null],
    ])

    await undo(wrapper)

    expect(stored().frame!.rows).toBe(4)
    expect(beadColors(wrapper)[3]![1]).toBe(BLUE)
  })
})
