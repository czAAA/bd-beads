// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { beadCount, colorAt, type FrameSheet, withColors } from './canvas'
import { changeFrame, type FrameChange } from './changeFrame'
import { cellOfBead } from './customSelection'
import { customFrameSize, frameLayoutOf, type FrameShapeId } from './frameShape'
import { layerSheet, onLayer, positionOnCanvas } from './layers'
import { parseProjectsFile, serializeProject } from './projectFile'
import { canvasDistance } from './layerWeave'
import { createProject } from './createProject'
import { isInFinishedRow, keepFinishedRows, moveToRow, rowProgressStarted } from './rowProgress'
import { paintCells } from './drawing'
import type { Project } from './project'
import { rotateFrame, rotateLayerSelection } from './rotate'
import { copyLayerSelection, paintLayerSelection, pasteLostCount, pasteOnLayer, pastedCellsOnLayer, selectAllSelection, type Selection } from './selection'
import { beadsOfLayer, frameOf, withFrameSheet } from './layerRecord'
import { withFields } from '../testUtils/flatFields'

const RED = '#ff0000'
const BLUE = '#0000ff'

const open = (): Project => {
  const project = withFrameSheet(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 4, unit: 'beads' } }), undefined)
  return project
}

function changed(project: Project, change: FrameChange): Project {
  const result = changeFrame(project, change)
  if (result.kind !== 'changed') throw new Error(`expected a change, got ${JSON.stringify(result)}`)
  return result.project
}

const custom = (shape: FrameShapeId, size: number) => changed(open(), { custom: { shape, size, centre: { row: 20, column: 30 } } })

/** Paints Frame positions (round, place in round) as a press on the Frame does. */
const paintFrame = (project: Project, positions: { row: number; column: number }[], color: string | null) =>
  onLayer(project, 'frame', (view) => paintCells(view, positions, color))

/** Every position of the Frame's layout, by name. */
const allPositions = (project: Project) => frameLayoutOf(frameOf(project)!)!.positions.map(({ row, column }) => ({ row, column }))

/** The Selection Select all makes over the Frame. */
const everything = (project: Project): Selection => selectAllSelection(beadsOfLayer(project, 'canvas'), frameOf(project))!

/** A Selection of the Frame's cells, counted from its first row and column. */
const ofFrame = (project: Project, top: number, left: number, rows: number, columns: number): Selection => ({ top: frameOf(project)!.row + top, left: frameOf(project)!.column + left, rows, columns, layer: 'frame' })

/** The Canvas cell a Paste aims at to land its anchor on a bead of the Frame. */
const aimedAt = (project: Project, bead: { row: number; column: number }) => ({ ...positionOnCanvas(project, 'frame', cellOfBead(layerSheet(project, 'frame'), bead)), layer: 'frame' as const })

describe('a Selection over a Custom frame (ticket 0594)', () => {
  it('fills and clears every bead of the shape when it holds the whole Frame, from any panel', () => {
    const project = custom('triangle', 4)
    const filled = paintLayerSelection(project, everything(project), RED)
    expect(beadCount(frameOf(filled)!.beads)).toBe(allPositions(project).length)
    expect(beadCount(frameOf(paintLayerSelection(filled, everything(project), null))!.beads)).toBe(0)
  })

  it('holds the beads whose centres lie in the rectangle on screen, and none outside it', () => {
    const project = custom('warpedSquare', 5)
    const { rows, columns } = frameOf(project)!
    const filled = paintLayerSelection(project, ofFrame(project, 0, 0, Math.floor(rows / 2), columns), RED)
    const layout = frameLayoutOf(frameOf(project)!)!
    const painted = layout.positions.filter(({ row, column }) => colorAt(frameOf(filled)!.beads, row, column) === RED)
    expect(painted.length).toBeGreaterThan(0)
    expect(painted.length).toBeLessThan(layout.positions.length)
    // The top half on screen: every painted bead above every bead left empty.
    const lowestPainted = Math.max(...painted.map(({ y }) => y))
    const highestEmpty = Math.min(...layout.positions.filter((position) => !painted.includes(position)).map(({ y }) => y))
    expect(lowestPainted).toBeLessThan(highestEmpty)
  })
})

/** A Copy's anchor: its first painted bead in reading order on screen. */
function anchorOf(project: Project) {
  const layout = frameLayoutOf(frameOf(project)!)!
  return layout.positions.filter(({ row, column }) => colorAt(frameOf(project)!.beads, row, column)).sort((a, b) => a.y - b.y || a.x - b.x)[0]!
}

describe('Copy and Paste on a Custom frame (ticket 0594)', () => {
  /** A Star with a few beads of two colours on two of its arms. */
  const painted = () => paintFrame(paintFrame(custom('star', 4), [{ row: 3, column: 0 }, { row: 3, column: 1 }, { row: 2, column: 0 }], RED), [{ row: 3, column: 16 }, { row: 1, column: 8 }], BLUE)

  it('keeps each bead\'s place on screen: pasted back where it was, every bead lands on its own position', () => {
    const project = painted()
    const block = copyLayerSelection(project, everything(project))!
    expect(block.points).toHaveLength(5)
    const cleared = paintLayerSelection(project, everything(project), null)
    const pasted = pasteOnLayer(cleared, block, aimedAt(project, anchorOf(project)))
    expect(frameOf(pasted)!.beads).toEqual(frameOf(project)!.beads)
    expect(pasteLostCount(cleared, block, aimedAt(project, anchorOf(project)))).toEqual({ count: 0, loss: 'shape' })
  })

  it('drops the beads that land on a Seam or Off-shape, and counts them', () => {
    const project = painted()
    const block = copyLayerSelection(project, everything(project))!
    // Aimed at the Frame's top left corner, Off-shape: the block's beads reach past the shape.
    const corner = { row: frameOf(project)!.row, column: frameOf(project)!.column, layer: 'frame' as const }
    const lost = pasteLostCount(project, block, corner)
    expect(lost.loss).toBe('shape')
    expect(lost.count).toBeGreaterThan(0)
    const pasted = pasteOnLayer(paintLayerSelection(project, everything(project), null), block, corner)
    expect(beadCount(frameOf(pasted)!.beads)).toBe(5 - lost.count)
  })

  it('previews the beads a Paste would put down, by the Frame\'s own names', () => {
    const project = painted()
    const block = copyLayerSelection(project, everything(project))!
    const at = aimedAt(project, anchorOf(project))
    const preview = pastedCellsOnLayer(project, block, at)
    expect(preview).toHaveLength(5)
    expect(preview.every((cell) => cell.layer === 'frame')).toBe(true)
  })

  it('pastes a Custom frame\'s copy onto the Canvas as a block of beads, and a Canvas block onto the shape', () => {
    const project = painted()
    const block = copyLayerSelection(project, everything(project))!
    const onCanvas = pasteOnLayer(project, block, { row: 100, column: 100 })
    expect(beadCount(beadsOfLayer(onCanvas, 'canvas'))).toBe(5)

    // Two beads side by side on the loom Canvas, pasted on a Warped Square's straight side away from its Seams.
    const square = custom('warpedSquare', 5)
    const canvasPainted = withFields(square, { beads: withColors({}, [{ row: 100, column: 100, color: RED }, { row: 100, column: 101, color: BLUE }]) })
    const fromCanvas = copyLayerSelection(canvasPainted, { top: 100, left: 100, rows: 1, columns: 2, layer: 'canvas' })!
    const landed = pasteOnLayer(square, fromCanvas, aimedAt(square, { row: 3, column: 1 }))
    expect(beadCount(frameOf(landed)!.beads)).toBe(2)
    expect(colorAt(frameOf(landed)!.beads, 3, 1)).toBe(RED)
  })
})

describe('Rotate on a Custom frame (ticket 0594)', () => {
  it('turns a Warped Square\'s beads a quarter onto its own positions, each round onto itself, none dropped', () => {
    const project = paintFrame(custom('warpedSquare', 4), [{ row: 3, column: 0 }, { row: 3, column: 1 }, { row: 1, column: 2 }], RED)
    const turned = rotateLayerSelection(project, everything(project))
    expect(turned.dropped).toBe(0)
    expect(beadCount(frameOf(turned.project)!.beads)).toBe(3)
    const rounds = (beads: FrameSheet | undefined) => allPositions(project).filter(({ row, column }) => colorAt(beads!.beads, row, column)).map(({ row }) => row).sort()
    expect(rounds(frameOf(turned.project))).toEqual([1, 3, 3])
    expect(frameOf(turned.project)!.beads).not.toEqual(frameOf(project)!.beads)
    expect(turned.selection.layer).toBe('frame')
  })

  it('counts what a turn drops on a Seam or Off-shape, and what it lands on', () => {
    const project = paintFrame(custom('triangle', 6), allPositions(custom('triangle', 6)).filter(({ row }) => row >= 4), RED)
    const turned = rotateLayerSelection(project, everything(project))
    expect(turned.dropped).toBeGreaterThan(0)
    expect(beadCount(frameOf(turned.project)!.beads) + turned.dropped).toBe(beadCount(frameOf(project)!.beads))
  })
})

describe('Rotate Frame on a Custom frame (ticket 0594)', () => {
  it('turns the layout a quarter with its beads, swapping its sides round the same centre', () => {
    const project = paintFrame(custom('kite', 12), [{ row: 4, column: 0 }], RED)
    const turned = rotateFrame(project)!
    const before = frameOf(project)!
    const after = frameOf(turned)!
    expect(after).toMatchObject({ shape: 'kite', quarterTurns: 1, beads: before.beads })
    expect({ rows: after.rows, columns: after.columns }).toEqual(customFrameSize('kite', { rows: 12 }, 1))
    const turnedLayout = frameLayoutOf(after)!
    const layout = frameLayoutOf(before)!
    expect(turnedLayout.width).toBeCloseTo(layout.height)
    expect(turnedLayout.positions[0]!.angle).toBeCloseTo(layout.positions[0]!.angle + Math.PI / 2)
    const centre = (frame: typeof before) => frame.row + canvasDistance(project, frame, frame.rows / 2, frame.columns / 2).row
    expect(Math.abs(centre(after) - centre(before))).toBeLessThanOrEqual(1)
  })

  it('comes back as it was after four turns, and keeps its turn through the Project file', () => {
    const project = custom('star', 3)
    const once = rotateFrame(project)!
    expect(parseProjectsFile(serializeProject(once)).projects).toEqual([once])
    const four = [1, 2, 3].reduce((turned) => rotateFrame(turned)!, once)
    expect(frameOf(four)!.quarterTurns).toBeUndefined()
    expect({ rows: frameOf(four)!.rows, columns: frameOf(four)!.columns }).toEqual({ rows: frameOf(project)!.rows, columns: frameOf(project)!.columns })
  })
})

describe('Row progress on a Custom frame (ticket 0594)', () => {
  it('locks the finished rounds against drawing, and holds the Frame still once a pass is done', () => {
    const project = moveToRow(custom('triangle', 4), 1)
    expect(rowProgressStarted(project)).toBe(true)
    const frame = frameOf(project)!
    expect(isInFinishedRow(project, { row: frame.row, column: frame.column + 2, layer: 'frame' })).toBe(true)
    expect(isInFinishedRow(project, { row: frame.row + 1, column: frame.column + 2, layer: 'frame' })).toBe(false)
    // A place past the Frame's columns is still a bead of round 3.
    expect(isInFinishedRow(moveToRow(project, 4), { row: frame.row + 3, column: frame.column + 11, layer: 'frame' })).toBe(true)
    const painted = paintFrame(project, [{ row: 0, column: 1 }, { row: 2, column: 1 }], RED)
    const kept = keepFinishedRows(project, painted)
    expect(colorAt(frameOf(kept)!.beads, 0, 1)).toBeNull()
    expect(colorAt(frameOf(kept)!.beads, 2, 1)).toBe(RED)
  })
})
