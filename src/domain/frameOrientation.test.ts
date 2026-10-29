import { describe, expect, it } from 'vitest'
import { colorAt, withColors } from './canvas'
import { changeFrame } from './changeFrame'
import { createProject } from './createProject'
import { footprintOf } from './footprint'
import { frameAllows, removedBeadsOf } from './frameShape'
import { laidFrame, laidSize, seenSize } from './frameOrientation'
import { layerAt } from './layers'
import { mayPlace } from './margin'
import type { Project } from './project'
import { removeLineRefusal } from './removeLine'
import { rotateFrame } from './rotate'
import { shownWay } from './rowProgress'
import { copyLayerSelection, paintLayerSelection, pasteOnLayer } from './selection'
import { wordChartOf } from './wordChart'

// A Frame's orientation (ticket 0667, ADR 0079): Rotate Frame turns the Frame like a sheet on the Canvas, its beads in
// their own rows and columns, and everything that works on the Frame as it lies follows the turn.

const RED = '#e63746'
const GREEN = '#27ae60'
const BLUE = '#2f6fed'
const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } })
/** A loom Frame of 4 rows and 6 columns at (20, 20), a red bead in its first, turned once: it lies 6 x 4 at (19, 21). */
const upright: Project = { ...base, beads: {}, frame: { technique: 'loom', row: 20, column: 20, rows: 4, columns: 6, beads: withColors({}, [{ row: 0, column: 0, color: RED }]) } }
const turned = rotateFrame(upright)!

describe('what a turned Frame covers', () => {
  it('lies in its own rows and columns turned, Width and Height swapped as seen', () => {
    expect(laidFrame(turned)).toEqual({ row: 19, column: 21, rows: 6, columns: 4 })
    expect(seenSize(turned.frame!)).toEqual({ columns: 4, rows: 6 })
    expect(laidFrame(upright)).toBe(upright.frame)
  })

  it('covers on peyote the rows its turned beads reach, which are not its own count', () => {
    const frame = { technique: 'peyote' as const, rows: 5, columns: 4, quarterTurns: 1 as const }
    // Five peyote rows nest to 4 beads tall: turned, 4 wide; four beads and a half shift across: turned, 4.5 tall.
    expect(laidSize(frame)).toEqual({ columns: 4, rows: 6 })
  })

  it('hides the Canvas and keeps the margin round what it covers, not round its own rows and columns', () => {
    expect(footprintOf(turned)).toEqual({ row: 19, column: 21, rows: 6, columns: 4 })
    expect(layerAt(turned, { row: 24, column: 22 })).toBe('frame')
    expect(layerAt(turned, { row: 21, column: 25 })).toBe('canvas')
    expect(mayPlace(turned, { row: 21, column: 25 })).toBe(false)
    expect(mayPlace(turned, { row: 21, column: 29 })).toBe(true)
  })
})

describe('what a turned Frame offers', () => {
  it('turns, is selected on and woven otherwise; it is resized, has a line removed and is made again only upright', () => {
    for (const action of ['rotate', 'select', 'technique'] as const) expect(frameAllows(turned.frame, action)).toBe(true)
    for (const action of ['resize', 'remove-line', 'from-selection'] as const) {
      expect(frameAllows(turned.frame, action)).toBe(false)
      expect(frameAllows(upright.frame, action)).toBe(true)
    }
    expect(changeFrame(turned, { set: { row: 19, column: 21, rows: 5, columns: 6 } })).toEqual({ kind: 'refused', reason: 'not-offered' })
    expect(removeLineRefusal(turned, { top: 19, left: 21, rows: 1, columns: 6, layer: 'frame' })).toBe('no-line')
  })

  it('takes its beads with it on Remove Frame, as they no longer stand on Canvas positions', () => {
    expect(removedBeadsOf(turned.frame!)).toBe('removed')
    expect(removedBeadsOf(upright.frame!)).toBe('dropped')
    const removed = changeFrame(turned, { remove: true })
    expect(removed.kind === 'changed' && removed.project.beads).toEqual({})
  })
})

describe('a Selection and a Paste over a turned Frame', () => {
  it('fill the beads lying under the rectangle on screen', () => {
    // The laid rectangle's top row: on a quarter turn the Frame's first column, its rows from the last up.
    const painted = paintLayerSelection(turned, { top: 19, left: 21, rows: 1, columns: 4, layer: 'frame' }, BLUE)
    expect([3, 2, 1, 0].map((row) => colorAt(painted.frame!.beads, row, 0))).toEqual([BLUE, BLUE, BLUE, BLUE])
    expect(colorAt(painted.frame!.beads, 0, 1)).toBeNull()
  })

  it('lay a copy from the Canvas as it is seen', () => {
    const canvas = { ...turned, beads: withColors({}, [{ row: 0, column: 0, color: RED }, { row: 0, column: 1, color: GREEN }, { row: 0, column: 2, color: BLUE }]) }
    const block = copyLayerSelection(canvas, { top: 0, left: 0, rows: 1, columns: 3, layer: 'canvas' })!
    const pasted = pasteOnLayer(canvas, block, { row: 19, column: 21, layer: 'frame' })
    // Left to right across the top of the turned Frame: its first column, from its last row up.
    expect([3, 2, 1].map((row) => colorAt(pasted.frame!.beads, row, 0))).toEqual([RED, GREEN, BLUE])
  })
})

describe('Row progress on a turned Frame', () => {
  it('runs as its own rows do, turned with it', () => {
    expect(shownWay({ direction: 'rows' })).toBe('down')
    expect(shownWay({ direction: 'rows' }, 1)).toBe('left')
    expect(shownWay({ direction: 'columns' }, 1)).toBe('down')
    expect(shownWay({ direction: 'rows', reversed: true }, 3)).toBe('left')
  })

  it('puts Row 1 of the Word chart on the edge its first row lies along', () => {
    const lettered = { ...turned, letters: true }
    expect(wordChartOf({ ...upright, letters: true })!.firstEdge).toBe('top')
    expect(wordChartOf(lettered)!.firstEdge).toBe('right')
    expect(wordChartOf(lettered)!.rows).toHaveLength(4)
  })
})
