import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PatternGrid from './PatternGrid.vue'
import {
  createPattern,
  moveToRow,
  setRowProgressEnabled,
  toggleRowDirection,
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

  it('emits cell-primary-down on pointerdown, with the row and column of the pressed cell', async () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    const wrapper = mount(PatternGrid, { props: { pattern } })
    const targetRow = wrapper.findAll('[data-testid="grid-row"]')[2]!
    await targetRow.findAll('[data-testid="grid-cell"]')[3]!.trigger('pointerdown', { button: 0 })

    expect(wrapper.emitted('cell-primary-down')).toEqual([[2, 3]])
  })

  it('emits cell-primary-move on entering a cell while the primary pointer is held, for drag-to-draw -- mouse, touch, or pen alike', async () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    const wrapper = mount(PatternGrid, { props: { pattern } })
    const cells = wrapper.findAll('[data-testid="grid-cell"]')

    await cells[3]!.trigger('pointerenter', { buttons: 1 })
    expect(wrapper.emitted('cell-primary-move')).toEqual([[0, 3]])

    // Hovering without the pointer held down doesn't count as a drag move.
    await cells[4]!.trigger('pointerenter', { buttons: 0 })
    expect(wrapper.emitted('cell-primary-move')).toEqual([[0, 3]])
  })

  it('drags a touch/pen stroke across cells the same way a held mouse button does (ticket 60)', async () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    const wrapper = mount(PatternGrid, { props: { pattern } })
    const cells = wrapper.findAll('[data-testid="grid-cell"]')

    await cells[0]!.trigger('pointerdown', { pointerType: 'touch', pointerId: 1 })
    await cells[1]!.trigger('pointerenter', { pointerType: 'touch', pointerId: 1, buttons: 1 })
    await cells[2]!.trigger('pointerenter', { pointerType: 'touch', pointerId: 1, buttons: 1 })

    expect(wrapper.emitted('cell-primary-down')).toEqual([[0, 0]])
    expect(wrapper.emitted('cell-primary-move')).toEqual([[0, 1], [0, 2]])
  })

  it('emits cell-secondary-down on right-button pointerdown, with the row and column of the pressed cell', async () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    const wrapper = mount(PatternGrid, { props: { pattern } })
    const targetRow = wrapper.findAll('[data-testid="grid-row"]')[2]!
    await targetRow.findAll('[data-testid="grid-cell"]')[3]!.trigger('pointerdown', { button: 2 })

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

    await cells[3]!.trigger('pointerenter', { buttons: 2 })

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
    await wrapper.findAll('[data-testid="grid-cell"]')[3]!.trigger('pointerenter')
    await wrapper.find('.pattern-grid').trigger('pointerleave')

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

  describe('once rows run down the columns', () => {
    /** Each grid row's cells' classes, indexed [row][column]. */
    function cellClasses(pattern: Pattern) {
      return mount(PatternGrid, { props: { pattern } })
        .findAll('[data-testid="grid-row"]')
        .map((row) => row.findAll('[data-testid="grid-cell"]').map((cell) => cell.classes()))
    }

    it('dims every bead in the columns behind the pointer and marks the current column, top to bottom', () => {
      const cells = cellClasses(setRowProgressEnabled(moveToRow(toggleRowDirection(pattern()), 3), true))

      expect(cells).toHaveLength(20)
      for (const row of cells) {
        expect(row[2]).toContain('pattern-grid__cell--done')
        expect(row[3]).toContain('pattern-grid__cell--current')
        expect(row[3]).not.toContain('pattern-grid__cell--done')
        expect(row[4]).not.toContain('pattern-grid__cell--done')
        expect(row[4]).not.toContain('pattern-grid__cell--current')
      }
    })

    it('leaves the grid rows themselves without the row overlay', () => {
      const classes = rowClasses(setRowProgressEnabled(moveToRow(toggleRowDirection(pattern()), 3), true))

      expect(classes.flat()).not.toContain('pattern-grid__row--done')
      expect(classes.flat()).not.toContain('pattern-grid__row--current')
    })

    it('marks no bead while the overlay is off', () => {
      const cells = cellClasses(moveToRow(toggleRowDirection(pattern()), 3))

      expect(cells.flat(2)).not.toContain('pattern-grid__cell--done')
      expect(cells.flat(2)).not.toContain('pattern-grid__cell--current')
    })
  })
})

describe('PatternGrid selection', () => {
  function pattern() {
    return createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' }, // 10 columns x 20 rows
    })
  }

  function selectedPositions(wrapper: ReturnType<typeof mount>) {
    return wrapper
      .findAll('[data-testid="grid-row"]')
      .flatMap((row, rowIndex) =>
        row
          .findAll('[data-testid="grid-cell"]')
          .map((cell, columnIndex) => ({ cell, rowIndex, columnIndex })),
      )
      .filter(({ cell }) => cell.classes().includes('pattern-grid__cell--selected'))
      .map(({ rowIndex, columnIndex }) => `${rowIndex},${columnIndex}`)
  }

  it('marks no cell as selected while there is no selection', () => {
    const wrapper = mount(PatternGrid, { props: { pattern: pattern() } })

    expect(selectedPositions(wrapper)).toEqual([])
  })

  it('marks exactly the cells inside the selection rectangle', () => {
    const wrapper = mount(PatternGrid, {
      props: { pattern: pattern(), selection: { top: 1, left: 2, rows: 2, columns: 3 } },
    })

    expect(selectedPositions(wrapper)).toEqual(['1,2', '1,3', '1,4', '2,2', '2,3', '2,4'])
  })

  it('draws the marquee only along the rectangle’s outer edge, not around every cell inside it', () => {
    const wrapper = mount(PatternGrid, {
      props: { pattern: pattern(), selection: { top: 0, left: 0, rows: 3, columns: 3 } },
    })
    const cells = wrapper.findAll('[data-testid="grid-cell"]')

    // Top-left corner: the two edges that are actually on the rectangle's boundary, and neither of the other two.
    const corner = cells[0]!.attributes('style')!
    expect(corner).toContain('inset 0px 2px')
    expect(corner).toContain('inset 2px 0px')
    expect(corner).not.toContain('inset 0px -2px')
    expect(corner).not.toContain('inset -2px 0px')

    // The middle cell is surrounded by selection on all sides, so it carries no edge at all.
    expect(cells[11]!.attributes('style')).not.toContain('inset')
  })
})

describe('PatternGrid multi-color preview', () => {
  function pattern() {
    return createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })
  }

  it('previews each cell in its own color when the preview carries one, for a pasted block', () => {
    const wrapper = mount(PatternGrid, {
      props: {
        pattern: pattern(),
        previewCells: [
          { row: 0, column: 0, color: '#e63746' },
          { row: 0, column: 1, color: '#2f6fed' },
        ],
        previewColor: '#27ae60',
      },
    })
    const cells = wrapper.findAll('[data-testid="grid-cell"]')

    expect(cells[0]!.find('[data-testid="cell-preview"]').attributes('style')).toContain(
      'background-color: rgb(230, 55, 70)',
    )
    expect(cells[1]!.find('[data-testid="cell-preview"]').attributes('style')).toContain(
      'background-color: rgb(47, 111, 237)',
    )
  })
})

describe('PatternGrid mirror axis lines (rich Mirror, ticket 44)', () => {
  function pattern(technique: Pattern['technique'] = 'loom') {
    return createPattern({
      technique,
      beadId: cubeBead.id,
      size: { width: 6, height: 6, unit: 'mm' },
    })
  }

  it('draws no axis lines when mirrorAxisCounts is omitted or both counts are 0', () => {
    const withoutProp = mount(PatternGrid, { props: { pattern: pattern() } })
    expect(withoutProp.findAll('[data-testid="mirror-axis-line-column"]')).toHaveLength(0)
    expect(withoutProp.findAll('[data-testid="mirror-axis-line-row"]')).toHaveLength(0)

    const withZeroCounts = mount(PatternGrid, {
      props: { pattern: pattern(), mirrorAxisCounts: { columns: 0, rows: 0 } },
    })
    expect(withZeroCounts.findAll('[data-testid="mirror-axis-line-column"]')).toHaveLength(0)
  })

  it.each(['loom', 'peyote', 'brick'] as const)(
    'draws one line per axis regardless of Technique (%s)',
    (technique) => {
      const wrapper = mount(PatternGrid, {
        props: { pattern: pattern(technique), mirrorAxisCounts: { columns: 2, rows: 1 } },
      })

      expect(wrapper.findAll('[data-testid="mirror-axis-line-column"]')).toHaveLength(2)
      expect(wrapper.findAll('[data-testid="mirror-axis-line-row"]')).toHaveLength(1)
    },
  )
})

describe('PatternGrid Mirror current hover preview (ticket 47)', () => {
  function pattern() {
    return createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 6, height: 6, unit: 'mm' },
    })
  }

  it('dims exactly the given cells, and nothing else, when dimmedCells is set', () => {
    const wrapper = mount(PatternGrid, {
      props: { pattern: pattern(), dimmedCells: [{ row: 0, column: 1 }, { row: 2, column: 3 }] },
    })
    const cells = wrapper.findAll('[data-testid="grid-cell"]')

    expect(cells[1]!.classes()).toContain('pattern-grid__cell--dimmed') // (0,1)
    expect(cells[11]!.classes()).toContain('pattern-grid__cell--dimmed') // (2,3): row2*4cols+3
    expect(cells[0]!.classes()).not.toContain('pattern-grid__cell--dimmed')
  })

  it('dims nothing when dimmedCells is omitted or empty', () => {
    const withoutProp = mount(PatternGrid, { props: { pattern: pattern() } })
    expect(withoutProp.findAll('.pattern-grid__cell--dimmed')).toHaveLength(0)

    const withEmpty = mount(PatternGrid, { props: { pattern: pattern(), dimmedCells: [] } })
    expect(withEmpty.findAll('.pattern-grid__cell--dimmed')).toHaveLength(0)
  })
})
