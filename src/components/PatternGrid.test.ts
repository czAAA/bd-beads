import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PatternGrid from './PatternGrid.vue'
import {
  createPattern,
  moveToRow,
  setRowProgressEnabled,
  type Pattern,
} from '../domain/pattern'
import { BEAD_CATALOG } from '../domain/beads'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

describe('PatternGrid', () => {
  it('renders one row per pattern row and one cell per pattern column', () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    const wrapper = mount(PatternGrid, { props: { pattern } })

    const rows = wrapper.findAll('[data-testid="grid-row"]')
    expect(rows).toHaveLength(pattern.rows)
    expect(rows[0]!.findAll('[data-testid="grid-cell"]')).toHaveLength(pattern.columns)
  })

  it('does not offset loom rows', () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    const wrapper = mount(PatternGrid, { props: { pattern } })
    const rows = wrapper.findAll('[data-testid="grid-row"]')

    expect(rows[0]!.attributes('style')).toContain('margin-left: 0px')
    expect(rows[1]!.attributes('style')).toContain('margin-left: 0px')
  })

  it('offsets alternating Peyote rows by half a cell', () => {
    const pattern = createPattern({
      technique: 'peyote',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    const wrapper = mount(PatternGrid, { props: { pattern } })
    const rows = wrapper.findAll('[data-testid="grid-row"]')

    expect(rows[0]!.attributes('style')).toContain('margin-left: 0px')
    expect(rows[1]!.attributes('style')).toContain('margin-left: 10px')
  })

  it('renders Brick stitch with the same horizontal row offset as Peyote but stacked at full row height', () => {
    const pattern = createPattern({
      technique: 'brick',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    const wrapper = mount(PatternGrid, { props: { pattern } })
    const rows = wrapper.findAll('[data-testid="grid-row"]')

    expect(rows[1]!.attributes('style')).toContain('margin-left: 10px')
    expect(rows[1]!.attributes('style')).toContain('margin-top: 0px')
    expect(wrapper.classes()).toContain('pattern-grid--brick')
    expect(wrapper.classes()).not.toContain('pattern-grid--peyote')
  })

  it("packs Peyote's rows tighter than a full cell, unlike Brick stitch's full-height rows", () => {
    const peyote = createPattern({
      technique: 'peyote',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })
    const brick = createPattern({
      technique: 'brick',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    const peyoteWrapper = mount(PatternGrid, { props: { pattern: peyote } })
    const brickWrapper = mount(PatternGrid, { props: { pattern: brick } })

    expect(peyoteWrapper.findAll('[data-testid="grid-row"]')[1]!.attributes('style')).toContain(
      'margin-top: -5px',
    )
    expect(brickWrapper.findAll('[data-testid="grid-row"]')[1]!.attributes('style')).toContain(
      'margin-top: 0px',
    )
  })

  it('emits cell-primary-down on mousedown, with the row and column of the pressed cell', async () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    const wrapper = mount(PatternGrid, { props: { pattern } })
    const targetRow = wrapper.findAll('[data-testid="grid-row"]')[2]!
    await targetRow.findAll('[data-testid="grid-cell"]')[3]!.trigger('mousedown')

    expect(wrapper.emitted('cell-primary-down')).toEqual([[2, 3]])
  })

  it('emits cell-primary-move on entering a cell while the primary button is held, for drag-to-draw', async () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    const wrapper = mount(PatternGrid, { props: { pattern } })
    const cells = wrapper.findAll('[data-testid="grid-cell"]')

    await cells[3]!.trigger('mouseenter', { buttons: 1 })
    expect(wrapper.emitted('cell-primary-move')).toEqual([[0, 3]])

    // Hovering without the button held doesn't count as a drag move.
    await cells[4]!.trigger('mouseenter', { buttons: 0 })
    expect(wrapper.emitted('cell-primary-move')).toEqual([[0, 3]])
  })

  it('emits cell-secondary-down on right mousedown, with the row and column of the pressed cell', async () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    const wrapper = mount(PatternGrid, { props: { pattern } })
    const targetRow = wrapper.findAll('[data-testid="grid-row"]')[2]!
    await targetRow.findAll('[data-testid="grid-cell"]')[3]!.trigger('mousedown', { button: 2 })

    expect(wrapper.emitted('cell-secondary-down')).toEqual([[2, 3]])
    expect(wrapper.emitted('cell-primary-down')).toBeUndefined()
  })

  it('emits cell-secondary-move on entering a cell while the secondary button is held', async () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    const wrapper = mount(PatternGrid, { props: { pattern } })
    const cells = wrapper.findAll('[data-testid="grid-cell"]')

    await cells[3]!.trigger('mouseenter', { buttons: 2 })

    expect(wrapper.emitted('cell-secondary-move')).toEqual([[0, 3]])
    expect(wrapper.emitted('cell-primary-move')).toBeUndefined()
  })

  it('suppresses the native context menu on right-click', () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    const wrapper = mount(PatternGrid, { props: { pattern } })
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    wrapper.find('.pattern-grid').element.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it('emits cell-hover on entering a cell and hover-end on leaving the grid', async () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    const wrapper = mount(PatternGrid, { props: { pattern } })
    await wrapper.findAll('[data-testid="grid-cell"]')[3]!.trigger('mouseenter')
    await wrapper.find('.pattern-grid').trigger('mouseleave')

    expect(wrapper.emitted('cell-hover')).toEqual([[0, 3]])
    expect(wrapper.emitted('hover-end')).toHaveLength(1)
  })
})

describe('PatternGrid hover preview', () => {
  function pattern() {
    return createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })
  }

  it('renders nothing extra when no cells are being previewed', () => {
    const wrapper = mount(PatternGrid, { props: { pattern: pattern() } })

    expect(wrapper.find('[data-testid="cell-preview"]').exists()).toBe(false)
    expect(wrapper.find('.pattern-grid__cell--preview-neutral').exists()).toBe(false)
  })

  it('shows a faint color preview on the given cells when a color is set', () => {
    const wrapper = mount(PatternGrid, {
      props: { pattern: pattern(), previewCells: [{ row: 0, column: 2 }], previewColor: '#e63746' },
    })

    const previewedCell = wrapper.findAll('[data-testid="grid-cell"]')[2]!
    expect(previewedCell.find('[data-testid="cell-preview"]').attributes('style')).toContain(
      'background-color: rgb(230, 55, 70)',
    )
  })

  it('shows a neutral outline instead of a color when previewColor is null', () => {
    const wrapper = mount(PatternGrid, {
      props: { pattern: pattern(), previewCells: [{ row: 0, column: 2 }], previewColor: null },
    })

    const previewedCell = wrapper.findAll('[data-testid="grid-cell"]')[2]!
    expect(previewedCell.find('[data-testid="cell-preview"]').exists()).toBe(false)
    expect(previewedCell.classes()).toContain('pattern-grid__cell--preview-neutral')
  })

  it('previews every given cell, e.g. the mirrored counterparts of a hovered cell', () => {
    const wrapper = mount(PatternGrid, {
      props: {
        pattern: pattern(),
        previewCells: [
          { row: 0, column: 2 },
          { row: 0, column: 7 },
        ],
        previewColor: '#e63746',
      },
    })

    expect(wrapper.findAll('[data-testid="cell-preview"]')).toHaveLength(2)
  })
})

describe('PatternGrid row progress', () => {
  function pattern() {
    return createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })
  }

  function rowClasses(pattern: Pattern) {
    return mount(PatternGrid, { props: { pattern } })
      .findAll('[data-testid="grid-row"]')
      .map((row) => row.classes())
  }

  it('marks no row as woven or current while the overlay is off', () => {
    const classes = rowClasses(moveToRow(pattern(), 3))

    expect(classes.flat()).not.toContain('pattern-grid__row--done')
    expect(classes.flat()).not.toContain('pattern-grid__row--current')
  })

  it('dims the rows behind the pointer, highlights the current one, and leaves the rest normal', () => {
    const classes = rowClasses(setRowProgressEnabled(moveToRow(pattern(), 3), true))

    expect(classes[2]).toContain('pattern-grid__row--done')
    expect(classes[3]).toContain('pattern-grid__row--current')
    expect(classes[3]).not.toContain('pattern-grid__row--done')
    expect(classes[4]).not.toContain('pattern-grid__row--done')
    expect(classes[4]).not.toContain('pattern-grid__row--current')
  })

  it('treats nothing as woven yet while the pointer is still on the first row', () => {
    const classes = rowClasses(setRowProgressEnabled(pattern(), true))

    expect(classes.flat()).not.toContain('pattern-grid__row--done')
    expect(classes[0]).toContain('pattern-grid__row--current')
  })
})
