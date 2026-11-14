import { describe, expect, it } from 'vitest'
import { bareProject } from '../testUtils/layerFields'
import { marginSheetPx } from './projectRenderer'
import { sameWorkBoxes, workBoxesOf } from './workBoxes'

// Grid focus's work (ticket 1002, BeadBoard card): the Frame's margin sheet and each Piece area on the Canvas.

describe('workBoxesOf', () => {
  it('is nothing with no bead and no Frame', () => {
    expect(workBoxesOf(bareProject({ beads: {}, technique: 'loom' }))).toEqual([])
  })

  it('gives a bead painted far from the rest its own box, beside the other Piece\'s', () => {
    const one = bareProject({ beads: { 0: { 0: '#ff0000', 1: '#ff0000' } }, technique: 'loom' })
    const two = bareProject({ beads: { 0: { 0: '#ff0000', 1: '#ff0000' }, 40: { 60: '#00ff00' } }, technique: 'loom' })
    expect(workBoxesOf(one)).toHaveLength(1)
    const boxes = workBoxesOf(two)
    expect(boxes).toHaveLength(2)
    expect(boxes[0]).toEqual(workBoxesOf(one)[0])
    expect(boxes[1]!.x).toBeGreaterThan(boxes[0]!.x + 1000)
  })

  it('holds the Frame\'s margin sheet, with no bead too', () => {
    const framed = bareProject({ beads: {}, technique: 'loom', frame: { technique: 'loom', row: 0, column: 0, rows: 4, columns: 4, beads: {} } })
    expect(workBoxesOf(framed)).toEqual([marginSheetPx(framed)!.sheet])
  })
})

describe('sameWorkBoxes', () => {
  it('tells boxes apart by place and size, not by identity', () => {
    const box = { x: 0, y: 0, width: 20, height: 20 }
    expect(sameWorkBoxes([box], [{ ...box }])).toBe(true)
    expect(sameWorkBoxes([box], [{ ...box, width: 40 }])).toBe(false)
    expect(sameWorkBoxes([box], [])).toBe(false)
  })
})
