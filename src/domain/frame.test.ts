import { describe, expect, it } from 'vitest'
import { withColors } from './canvas'
import { fitToDrawing, frameFromCells, frameWithEdges, frameResizedAround, frameWithEdgeStep, parseFrameSize, frameWithSize, movedFrame, sameFrame, snapRow } from './frame'

describe('frameFromCells', () => {
  it('covers the beads from one corner to the other, whichever way the drag went', () => {
    const down = frameFromCells('loom', { row: 2, column: 3 }, { row: 5, column: 9 })
    expect(down).toEqual({ row: 2, column: 3, rows: 4, columns: 7 })
    expect(frameFromCells('loom', { row: 5, column: 9 }, { row: 2, column: 3 })).toEqual(down)
    expect(frameFromCells('loom', { row: 5, column: 3 }, { row: 2, column: 9 })).toEqual(down)
  })

  it('is one bead when the drag never left the bead it started on', () => {
    expect(frameFromCells('loom', { row: -4, column: 7 }, { row: -4, column: 7 })).toEqual({ row: -4, column: 7, rows: 1, columns: 1 })
  })

  it('starts on an even row where rows alternate, reaching one row up rather than losing a row', () => {
    expect(frameFromCells('peyote', { row: 3, column: 0 }, { row: 6, column: 4 })).toEqual({ row: 2, column: 0, rows: 5, columns: 5 })
    expect(frameFromCells('brick', { row: -3, column: 0 }, { row: 0, column: 0 })).toEqual({ row: -4, column: 0, rows: 5, columns: 1 })
    expect(snapRow('loom', 3)).toBe(3)
    expect(snapRow('peyote', -1)).toBe(-2)
  })
})

describe('frameWithEdges', () => {
  const frame = { row: 4, column: 4, rows: 6, columns: 6 }

  it('drags one edge, or two for a corner, to the bead under the pointer', () => {
    expect(frameWithEdges('loom', frame, ['left'], { row: 0, column: 1 })).toEqual({ row: 4, column: 1, rows: 6, columns: 9 })
    expect(frameWithEdges('loom', frame, ['bottom', 'right'], { row: 12, column: 12 })).toEqual({ row: 4, column: 4, rows: 9, columns: 9 })
    expect(frameWithEdges('loom', frame, ['top', 'left'], { row: 2, column: 2 })).toEqual({ row: 2, column: 2, rows: 8, columns: 8 })
  })

  it('never lets an edge pass the one opposite it: one bead is the least', () => {
    expect(frameWithEdges('loom', frame, ['left'], { row: 0, column: 99 })).toEqual({ row: 4, column: 9, rows: 6, columns: 1 })
    expect(frameWithEdges('loom', frame, ['bottom'], { row: -50, column: 0 })).toEqual({ row: 4, column: 4, rows: 1, columns: 6 })
  })

  it('keeps the top on an even row for peyote, with the bottom where it was', () => {
    const peyote = { row: 4, column: 0, rows: 6, columns: 3 }
    expect(frameWithEdges('peyote', peyote, ['top'], { row: 1, column: 0 })).toEqual({ row: 0, column: 0, rows: 10, columns: 3 })
  })
})

describe('movedFrame', () => {
  it('moves by whole beads, negative included', () => {
    expect(movedFrame('loom', { row: 0, column: 0, rows: 3, columns: 4 }, -2, 5)).toEqual({ row: -2, column: 5, rows: 3, columns: 4 })
  })

  it('moves by pairs of rows where rows alternate, so the first row stays unshifted', () => {
    expect(movedFrame('peyote', { row: 0, column: 0, rows: 3, columns: 4 }, 3, 1).row).toBe(4)
    expect(movedFrame('peyote', { row: 0, column: 0, rows: 3, columns: 4 }, 1, 1).row).toBe(2)
    expect(movedFrame('peyote', { row: 2, column: 0, rows: 3, columns: 4 }, -1, 0).row).toBe(0)
  })
})

describe('frameWithSize', () => {
  it('changes the size from the top-left corner and never below one bead', () => {
    expect(frameWithSize({ row: 3, column: 4, rows: 5, columns: 6 }, 10, 2)).toEqual({ row: 3, column: 4, rows: 2, columns: 10 })
    expect(frameWithSize({ row: 3, column: 4, rows: 5, columns: 6 }, 0, -3)).toEqual({ row: 3, column: 4, rows: 1, columns: 1 })
  })
})

describe('fitToDrawing', () => {
  const beads = withColors({}, [
    { row: 1, column: -3, color: '#f00' },
    { row: 6, column: 8, color: '#f00' },
  ])

  it('wraps every bead drawn', () => {
    expect(fitToDrawing('loom', beads)).toEqual({ row: 1, column: -3, rows: 6, columns: 12 })
  })

  it('leaves out beads the current Frame\'s margin covers', () => {
    const current = { row: 20, column: 20, rows: 3, columns: 3 }
    const withHidden = withColors(beads, [{ row: 18, column: 20, color: '#f00' }])
    expect(fitToDrawing('loom', withHidden, current)).toEqual({ row: 1, column: -3, rows: 6, columns: 12 })
  })

  it('starts on an even row where rows alternate, keeping the last row where it is', () => {
    expect(fitToDrawing('peyote', beads)).toEqual({ row: 0, column: -3, rows: 7, columns: 12 })
  })

  it('is nothing for an empty canvas', () => {
    expect(fitToDrawing('loom', {})).toBeUndefined()
  })
})

it('compares frames by their position and size', () => {
  expect(sameFrame({ row: 0, column: 0, rows: 1, columns: 1 }, { row: 0, column: 0, rows: 1, columns: 1 })).toBe(true)
  expect(sameFrame({ row: 0, column: 0, rows: 1, columns: 1 }, { row: 0, column: 1, rows: 1, columns: 1 })).toBe(false)
  expect(sameFrame(undefined, undefined)).toBe(true)
  expect(sameFrame(undefined, { row: 0, column: 0, rows: 1, columns: 1 })).toBe(false)
})

describe('frameWithEdgeStep', () => {
  const frame = { row: 4, column: 4, rows: 6, columns: 6 }

  it('moves one edge a bead out or in and leaves the other three', () => {
    expect(frameWithEdgeStep('loom', frame, 'left', 1)).toEqual({ row: 4, column: 3, rows: 6, columns: 7 })
    expect(frameWithEdgeStep('loom', frame, 'left', -1)).toEqual({ row: 4, column: 5, rows: 6, columns: 5 })
    expect(frameWithEdgeStep('loom', frame, 'right', 1)).toEqual({ row: 4, column: 4, rows: 6, columns: 7 })
    expect(frameWithEdgeStep('loom', frame, 'right', -1)).toEqual({ row: 4, column: 4, rows: 6, columns: 5 })
    expect(frameWithEdgeStep('loom', frame, 'top', 1)).toEqual({ row: 3, column: 4, rows: 7, columns: 6 })
    expect(frameWithEdgeStep('loom', frame, 'top', -1)).toEqual({ row: 5, column: 4, rows: 5, columns: 6 })
    expect(frameWithEdgeStep('loom', frame, 'bottom', 1)).toEqual({ row: 4, column: 4, rows: 7, columns: 6 })
    expect(frameWithEdgeStep('loom', frame, 'bottom', -1)).toEqual({ row: 4, column: 4, rows: 5, columns: 6 })
  })

  it('stops an edge at four beads (ticket 473), but still lets a smaller Frame grow', () => {
    const four = { row: 2, column: 2, rows: 4, columns: 4 }
    for (const edge of ['top', 'bottom', 'left', 'right'] as const) expect(frameWithEdgeStep('loom', four, edge, -1)).toBe(four)
    const one = { row: 2, column: 2, rows: 1, columns: 1 }
    expect(frameWithEdgeStep('loom', one, 'right', 1)).toEqual({ ...one, columns: 2 })
  })

  it('moves the top edge by a pair of rows where rows alternate, so the first row stays even', () => {
    const peyote = { row: 4, column: 0, rows: 6, columns: 3 }
    expect(frameWithEdgeStep('peyote', peyote, 'top', 1)).toEqual({ row: 2, column: 0, rows: 8, columns: 3 })
    expect(frameWithEdgeStep('brick', peyote, 'top', -1)).toEqual({ row: 6, column: 0, rows: 4, columns: 3 })
    expect(frameWithEdgeStep('peyote', { ...peyote, rows: 5 }, 'top', -1)).toEqual({ ...peyote, rows: 5 })
    expect(frameWithEdgeStep('peyote', peyote, 'bottom', 1)).toEqual({ row: 4, column: 0, rows: 7, columns: 3 })
  })
})

describe('frameResizedAround (ticket 473)', () => {
  const frame = { row: 10, column: 10, rows: 10, columns: 10 }

  it('grows and shrinks both edges of a side evenly, the odd bead going right or down', () => {
    expect(frameResizedAround('loom', frame, 20, 14)).toEqual({ row: 8, column: 5, rows: 14, columns: 20 })
    expect(frameResizedAround('loom', frame, 13, 7)).toEqual({ row: 11, column: 9, rows: 7, columns: 13 })
    expect(frameResizedAround('loom', frame, 10, 10)).toEqual(frame)
  })

  it('moves the top edge by whole pairs of rows where rows alternate', () => {
    expect(frameResizedAround('peyote', frame, 10, 20)).toEqual({ row: 6, column: 10, rows: 20, columns: 10 })
    expect(frameResizedAround('brick', frame, 10, 12)).toEqual({ row: 10, column: 10, rows: 12, columns: 10 })
  })

  it('keeps each side between four and 999 beads', () => {
    expect(frameResizedAround('loom', frame, 1, 5000)).toMatchObject({ columns: 4, rows: 999 })
  })
})

describe('parseFrameSize (ticket 473)', () => {
  it('reads width and height with an x, ×, * or Cyrillic х between them', () => {
    for (const text of ['20x120', ' 20 × 120 ', '20*120', '20X120', '20х120']) expect(parseFrameSize(text)).toEqual({ columns: 20, rows: 120 })
  })

  it('refuses anything else', () => {
    for (const text of ['', '20', '20x', 'x120', '20x120x3', '-5x10', 'a x b']) expect(parseFrameSize(text)).toBeUndefined()
  })
})
