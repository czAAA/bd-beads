import { describe, expect, it } from 'vitest'
import { withColors, sameFrame } from './canvas'
import { fitToDrawing, frameWithEdges, frameResizedAround, frameWithEdgeStep, frameWithSize, movedFrame, snapRow } from './frame'

describe('snapRow', () => {
  it('starts on an even row where rows alternate, reaching one row up rather than losing a row', () => {
    expect(snapRow({ technique: 'loom' }, 3)).toBe(3)
    expect(snapRow({ technique: 'peyote' }, 3)).toBe(2)
    expect(snapRow({ technique: 'peyote' }, -1)).toBe(-2)
    expect(snapRow({ technique: 'brick' }, -3)).toBe(-4)
  })
})

describe('frameWithEdges', () => {
  const frame = { row: 4, column: 4, rows: 6, columns: 6 }

  it('drags one edge, or two for a corner, to the bead under the pointer', () => {
    expect(frameWithEdges({ technique: 'loom' }, frame, ['left'], { row: 0, column: 1 })).toEqual({ row: 4, column: 1, rows: 6, columns: 9 })
    expect(frameWithEdges({ technique: 'loom' }, frame, ['bottom', 'right'], { row: 12, column: 12 })).toEqual({ row: 4, column: 4, rows: 9, columns: 9 })
    expect(frameWithEdges({ technique: 'loom' }, frame, ['top', 'left'], { row: 2, column: 2 })).toEqual({ row: 2, column: 2, rows: 8, columns: 8 })
  })

  it('never lets an edge pass the one opposite it: one bead is the least', () => {
    expect(frameWithEdges({ technique: 'loom' }, frame, ['left'], { row: 0, column: 99 })).toEqual({ row: 4, column: 9, rows: 6, columns: 1 })
    expect(frameWithEdges({ technique: 'loom' }, frame, ['bottom'], { row: -50, column: 0 })).toEqual({ row: 4, column: 4, rows: 1, columns: 6 })
  })

  it('keeps the top on an even row for peyote, with the bottom where it was', () => {
    const peyote = { row: 4, column: 0, rows: 6, columns: 3 }
    expect(frameWithEdges({ technique: 'peyote' }, peyote, ['top'], { row: 1, column: 0 })).toEqual({ row: 0, column: 0, rows: 10, columns: 3 })
  })
})

describe('movedFrame', () => {
  it('moves by whole Canvas positions, negative included, with no stagger kept (ticket 492)', () => {
    expect(movedFrame({ row: 0, column: 0, rows: 3, columns: 4 }, -2, 5)).toEqual({ row: -2, column: 5, rows: 3, columns: 4 })
    expect(movedFrame({ row: 2, column: 0, rows: 3, columns: 4 }, 1, 1)).toEqual({ row: 3, column: 1, rows: 3, columns: 4 })
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
    expect(fitToDrawing({ technique: 'loom', beads })).toEqual({ row: 1, column: -3, rows: 6, columns: 12 })
  })

  it('leaves out beads the current Frame covers', () => {
    const current = { technique: 'loom' as const, row: 20, column: 20, rows: 3, columns: 3, beads: {} }
    const withHidden = withColors(beads, [{ row: 21, column: 21, color: '#f00' }])
    expect(fitToDrawing({ technique: 'loom', beads: withHidden, frame: current })).toEqual({ row: 1, column: -3, rows: 6, columns: 12 })
  })

  it('wraps the Frame\'s own beads with the Canvas beads that show, and leaves out those the Frame covers', () => {
    const frame = { technique: 'loom' as const, row: 20, column: 20, rows: 5, columns: 5, beads: withColors({}, [{ row: 4, column: 2, color: '#0f0' }]) }
    const covered = withColors(beads, [{ row: 21, column: 21, color: '#f00' }])
    expect(fitToDrawing({ technique: 'loom', beads: covered, frame })).toEqual({ row: 1, column: -3, rows: 24, columns: 26 })
  })

  it('starts on an even row where rows alternate, keeping the last row where it is', () => {
    expect(fitToDrawing({ technique: 'peyote', beads })).toEqual({ row: 0, column: -3, rows: 7, columns: 12 })
  })

  it('is nothing for an empty canvas', () => {
    expect(fitToDrawing({ technique: 'loom', beads: {} })).toBeUndefined()
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
    expect(frameWithEdgeStep({ technique: 'loom' }, frame, 'left', 1)).toEqual({ row: 4, column: 3, rows: 6, columns: 7 })
    expect(frameWithEdgeStep({ technique: 'loom' }, frame, 'left', -1)).toEqual({ row: 4, column: 5, rows: 6, columns: 5 })
    expect(frameWithEdgeStep({ technique: 'loom' }, frame, 'right', 1)).toEqual({ row: 4, column: 4, rows: 6, columns: 7 })
    expect(frameWithEdgeStep({ technique: 'loom' }, frame, 'right', -1)).toEqual({ row: 4, column: 4, rows: 6, columns: 5 })
    expect(frameWithEdgeStep({ technique: 'loom' }, frame, 'top', 1)).toEqual({ row: 3, column: 4, rows: 7, columns: 6 })
    expect(frameWithEdgeStep({ technique: 'loom' }, frame, 'top', -1)).toEqual({ row: 5, column: 4, rows: 5, columns: 6 })
    expect(frameWithEdgeStep({ technique: 'loom' }, frame, 'bottom', 1)).toEqual({ row: 4, column: 4, rows: 7, columns: 6 })
    expect(frameWithEdgeStep({ technique: 'loom' }, frame, 'bottom', -1)).toEqual({ row: 4, column: 4, rows: 5, columns: 6 })
  })

  it('stops an edge at four beads (ticket 473), but still lets a smaller Frame grow', () => {
    const four = { row: 2, column: 2, rows: 4, columns: 4 }
    for (const edge of ['top', 'bottom', 'left', 'right'] as const) expect(frameWithEdgeStep({ technique: 'loom' }, four, edge, -1)).toBe(four)
    const one = { row: 2, column: 2, rows: 1, columns: 1 }
    expect(frameWithEdgeStep({ technique: 'loom' }, one, 'right', 1)).toEqual({ ...one, columns: 2 })
  })

  it('moves the top edge by a pair of rows where rows alternate, so the first row stays even', () => {
    const peyote = { row: 4, column: 0, rows: 6, columns: 3 }
    expect(frameWithEdgeStep({ technique: 'peyote' }, peyote, 'top', 1)).toEqual({ row: 2, column: 0, rows: 8, columns: 3 })
    expect(frameWithEdgeStep({ technique: 'brick' }, peyote, 'top', -1)).toEqual({ row: 6, column: 0, rows: 4, columns: 3 })
    expect(frameWithEdgeStep({ technique: 'peyote' }, { ...peyote, rows: 5 }, 'top', -1)).toEqual({ ...peyote, rows: 5 })
    expect(frameWithEdgeStep({ technique: 'peyote' }, peyote, 'bottom', 1)).toEqual({ row: 4, column: 0, rows: 7, columns: 3 })
  })
})

describe('frameResizedAround (ticket 473)', () => {
  const frame = { row: 10, column: 10, rows: 10, columns: 10 }

  it('grows and shrinks both edges of a side evenly, the odd bead going right or down', () => {
    expect(frameResizedAround({ technique: 'loom' }, frame, 20, 14)).toEqual({ row: 8, column: 5, rows: 14, columns: 20 })
    expect(frameResizedAround({ technique: 'loom' }, frame, 13, 7)).toEqual({ row: 11, column: 9, rows: 7, columns: 13 })
    expect(frameResizedAround({ technique: 'loom' }, frame, 10, 10)).toEqual(frame)
  })

  it('moves the top edge by whole pairs of rows where rows alternate', () => {
    expect(frameResizedAround({ technique: 'peyote' }, frame, 10, 20)).toEqual({ row: 6, column: 10, rows: 20, columns: 10 })
    expect(frameResizedAround({ technique: 'brick' }, frame, 10, 12)).toEqual({ row: 10, column: 10, rows: 12, columns: 10 })
  })

  it('keeps each side between four and 999 beads', () => {
    expect(frameResizedAround({ technique: 'loom' }, frame, 1, 5000)).toMatchObject({ columns: 4, rows: 999 })
  })
})

describe('a Brick block (ticket 477)', () => {
  const block2 = { technique: 'brick' as const, techniqueSettings: { brickBlock: 2 } }
  const block3 = { technique: 'brick' as const, techniqueSettings: { brickBlock: 3 } }

  it('starts a Frame on a multiple of 2N rows, reaching up rather than losing a row', () => {
    expect(snapRow(block2, 7)).toBe(4)
    expect(snapRow(block2, 4)).toBe(4)
    expect(snapRow(block2, -1)).toBe(-4)
    expect(snapRow(block3, 11)).toBe(6)
  })

  it('leaves a Brick block of 1 going by pairs, and peyote and loom as they were', () => {
    expect(snapRow({ technique: 'brick' }, 3)).toBe(2)
    expect(snapRow({ technique: 'peyote', techniqueSettings: { brickBlock: 5 } }, 7)).toBe(6)
    expect(snapRow({ technique: 'loom', techniqueSettings: { brickBlock: 5 } }, 7)).toBe(7)
  })

  it('drags the top edge by a whole cycle of the Frame\'s own rows', () => {
    const frame = { row: 8, column: 0, rows: 12, columns: 4 }
    expect(frameWithEdges(block3, frame, ['top'], { row: 3, column: 0 })).toEqual({ row: 2, column: 0, rows: 18, columns: 4 })
  })

  it('steps the top edge by a whole cycle and the bottom by a row', () => {
    const frame = { row: 8, column: 0, rows: 12, columns: 12 }
    expect(frameWithEdgeStep(block3, frame, 'top', 1)).toEqual({ row: 2, column: 0, rows: 18, columns: 12 })
    expect(frameWithEdgeStep(block3, frame, 'top', -1)).toEqual({ row: 14, column: 0, rows: 6, columns: 12 })
    expect(frameWithEdgeStep(block3, frame, 'bottom', 1)).toEqual({ row: 8, column: 0, rows: 13, columns: 12 })
  })

  it('resizes round the middle with the top edge moving by whole cycles', () => {
    const frame = { row: 12, column: 10, rows: 12, columns: 12 }
    const resized = frameResizedAround(block3, frame, 12, 30)
    expect(resized.rows).toBe(30)
    expect(resized.row % 6).toBe(0)
  })

  it('fits to the drawing from a legal row', () => {
    const beads = withColors({}, [{ row: 9, column: 1, color: '#111111' }, { row: 13, column: 4, color: '#111111' }])
    expect(fitToDrawing({ ...block2, beads })).toEqual({ row: 8, column: 1, rows: 6, columns: 4 })
  })
})

describe('the Frame in Right-angle weave holds whole Units (ticket 482)', () => {
  const weave = { technique: 'rightAngle' as const }
  const frame = { row: 4, column: 3, rows: 7, columns: 5 }

  it('keeps at least a Unit across and down', () => {
    expect(frameWithEdges(weave, frame, ['bottom', 'right'], { row: 0, column: 0 })).toEqual({ ...frame, rows: 3, columns: 2 })
  })

  it('drags an edge to the nearest whole Unit', () => {
    expect(frameWithEdges(weave, frame, ['bottom'], { row: 13, column: 4 })).toEqual({ ...frame, rows: 11 })
    expect(frameWithEdges(weave, frame, ['top'], { row: 1, column: 4 })).toEqual({ ...frame, row: 0, rows: 11 })
    expect(frameWithEdges(weave, frame, ['bottom'], { row: 0, column: 4 })).toEqual({ ...frame, rows: 3 })
  })

  it('steps an edge by a Unit, or a column across', () => {
    expect(frameWithEdgeStep(weave, frame, 'bottom', 1)).toEqual({ ...frame, rows: 9 })
    expect(frameWithEdgeStep(weave, frame, 'top', 1)).toEqual({ ...frame, row: 2, rows: 9 })
    expect(frameWithEdgeStep(weave, frame, 'right', 1)).toEqual({ ...frame, columns: 6 })
  })

  it('is resized to Units typed, each side growing evenly', () => {
    // 6 Units across (7 columns) and 4 down (9 rows).
    expect(frameResizedAround(weave, frame, 6, 4)).toEqual({ row: 4, column: 2, rows: 9, columns: 7 })
  })

  it('may be typed down to one Unit', () => {
    expect(frameResizedAround(weave, frame, 1, 1)).toMatchObject({ columns: 2, rows: 3 })
  })

  it('wraps what is drawn in whole Units', () => {
    const beads = withColors({}, [{ row: 3, column: 5, color: '#ff0000' }, { row: 6, column: 7, color: '#ff0000' }])
    expect(fitToDrawing({ ...weave, beads })).toEqual({ row: 2, column: 5, rows: 5, columns: 3 })
  })
})

describe('the Frame in Netting holds whole diamonds (ticket 485)', () => {
  const weave = { technique: 'netting' as const, techniqueSettings: { netSize: 3 } }
  // Net size 3: a diamond is 4 positions across and down.
  const frame = { row: 8, column: 4, rows: 9, columns: 9 }

  it('keeps at least a diamond each way', () => {
    expect(frameWithEdges(weave, frame, ['bottom', 'right'], { row: 0, column: 0 })).toEqual({ ...frame, rows: 5, columns: 5 })
  })

  it('drags an edge to the nearest whole diamond', () => {
    expect(frameWithEdges(weave, frame, ['right'], { row: 10, column: 16 })).toEqual({ ...frame, columns: 13 })
    expect(frameWithEdges(weave, frame, ['left'], { row: 10, column: 1 })).toEqual({ ...frame, column: 0, columns: 13 })
    expect(frameWithEdges(weave, frame, ['bottom'], { row: 17, column: 10 })).toEqual({ ...frame, rows: 11 })
    expect(frameWithEdges(weave, frame, ['top'], { row: 5, column: 10 })).toEqual({ ...frame, row: 4, rows: 13 })
  })

  it('steps an edge by a diamond across, or half a diamond down', () => {
    expect(frameWithEdgeStep(weave, frame, 'right', 1)).toEqual({ ...frame, columns: 13 })
    expect(frameWithEdgeStep(weave, frame, 'left', 1)).toEqual({ ...frame, column: 0, columns: 13 })
    expect(frameWithEdgeStep(weave, frame, 'bottom', 1)).toEqual({ ...frame, rows: 11 })
    expect(frameWithEdgeStep(weave, frame, 'top', 1)).toEqual({ ...frame, row: 4, rows: 13 })
    expect(frameWithEdgeStep(weave, { ...frame, columns: 5 }, 'right', -1)).toEqual({ ...frame, columns: 5 })
  })

  it('is resized to diamonds typed, each side growing evenly by whole diamonds', () => {
    // 3 diamonds across (13 columns) and 2 rows of them down (7 rows).
    expect(frameResizedAround(weave, frame, 3, 2)).toEqual({ row: 8, column: 4, rows: 7, columns: 13 })
    expect(frameResizedAround(weave, frame, 1, 1)).toMatchObject({ columns: 5, rows: 5 })
  })

  it('is sized to diamonds from its corner', () => {
    expect(frameWithSize(frame, 12, 8, weave)).toEqual({ ...frame, columns: 13, rows: 9 })
  })

  it('wraps what is drawn in whole diamonds', () => {
    const beads = withColors({}, [{ row: 5, column: 5, color: '#ff0000' }, { row: 9, column: 9, color: '#ff0000' }])
    expect(fitToDrawing({ ...weave, beads })).toEqual({ row: 4, column: 4, rows: 7, columns: 9 })
  })
})
