// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createProject } from './createProject'
import type { Cell, Project } from './project'
import { BEAD_CATALOG } from './beads'
import type { Technique } from './weave'
import { fillAt } from '../testUtils/layers'
import { frameGrid, withFrameGrid } from '../testUtils/frameGrid'
import { beadBounds, beadCount, colorAt, frameContains, withColors, type BeadChange, type BeadMap, type Rect } from './canvas'
import { fillArea } from './fill'
import type { GridPosition } from './grid'
import { gridGeometry } from './layerGeometry'
import type { LayerSheet } from './layers'
import { BRICK_BLOCK_SETTING, type Weave } from './weave'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!

describe('fillArea', () => {
  function makeGridProject(technique: Technique, grid: Cell[][]): Project {
    const base = createProject({
      technique,
      beadId: cubeBead.id,
      size: { width: grid[0]!.length * 1.5, height: grid.length * 1.5, unit: 'mm' },
    })
    return withFrameGrid(base, grid)
  }

  it('repaints every cell of the clicked color reachable through same-colored neighbors', () => {
    const project = makeGridProject('loom', [
      [{ color: 'red' }, { color: 'red' }, { color: 'blue' }],
      [{ color: 'red' }, { color: 'red' }, { color: 'blue' }],
      [{ color: 'blue' }, { color: 'blue' }, { color: 'blue' }],
    ])

    const filled = fillAt(project, 0, 0, 'green')

    expect(frameGrid(filled)[0]!.map((c) => c.color)).toEqual(['green', 'green', 'blue'])
    expect(frameGrid(filled)[1]!.map((c) => c.color)).toEqual(['green', 'green', 'blue'])
    expect(frameGrid(filled)[2]!.map((c) => c.color)).toEqual(['blue', 'blue', 'blue'])
  })

  it('does not spill across a differently-colored boundary', () => {
    const project = makeGridProject('loom', [
      [{ color: 'red' }, { color: 'blue' }],
      [{ color: 'red' }, { color: 'blue' }],
    ])

    const filled = fillAt(project, 0, 0, 'green')

    expect(frameGrid(filled)[0]![1]!.color).toBe('blue')
    expect(frameGrid(filled)[1]![1]!.color).toBe('blue')
  })

  it('returns the same project instance, unchanged, when the clicked cell already has the fill color', () => {
    const project = makeGridProject('loom', [
      [{ color: 'red' }, { color: 'red' }],
      [{ color: 'red' }, { color: 'red' }],
    ])

    expect(fillAt(project, 0, 0, 'red')).toBe(project)
  })

  it('does not mutate the original project', () => {
    const project = makeGridProject('loom', [
      [{ color: 'red' }, { color: 'red' }],
      [{ color: 'red' }, { color: 'red' }],
    ])

    fillAt(project, 0, 0, 'green')

    expect(frameGrid(project)[0]![0]!.color).toBe('red')
  })

  it("connects a diagonally-offset same-color cell for Peyote that a straight Loom grid would not", () => {
    const grid: Cell[][] = [
      [{ color: null }, { color: 'red' }],
      [{ color: 'red' }, { color: null }],
    ]

    const loomFilled = fillAt(makeGridProject('loom', grid), 0, 1, 'green')
    const peyoteFilled = fillAt(makeGridProject('peyote', grid), 0, 1, 'green')

    // Loom: (0,1)'s only straight neighbor below is (1,1), which is unpainted, so (1,0) stays red.
    expect(frameGrid(loomFilled)[1]![0]!.color).toBe('red')
    // Peyote: row 1 is shifted right, so (0,1) overlaps (1,0) and (1,1) below it, reaching the red cell.
    expect(frameGrid(peyoteFilled)[1]![0]!.color).toBe('green')
  })
})

// Ticket 0677: Fill floods a row span at a time. It must reach exactly the beads a flood from neighbour to neighbour
// reaches, in every Weave of rows, on the open Canvas (its limit one position round the beads) and in a Frame (its edge).
describe('fillArea floods the same beads as one neighbour at a time', () => {
  const COLORS = ['#111111', '#222222', null] as const
  const WEAVES: Weave[] = [
    { technique: 'loom' },
    { technique: 'peyote' },
    { technique: 'brick' },
    { technique: 'brick', techniqueSettings: { [BRICK_BLOCK_SETTING.id]: 3 } },
  ]

  /** A seeded jumble of two colors and gaps over a block, its four corners painted so the beads' box is the block. */
  function jumble(seed: number, block: Rect): BeadMap {
    let state = seed
    const next = () => ((state = (state * 1103515245 + 12345) % 2147483648) / 2147483648)
    const changes: BeadChange[] = []
    for (let row = block.row; row < block.row + block.rows; row += 1) {
      for (let column = block.column; column < block.column + block.columns; column += 1) {
        const corner = (row === block.row || row === block.row + block.rows - 1) && (column === block.column || column === block.column + block.columns - 1)
        changes.push({ row, column, color: corner ? '#111111' : COLORS[Math.floor(next() * 2.6)]! })
      }
    }
    return withColors({}, changes)
  }

  /** The region a flood through `neighbors` reaches, one position at a time, inside `limit` (the reference). */
  function referenceFill({ beads, geometry }: LayerSheet, start: GridPosition, limit: Rect, color: string | null): BeadMap {
    const target = colorAt(beads, start.row, start.column)
    const seen = new Set<string>()
    const region: BeadChange[] = []
    const stack = [start]
    while (stack.length > 0) {
      const position = stack.pop()!
      const key = `${position.row},${position.column}`
      if (seen.has(key)) continue
      seen.add(key)
      if (!frameContains(limit, position) || !geometry.hasPosition(position) || colorAt(beads, position.row, position.column) !== target) continue
      region.push({ ...position, color })
      stack.push(...geometry.neighbors(position))
    }
    return withColors(beads, region)
  }

  for (const weave of WEAVES) {
    const name = `${weave.technique}${weave.techniqueSettings ? ' in blocks of 3' : ''}`

    it(`on the open Canvas in ${name}, stopping one position round the beads`, () => {
      const block = { row: -7, column: 3, rows: 12, columns: 15 }
      const limit = { row: block.row - 1, column: block.column - 1, rows: block.rows + 2, columns: block.columns + 2 }
      // A press outside the beads widens the limit to take it in: (-9, 0) puts its top-left corner at (-10, -1).
      const wider = { row: -10, column: -1, rows: 16, columns: 20 }
      for (let seed = 1; seed <= 12; seed += 1) {
        const sheet: LayerSheet = { beads: jumble(seed, block), weave, geometry: gridGeometry(weave) }
        expect(fillArea(sheet, -9, 0, '#333333')).toEqual(referenceFill(sheet, { row: -9, column: 0 }, wider, '#333333'))
        for (const start of [{ row: -3, column: 8 }, { row: 2, column: 12 }, { row: -7, column: 3 }]) {
          expect(fillArea(sheet, start.row, start.column, '#333333')).toEqual(referenceFill(sheet, start, limit, '#333333'))
          expect(fillArea(sheet, start.row, start.column, null)).toEqual(referenceFill(sheet, start, limit, null))
        }
      }
    })

    it(`in a Frame in ${name}, stopping at its edge`, () => {
      const edge = { row: 0, column: 0, rows: 9, columns: 11 }
      for (let seed = 1; seed <= 12; seed += 1) {
        const sheet: LayerSheet = { beads: jumble(seed, edge), weave, geometry: gridGeometry(weave, edge), edge }
        for (const start of [{ row: 0, column: 0 }, { row: 4, column: 5 }, { row: 8, column: 10 }]) {
          expect(fillArea(sheet, start.row, start.column, '#333333')).toEqual(referenceFill(sheet, start, edge, '#333333'))
        }
      }
    })
  }

  it('fills a Frame left empty from edge to edge, and no further', () => {
    const edge = { row: 0, column: 0, rows: 3, columns: 4 }
    const weave: Weave = { technique: 'brick' }
    const filled = fillArea({ beads: {}, weave, geometry: gridGeometry(weave, edge), edge }, 1, 1, '#333333')

    expect(beadCount(filled)).toBe(12)
    expect(beadBounds(filled)).toEqual(edge)
  })

  it('in brick, reaches the bead below a shifted row on its right but not on its left', () => {
    const weave: Weave = { technique: 'brick' }
    // Row 1 is shifted right by half a bead, so (0, 1) touches (1, 0) and (1, 1), and (1, 0) touches (0, 0) and (0, 1).
    const beads = withColors({}, [
      { row: 0, column: 1, color: '#111111' },
      { row: 1, column: 0, color: '#111111' },
      { row: 0, column: 3, color: '#111111' },
      { row: 1, column: 4, color: '#111111' },
    ])
    const filled = fillArea({ beads, weave, geometry: gridGeometry(weave) }, 0, 1, '#333333')

    expect(filled).toEqual({ 0: { 1: '#333333', 3: '#111111' }, 1: { 0: '#333333', 4: '#111111' } })
  })
})
