import { describe, expect, it } from 'vitest'
import {
  copySelection,
  isWithinSelection,
  mirroredPasteBlock,
  mirroredPastedCells,
  pasteBlock,
  pastedCells,
  selectionBetween,
  type CopiedBlock,
} from './selection'
import { createPattern, type Pattern } from './pattern'
import { BEAD_CATALOG } from './beads'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

const RED = '#e63746'
const BLUE = '#2f6fed'

/** A loom Pattern of the given grid size, so a test can state "4x3" instead of a physical size that rounds to it. */
function pattern(columns: number, rows: number): Pattern {
  return createPattern({
    technique: 'loom',
    beadId: cubeBead.id,
    size: { width: columns * cubeBead.widthMm, height: rows * cubeBead.heightMm, unit: 'mm' },
  })
}

/** Paints a Pattern from a picture of it: one string per row, one character per column, '.' for an empty cell. */
function painted(rows: string[], colors: Record<string, string> = { r: RED, b: BLUE }): Pattern {
  const base = pattern(rows[0]!.length, rows.length)
  return {
    ...base,
    grid: rows.map((row) => [...row].map((char) => ({ color: colors[char] ?? null }))),
  }
}

/** The inverse of `painted`, so an expectation can be written as the picture it should produce. */
function picture(target: Pattern, colors: Record<string, string> = { r: RED, b: BLUE }): string[] {
  const chars = Object.entries(colors)
  return target.grid.map((row) =>
    row.map((cell) => chars.find(([, hex]) => hex === cell.color)?.[0] ?? '.').join(''),
  )
}

describe('selectionBetween', () => {
  it('spans the rectangle between the two corners of a drag', () => {
    expect(selectionBetween(pattern(10, 10), { row: 1, column: 2 }, { row: 3, column: 5 })).toEqual({
      top: 1,
      left: 2,
      rows: 3,
      columns: 4,
    })
  })

  it('spans the same rectangle whichever corner the drag started from', () => {
    const grid = pattern(10, 10)
    const downRight = selectionBetween(grid, { row: 1, column: 2 }, { row: 3, column: 5 })

    expect(selectionBetween(grid, { row: 3, column: 5 }, { row: 1, column: 2 })).toEqual(downRight)
    expect(selectionBetween(grid, { row: 3, column: 2 }, { row: 1, column: 5 })).toEqual(downRight)
  })

  it('covers a single cell when the drag never left the cell it started on', () => {
    expect(selectionBetween(pattern(10, 10), { row: 4, column: 4 }, { row: 4, column: 4 })).toEqual({
      top: 4,
      left: 4,
      rows: 1,
      columns: 1,
    })
  })

  it('clamps a corner that fell outside the grid back onto it', () => {
    expect(selectionBetween(pattern(4, 3), { row: -5, column: -5 }, { row: 99, column: 99 })).toEqual({
      top: 0,
      left: 0,
      rows: 3,
      columns: 4,
    })
  })
})

describe('isWithinSelection', () => {
  const selection = { top: 1, left: 2, rows: 2, columns: 3 }

  it('accepts the cells inside the rectangle, corners included', () => {
    for (const position of [
      { row: 1, column: 2 },
      { row: 2, column: 4 },
      { row: 1, column: 3 },
    ]) {
      expect(isWithinSelection(selection, position)).toBe(true)
    }
  })

  it('rejects the cells just outside it on every side', () => {
    for (const position of [
      { row: 0, column: 3 },
      { row: 3, column: 3 },
      { row: 1, column: 1 },
      { row: 1, column: 5 },
    ]) {
      expect(isWithinSelection(selection, position)).toBe(false)
    }
  })
})

describe('copySelection', () => {
  it('snapshots the selected rectangle at the block’s own top-left origin', () => {
    const source = painted(['....', '.rb.', '.br.', '....'])

    expect(copySelection(source, { top: 1, left: 1, rows: 2, columns: 2 })).toEqual({
      rows: 2,
      columns: 2,
      colors: [
        [RED, BLUE],
        [BLUE, RED],
      ],
    })
  })

  it('records which of the selected cells were empty, rather than dropping them', () => {
    const source = painted(['r.', '.b'])

    expect(copySelection(source, { top: 0, left: 0, rows: 2, columns: 2 }).colors).toEqual([
      [RED, null],
      [null, BLUE],
    ])
  })

  it('does not alias the Pattern’s own grid, so later edits cannot change what was copied', () => {
    const source = painted(['rr', 'rr'])
    const block = copySelection(source, { top: 0, left: 0, rows: 2, columns: 2 })

    source.grid[0]![0]!.color = BLUE

    expect(block.colors[0]![0]).toBe(RED)
  })
})

describe('pastedCells', () => {
  const block: CopiedBlock = {
    rows: 2,
    columns: 2,
    colors: [
      [RED, null],
      [null, BLUE],
    ],
  }

  it('anchors the block’s top-left corner at the given position', () => {
    expect(pastedCells(pattern(5, 5), block, { row: 2, column: 3 })).toEqual([
      { row: 2, column: 3, color: RED },
      { row: 3, column: 4, color: BLUE },
    ])
  })

  it('leaves out the block’s empty cells, which paste as holes rather than as erasures', () => {
    const cells = pastedCells(pattern(5, 5), block, { row: 0, column: 0 })

    expect(cells).not.toContainEqual(expect.objectContaining({ row: 0, column: 1 }))
    expect(cells).not.toContainEqual(expect.objectContaining({ row: 1, column: 0 }))
  })

  it('drops the part of the block that falls past the grid’s edge', () => {
    // Anchored on the last cell of a 2x2 grid, only the block's own top-left corner still lands on the grid.
    expect(pastedCells(pattern(2, 2), block, { row: 1, column: 1 })).toEqual([
      { row: 1, column: 1, color: RED },
    ])
  })
})

describe('pasteBlock', () => {
  const motif: CopiedBlock = {
    rows: 2,
    columns: 2,
    colors: [
      [RED, null],
      [null, RED],
    ],
  }

  it('stamps the block onto the grid at the given position', () => {
    const target = painted(['....', '....', '....'])

    expect(picture(pasteBlock(target, motif, { row: 1, column: 2 }))).toEqual([
      '....',
      '..r.',
      '...r',
    ])
  })

  it('leaves the destination’s own color alone under the block’s empty cells', () => {
    const target = painted(['bbb', 'bbb', 'bbb'])

    expect(picture(pasteBlock(target, motif, { row: 0, column: 0 }))).toEqual(['rbb', 'brb', 'bbb'])
  })

  it('clips a stamp that runs past the grid’s edge instead of refusing or shifting it', () => {
    const target = painted(['..', '..'])

    expect(picture(pasteBlock(target, motif, { row: 1, column: 1 }))).toEqual(['..', '.r'])
  })

  it('can be stamped repeatedly, each stamp landing where it was asked for', () => {
    const target = painted(['....', '....', '....', '....'])

    const twice = pasteBlock(pasteBlock(target, motif, { row: 0, column: 0 }), motif, { row: 2, column: 2 })

    expect(picture(twice)).toEqual(['r...', '.r..', '..r.', '...r'])
  })

  it('returns the same Pattern, untouched, when the stamp would change nothing', () => {
    const target = painted(['r.', '.r'])

    expect(pasteBlock(target, motif, { row: 0, column: 0 })).toBe(target)
  })

  it('returns the same Pattern when the stamp lands entirely off the grid', () => {
    const target = painted(['..', '..'])

    expect(pasteBlock(target, motif, { row: 5, column: 5 })).toBe(target)
  })
})

describe('mirroredPastedCells and mirroredPasteBlock (ticket 50: Paste projects through Mirror)', () => {
  const dot: CopiedBlock = { rows: 1, columns: 1, colors: [[RED]] }

  it('with both axis counts at 0, behaves exactly like a single unmirrored pastedCells/pasteBlock stamp', () => {
    const target = painted(['....', '....', '....', '....'])
    const at = { row: 1, column: 1 }
    const axes = { rows: 0, columns: 0 }

    expect(mirroredPastedCells(target, dot, at, axes)).toEqual(pastedCells(target, dot, at))
    expect(picture(mirroredPasteBlock(target, dot, at, axes))).toEqual(picture(pasteBlock(target, dot, at)))
  })

  it('with a single center axis on (the flag-off case), stamps both the aimed spot and its one mirrored counterpart', () => {
    const target = painted(['......', '......', '......', '......'])

    // 6-wide grid, mirrored across columns (axisCount 1): column 1 <-> column 4.
    const result = mirroredPasteBlock(target, dot, { row: 2, column: 1 }, { rows: 0, columns: 1 })

    expect(picture(result)).toEqual(['......', '......', '.r..r.', '......'])
  })

  it('with N axes and copy mode off, stamps every strip, each copy independently flipped', () => {
    const motif: CopiedBlock = {
      rows: 1,
      columns: 2,
      colors: [[RED, null]],
    }
    // 6-wide grid, 2 axes -> strips [0,1] [2,3] [4,5]. Anchored at column 0 (spanning 0,1): strip0 stamps as-is
    // (r at 0, hole at 1); strip1 mirrors flipped (hole lands at 2, r lands at 3); strip2 translates unflipped
    // (r at 4, hole at 5) -- see the mirror.test.ts placements test this mirrors.
    const target = painted(['bbbbbb'], { r: RED, b: BLUE })

    const result = mirroredPasteBlock(target, motif, { row: 0, column: 0 }, { rows: 0, columns: 2 })

    expect(picture(result, { r: RED, b: BLUE })).toEqual(['rbbrrb'])
  })

  it('with copy mode on, translates every copy without flipping', () => {
    const motif: CopiedBlock = { rows: 1, columns: 2, colors: [[RED, null]] }
    const target = painted(['bbbbbb'], { r: RED, b: BLUE })

    const result = mirroredPasteBlock(target, motif, { row: 0, column: 0 }, { rows: 0, columns: 2 }, true)

    expect(picture(result, { r: RED, b: BLUE })).toEqual(['rbrbrb'])
  })

  it('leaves each copy’s own holes as holes, independently of the others', () => {
    const motif: CopiedBlock = { rows: 1, columns: 2, colors: [[RED, null]] }
    const target = painted(['bbbbbb'], { r: RED, b: BLUE })

    const result = mirroredPasteBlock(target, motif, { row: 0, column: 0 }, { rows: 0, columns: 1 })

    // Column 0->r, column1 is a hole (stays b); mirrored at columns 4/5 (6-wide, single axis): column5->r,
    // column4 is a hole (stays b).
    expect(picture(result, { r: RED, b: BLUE })).toEqual(['rbbbbr'])
  })

  it('clips each copy independently when it reaches past the grid’s edge', () => {
    const motif: CopiedBlock = { rows: 1, columns: 2, colors: [[RED, RED]] }
    // 6-wide grid, single axis (strips [0,1,2] [3,4,5]). Anchored at column 5 -- the block's own placement already
    // runs one cell past the grid's right edge; its mirror image runs one cell past the *left* edge instead.
    const target = painted(['......'])

    const result = mirroredPasteBlock(target, motif, { row: 0, column: 5 }, { rows: 0, columns: 1 })

    expect(picture(result)).toEqual(['r....r'])
  })

  it('honours copy mode in the preview the same way it does in the stamp', () => {
    const motif: CopiedBlock = { rows: 1, columns: 2, colors: [[RED, null]] }
    const target = painted(['bbbbbb'], { r: RED, b: BLUE })
    const at = { row: 0, column: 0 }
    const axes = { rows: 0, columns: 2 }

    const preview = mirroredPastedCells(target, motif, at, axes, true)
    const stamped = mirroredPasteBlock(target, motif, at, axes, true)

    for (const cell of preview) {
      expect(stamped.grid[cell.row]![cell.column]!.color).toBe(cell.color)
    }
  })

  it('returns the same Pattern, untouched, when every copy’s stamp would change nothing', () => {
    // 6-wide grid, 2 axes: a dot at column 0 lands on columns [0, 3, 4] (see mirror.test.ts's mirrorCounterparts
    // table for this exact dimension/axis-count) -- all three already red here.
    const target = painted(['r..rr.'])

    const result = mirroredPasteBlock(target, dot, { row: 0, column: 0 }, { rows: 0, columns: 2 })

    expect(result).toBe(target)
  })
})
