import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import App from './App.vue'
import { drawnPattern, hoverBead, pressBead, selectedBeadCount } from './testUtils/beads'
import { createPattern, type Technique } from './domain/pattern'
import { loadPatterns, savePatterns } from './domain/patternStorage'
import { en } from './i18n/en'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
})

const RED = '#e63746'
const BLUE = '#2f6fed'

/** Creates a Pattern through the form, in beads (the default unit): columns x rows, on TOHO Cube 1.5mm. */
async function createInBeads(wrapper: ReturnType<typeof mount>, columns: number, rows: number, technique: Technique = 'loom') {
  await wrapper.find('[data-testid="bead-select"]').setValue('toho-cube-1.5mm')
  await wrapper.find('[data-testid="technique-select"]').setValue(technique)
  await wrapper.find('[data-testid="width-input"]').setValue(String(columns))
  await wrapper.find('[data-testid="height-input"]').setValue(String(rows))
  await wrapper.find('form').trigger('submit')
}

const stored = () => loadPatterns()[0]!
const colors = () => stored().grid.map((row) => row.map((cell) => cell.color))
const columnsInput = (wrapper: ReturnType<typeof mount>) => wrapper.find<HTMLInputElement>('[data-testid="size-columns-input"]')
const rowsInput = (wrapper: ReturnType<typeof mount>) => wrapper.find<HTMLInputElement>('[data-testid="size-rows-input"]')

/** Types into a Size input and commits it, the way blur or Enter does. */
async function enter(input: ReturnType<typeof columnsInput>, value: number) {
  input.element.value = String(value)
  await input.trigger('input')
  await input.trigger('change')
}

async function paint(wrapper: ReturnType<typeof mount>, index: number, colorId = 'red') {
  await wrapper.find(`[data-color-id="${colorId}"]`).trigger('click')
  await pressBead(wrapper, index)
  await wrapper.find('.app-shell').trigger('mouseup')
}

const undo = (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-testid="undo-button"]').trigger('click')
const redo = (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-testid="redo-button"]').trigger('click')
const canUndo = (wrapper: ReturnType<typeof mount>) => !wrapper.find<HTMLButtonElement>('[data-testid="undo-button"]').element.disabled

describe('App Size group (ticket 98)', () => {
  it('appears in the Toolbox while a Pattern is open, and not before', async () => {
    const wrapper = mount(App)
    expect(wrapper.find('[data-testid="tool-group-size"]').exists()).toBe(false)

    await createInBeads(wrapper, 22, 44)

    expect(wrapper.find('[data-testid="tool-group-size"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tool-group-size"] .tool-group__title').text()).toBe(en.toolbox.groups.size)
  })

  it('shows the open Pattern’s Estimated size', async () => {
    const wrapper = mount(App)

    await createInBeads(wrapper, 22, 44) // 33 x 66mm at 1.5mm

    expect(wrapper.find('[data-testid="size-estimate"]').text()).toBe('≈ 3.3 × 6.6 cm')
  })

  it('updates when the Pattern’s Bead is replaced', async () => {
    const wrapper = mount(App)
    await createInBeads(wrapper, 22, 44)

    await wrapper.find('[data-testid="replace-bead-select"]').setValue('toho-round-11-0')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    // 22 x 1.65mm = 36.3mm, 44 x 2.2mm = 96.8mm.
    expect(wrapper.find('[data-testid="size-estimate"]').text()).toBe('≈ 3.6 × 9.7 cm')
  })

  it('swaps width and height when the Pattern is rotated, like the grid summary', async () => {
    const wrapper = mount(App)
    await createInBeads(wrapper, 22, 44)

    await wrapper.find('[data-testid="rotate-button"]').trigger('click')

    expect(wrapper.find('[data-testid="size-estimate"]').text()).toBe('≈ 6.6 × 3.3 cm')
  })

  it('follows the app language for its unit label', async () => {
    const wrapper = mount(App)
    await createInBeads(wrapper, 22, 44)

    await wrapper.find('[data-testid="language-ru"]').trigger('click')

    expect(wrapper.find('[data-testid="size-estimate"]').text()).toBe('≈ 3.3 × 6.6 см')
  })
})

describe('App Resize (ticket 101)', () => {
  it('grows by adding empty columns at the right and rows at the bottom', async () => {
    const wrapper = mount(App)
    await createInBeads(wrapper, 3, 2)
    await paint(wrapper, 0)

    await enter(columnsInput(wrapper), 5)
    await enter(rowsInput(wrapper), 3)

    expect(stored().columns).toBe(5)
    expect(stored().rows).toBe(3)
    expect(colors()).toEqual([
      [RED, null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
    ])
    // The Pattern that is drawn is the resized one: 5 columns of 3 rows, all 15 beads.
    expect(drawnPattern(wrapper)).toMatchObject({ columns: 5, rows: 3 })
  })

  it('updates the Estimated size once it lands', async () => {
    const wrapper = mount(App)
    await createInBeads(wrapper, 22, 44)

    await enter(columnsInput(wrapper), 20)

    expect(wrapper.find('[data-testid="size-estimate"]').text()).toBe('≈ 3.0 × 6.6 cm')
  })

  it('shrinks by removing the last columns and rows along with the beads painted on them, with no confirmation', async () => {
    const wrapper = mount(App)
    await createInBeads(wrapper, 3, 3)
    await paint(wrapper, 0)
    await paint(wrapper, 8, 'blue') // (2,2)

    await enter(columnsInput(wrapper), 2)
    await enter(rowsInput(wrapper), 2)

    expect(wrapper.find('[data-testid="confirm-modal-backdrop"]').exists()).toBe(false)
    expect(colors()).toEqual([
      [RED, null],
      [null, null],
    ])
    expect(wrapper.find('[data-testid="quantity-count-blue"]').exists()).toBe(false)
  })

  it('is one undo step that brings the dropped beads and the old size back, and Redo re-applies it', async () => {
    const wrapper = mount(App)
    await createInBeads(wrapper, 3, 3)
    await paint(wrapper, 0)
    await paint(wrapper, 8, 'blue')
    const before = colors()

    await enter(columnsInput(wrapper), 2)
    await undo(wrapper)

    expect(stored().columns).toBe(3)
    expect(stored().rows).toBe(3)
    expect(colors()).toEqual(before)
    expect(colors()[2]![2]).toBe(BLUE)
    expect(columnsInput(wrapper).element.value).toBe('3')

    await redo(wrapper)

    expect(stored().columns).toBe(2)
    expect(colors()).toEqual([[RED, null], [null, null], [null, null]])
  })

  it('takes exactly one Undo per Resize, whichever direction it changed', async () => {
    const wrapper = mount(App)
    await createInBeads(wrapper, 3, 3)
    await enter(columnsInput(wrapper), 4)
    await enter(rowsInput(wrapper), 5)

    await undo(wrapper)
    expect(stored().rows).toBe(3)
    expect(stored().columns).toBe(4)

    await undo(wrapper)
    expect(stored().columns).toBe(3)
    expect(canUndo(wrapper)).toBe(false)
  })

  it('is not an undo step when it changes nothing', async () => {
    const wrapper = mount(App)
    await createInBeads(wrapper, 3, 3)

    await enter(columnsInput(wrapper), 3)

    expect(canUndo(wrapper)).toBe(false)
  })

  it('saves as it lands, so it survives a reload', async () => {
    const wrapper = mount(App)
    await createInBeads(wrapper, 3, 3)

    await enter(columnsInput(wrapper), 6)

    expect(stored().columns).toBe(6)
    expect(stored().grid[0]).toHaveLength(6)
  })

  it('clears the Selection, which may no longer fit', async () => {
    const wrapper = mount(App)
    await createInBeads(wrapper, 4, 4)
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await pressBead(wrapper, 0)
    await hoverBead(wrapper, 15, { buttons: 1 })
    await wrapper.find('.app-shell').trigger('mouseup')
    expect(selectedBeadCount(wrapper)).toBeGreaterThan(0)

    await enter(columnsInput(wrapper), 2)

    expect(selectedBeadCount(wrapper)).toBe(0)
  })

  it('resets Mirror axis counts, like any change to grid dimensions, and Undo brings them back', async () => {
    const wrapper = mount(App)
    await createInBeads(wrapper, 6, 6)
    await wrapper.find('[data-testid="mirror-left-right-increase"]').trigger('click')
    expect(wrapper.find('[data-testid="mirror-left-right-value"]').text()).toContain('1')

    await enter(columnsInput(wrapper), 8)

    expect(wrapper.find('[data-testid="mirror-left-right-value"]').text()).toContain('0')

    await undo(wrapper)

    expect(wrapper.find('[data-testid="mirror-left-right-value"]').text()).toContain('1')
  })

  it('keeps Mirror’s copy mode, which has nothing to do with the grid’s size', async () => {
    const wrapper = mount(App)
    await createInBeads(wrapper, 6, 6)
    await wrapper.find('[data-testid="mirror-copy-mode"]').trigger('click')

    await enter(columnsInput(wrapper), 8)

    expect(wrapper.find('[data-testid="mirror-copy-mode"]').attributes('aria-pressed')).toBe('true')
  })

  it('swaps the two inputs when the Pattern is rotated', async () => {
    const wrapper = mount(App)
    await createInBeads(wrapper, 4, 6)
    await wrapper.find('[data-testid="rotate-button"]').trigger('click')

    expect(columnsInput(wrapper).element.value).toBe('6')
    expect(rowsInput(wrapper).element.value).toBe('4')

    await enter(columnsInput(wrapper), 7) // horizontal on screen, so the grid's rows

    expect(stored().columns).toBe(4)
    expect(stored().rows).toBe(7)
  })

  it('refits the zoom to the new size while it is still at fit', async () => {
    const wrapper = mount(App)
    await createInBeads(wrapper, 40, 3)
    const level = () => wrapper.find('[data-testid="zoom-level"]').text()

    await enter(columnsInput(wrapper), 400)

    expect(level()).not.toBe('100%')
  })

  describe('no limit on size (ADR 0019)', () => {
    it('lets a Pattern grow past 10,000 cells, and undoes it', async () => {
      const wrapper = mount(App)
      await createInBeads(wrapper, 100, 100)

      await enter(rowsInput(wrapper), 101)

      expect(stored().rows).toBe(101)
      expect(wrapper.find('[data-testid="size-message"]').exists()).toBe(false)
      expect(canUndo(wrapper)).toBe(true)
    })

    it('opens a Pattern past the old limit, and lets it grow or shrink', async () => {
      const oversize = createPattern({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 101, height: 100, unit: 'beads' } })
      savePatterns([oversize])
      const wrapper = mount(App)

      expect(wrapper.find('[data-testid="size-controls"]').exists()).toBe(true)
      expect(columnsInput(wrapper).element.value).toBe('101')

      await enter(rowsInput(wrapper), 90)
      expect(stored().rows).toBe(90)
      expect(stored().columns).toBe(101)

      await enter(rowsInput(wrapper), 250)
      expect(stored().rows).toBe(250)
    })
  })

  describe('Row progress', () => {
    it('disables the Size inputs while it is on, with the reason on hover, and re-enables them when it is off', async () => {
      const wrapper = mount(App)
      await createInBeads(wrapper, 4, 4)
      expect(columnsInput(wrapper).element.disabled).toBe(false)

      await wrapper.find('[data-testid="row-progress-enabled"]').trigger('click')

      expect(columnsInput(wrapper).element.disabled).toBe(true)
      expect(rowsInput(wrapper).element.disabled).toBe(true)
      expect(wrapper.find('[data-testid="size-inputs"]').attributes('title')).toBe('Turn off Row progress to change the size')

      await wrapper.find('[data-testid="row-progress-enabled"]').trigger('click')

      expect(columnsInput(wrapper).element.disabled).toBe(false)
      expect(wrapper.find('[data-testid="size-inputs"]').attributes('title')).toBeUndefined()
    })

    it('does not resize through a stray change event either', async () => {
      const wrapper = mount(App)
      await createInBeads(wrapper, 4, 4)
      await wrapper.find('[data-testid="row-progress-enabled"]').trigger('click')

      await enter(columnsInput(wrapper), 2)

      expect(stored().columns).toBe(4)
    })

    it('is untouched by the Resize that happens before it is turned on: the pointer stays on a row that exists', async () => {
      const wrapper = mount(App)
      await createInBeads(wrapper, 4, 6)
      await wrapper.find('[data-testid="row-progress-enabled"]').trigger('click')
      for (let step = 0; step < 5; step += 1) {
        await wrapper.find('[data-testid="row-progress-next"]').trigger('click')
      }
      await wrapper.find('[data-testid="row-progress-enabled"]').trigger('click') // off, pointer on row 6
      expect(stored().rowProgress.currentRow).toBe(5)

      await enter(rowsInput(wrapper), 3)
      expect(stored().rowProgress.currentRow).toBe(2)

      await undo(wrapper)
      expect(stored().rowProgress.currentRow).toBe(5)
    })
  })

  describe('peyote and brick stitch', () => {
    it.each<Technique>(['peyote', 'brick'])('grow and shrink from the end without moving the design: %s', async (technique) => {
      const wrapper = mount(App)
      await createInBeads(wrapper, 3, 4, technique)
      await paint(wrapper, 0)

      await enter(rowsInput(wrapper), 7)
      await enter(columnsInput(wrapper), 5)

      expect(stored().technique).toBe(technique)
      // An end-anchored change never moves a row, so every row keeps its parity and with it its stagger.
      expect(drawnPattern(wrapper)).toMatchObject({ columns: 5, rows: 7 })
      expect(colors()[0]![0]).toBe(RED)
    })
  })
})

describe('App Resize from the start (ticket 102)', () => {
  const start = (wrapper: ReturnType<typeof mount>, direction: 'columns' | 'rows') =>
    wrapper.find(`[data-testid="size-${direction}-from-start"]`).trigger('click')

  it('adds columns at the left and slides the design right with them', async () => {
    const wrapper = mount(App)
    await createInBeads(wrapper, 3, 2)
    await paint(wrapper, 0)
    await start(wrapper, 'columns')

    await enter(columnsInput(wrapper), 5)

    expect(colors()).toEqual([
      [null, null, RED, null, null],
      [null, null, null, null, null],
    ])
  })

  it('adds rows on top and slides the design down with them', async () => {
    const wrapper = mount(App)
    await createInBeads(wrapper, 2, 2)
    await paint(wrapper, 0)
    await start(wrapper, 'rows')

    await enter(rowsInput(wrapper), 4)

    expect(colors()).toEqual([
      [null, null],
      [null, null],
      [RED, null],
      [null, null],
    ])
  })

  it('removes the leftmost columns and top-most rows with their beads, and shifts the rest back', async () => {
    const wrapper = mount(App)
    await createInBeads(wrapper, 3, 3)
    await paint(wrapper, 0) // (0,0), which goes
    await paint(wrapper, 8, 'blue') // (2,2), which stays and moves to (1,1)
    await start(wrapper, 'columns')
    await start(wrapper, 'rows')

    await enter(columnsInput(wrapper), 2)
    await enter(rowsInput(wrapper), 2)

    expect(colors()).toEqual([
      [null, null],
      [null, BLUE],
    ])
  })

  it('is one undo step that restores a start-anchored shrink in full', async () => {
    const wrapper = mount(App)
    await createInBeads(wrapper, 3, 3)
    await paint(wrapper, 0)
    await paint(wrapper, 8, 'blue')
    const before = colors()
    await start(wrapper, 'columns')

    await enter(columnsInput(wrapper), 1) // the two leftmost columns go, with the red bead
    expect(colors()).toEqual([[null], [null], [BLUE]])
    await undo(wrapper)

    expect(colors()).toEqual(before)
    expect(stored().columns).toBe(3)
    expect(stored().rows).toBe(3)

    await redo(wrapper)
    expect(stored().columns).toBe(1)
  })

  it('swaps directions with the rotated view: the horizontal choice follows the horizontal input', async () => {
    const wrapper = mount(App)
    await createInBeads(wrapper, 2, 3)
    await paint(wrapper, 0)
    await wrapper.find('[data-testid="rotate-button"]').trigger('click')
    await start(wrapper, 'columns') // horizontal on screen: the grid's rows

    await enter(columnsInput(wrapper), 5)

    expect(stored().columns).toBe(2)
    expect(colors()[2]![0]).toBe(RED) // two new rows on top pushed the design down two
  })

  describe.each<Technique>(['peyote', 'brick'])('on %s', (technique) => {
    it('moves rows from the start in steps of 2, stating why beside the input', async () => {
      const wrapper = mount(App)
      await createInBeads(wrapper, 3, 4, technique)
      await start(wrapper, 'rows')

      expect(rowsInput(wrapper).attributes('step')).toBe('2')
      expect(wrapper.find('[data-testid="size-pairs-hint"]').text()).toBe(en.size.pairsHint)
    })

    it('lands the design two rows down, in rows of the same parity, when growing from the start', async () => {
      const wrapper = mount(App)
      await createInBeads(wrapper, 3, 4, technique)
      await paint(wrapper, 0) // (0,0)
      await paint(wrapper, 4, 'blue') // (1,1)
      await start(wrapper, 'rows')

      await enter(rowsInput(wrapper), 6)

      expect(colors()[2]![0]).toBe(RED)
      expect(colors()[3]![1]).toBe(BLUE)
      expect(colors()[0]!.every((color) => color === null)).toBe(true)
    })

    it('refuses an odd change of rows from the start and leaves the Pattern alone', async () => {
      const wrapper = mount(App)
      await createInBeads(wrapper, 3, 4, technique)
      await paint(wrapper, 0)
      await start(wrapper, 'rows')

      await enter(rowsInput(wrapper), 5)

      expect(stored().rows).toBe(4)
      expect(colors()[0]![0]).toBe(RED)
      expect(rowsInput(wrapper).element.value).toBe('4')
    })

    it('leaves columns from the start unrestricted', async () => {
      const wrapper = mount(App)
      await createInBeads(wrapper, 3, 4, technique)
      await paint(wrapper, 0)
      await start(wrapper, 'columns')

      await enter(columnsInput(wrapper), 4)

      expect(colors()[0]![1]).toBe(RED)
    })
  })

  it('holds the same limits as growing from the end: the Row progress lock, the Selection clear', async () => {
    const wrapper = mount(App)
    await createInBeads(wrapper, 100, 100)
    await start(wrapper, 'columns')

    await enter(columnsInput(wrapper), 101)
    expect(stored().columns).toBe(101)

    await wrapper.find('[data-testid="row-progress-enabled"]').trigger('click')
    expect(wrapper.find<HTMLButtonElement>('[data-testid="size-columns-from-end"]').element.disabled).toBe(true)
  })
})
