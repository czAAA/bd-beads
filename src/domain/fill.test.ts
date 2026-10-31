// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createProject } from './createProject'
import type { Cell, Project } from './project'
import { BEAD_CATALOG } from './beads'
import { beadBounds, beadCount, colorAt, frameContains, withColors, type BeadChange, type BeadMap, type Rect } from './canvas'
import { fillArea } from './fill'
import type { GridPosition } from './grid'
import { gridGeometry } from './layerGeometry'
import type { LayerSheet } from './layers'
import { BRICK_DROP_SETTING, type Technique, type Weave } from './weave'
import { fillAt } from '../testUtils/layers'
import { frameGrid, withFrameGrid } from '../testUtils/frameGrid'
import { frameSheetOf, withLayers } from '../testUtils/layerFields'
import { layerOf } from './layerRecord'

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
    // Peyote: column 1 hangs half a bead lower, so (0,1) overlaps (0,0) and (1,0) beside it, reaching the red cell.
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
    { technique: 'peyote', techniqueSettings: { peyoteDrop: 2 } },
    { technique: 'brick' },
    { technique: 'brick', techniqueSettings: { [BRICK_DROP_SETTING.id]: 3 } },
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

  /** Far wider than anything a test draws: a flood through beads that nothing stops. */
  const EVERYWHERE: Rect = { row: -1e6, column: -1e6, rows: 2e6, columns: 2e6 }

  /** Whether the empty region joined to `start`, flooded within the screen, has an empty neighbour off it. */
  function reachesPast(sheet: LayerSheet, start: GridPosition, onScreen: Rect): boolean {
    const region = referenceFill(sheet, start, onScreen, '#999999')
    return Object.entries(region).some(([row, beads]) =>
      Object.entries(beads).some(([column, color]) =>
        color === '#999999' &&
        sheet.geometry.neighbors({ row: Number(row), column: Number(column) }).some((next) => !frameContains(onScreen, next) && colorAt(sheet.beads, next.row, next.column) === null)))
  }

  for (const weave of WEAVES) {
    const name = `${weave.technique}${weave.techniqueSettings ? ' in blocks of 3' : ''}`

    it(`on the open Canvas in ${name}: through beads as far as they go, into empty space only an enclosed hole`, () => {
      const block = { row: -7, column: 3, rows: 12, columns: 15 }
      const onScreen = { row: block.row - 3, column: block.column - 3, rows: block.rows + 6, columns: block.columns + 6 }
      // Each kind of press is met at least once: on a bead, in an enclosed hole, in open space.
      const met = { bead: 0, hole: 0, open: 0 }
      for (let seed = 1; seed <= 12; seed += 1) {
        const sheet: LayerSheet = { beads: jumble(seed, block), weave, geometry: gridGeometry(weave) }
        for (let row = block.row; row < block.row + block.rows; row += 2) {
          for (let column = block.column; column < block.column + block.columns; column += 3) {
            const start = { row, column }
            for (const color of ['#333333', null]) {
              const filled = fillArea(sheet, row, column, color, { onScreen })
              if (colorAt(sheet.beads, row, column) !== null) {
                met.bead += 1
                expect(filled).toEqual(referenceFill(sheet, start, EVERYWHERE, color))
              } else if (color !== null) {
                const open = reachesPast(sheet, start, onScreen)
                met[open ? 'open' : 'hole'] += 1
                expect(filled).toEqual(open ? 'open' : referenceFill(sheet, start, onScreen, color))
              }
            }
          }
        }
      }
      expect(Object.values(met).every((count) => count > 0)).toBe(true)
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

  it('in peyote, reaches the bead beside a shifted column below it but not above it (ticket 0734)', () => {
    const weave: Weave = { technique: 'peyote' }
    // Column 1 hangs half a bead lower, so (1, 0) touches (0, 1) and (1, 1), and (0, 1) touches (0, 0) and (1, 0).
    const beads = withColors({}, [
      { row: 1, column: 0, color: '#111111' },
      { row: 0, column: 1, color: '#111111' },
      { row: 3, column: 0, color: '#111111' },
      { row: 4, column: 1, color: '#111111' },
    ])
    const filled = fillArea({ beads, weave, geometry: gridGeometry(weave) }, 1, 0, '#333333')

    expect(filled).toEqual({ 0: { 1: '#333333' }, 1: { 0: '#333333' }, 3: { 0: '#111111' }, 4: { 1: '#111111' } })
  })
})

// Ticket 0715: Fill reach. Through beads a Fill goes as far as they are joined; into empty space it fills only a hole
// the screen holds whole; past the Fill cap it changes nothing. Positions on screen are given by the caller.
describe('Fill reach on the open Canvas', () => {
  const INK = '#111111'
  const FILL = '#333333'
  const SCREEN: Rect = { row: 0, column: 0, rows: 40, columns: 60 }

  /** The outline of a rectangle of positions, one bead wide: closed in every Technique, as rows nest. */
  function outline({ row, column, rows, columns }: Rect): BeadChange[] {
    const changes: BeadChange[] = []
    for (let at = column; at < column + columns; at += 1) changes.push({ row, column: at, color: INK }, { row: row + rows - 1, column: at, color: INK })
    for (let at = row + 1; at < row + rows - 1; at += 1) changes.push({ row: at, column, color: INK }, { row: at, column: column + columns - 1, color: INK })
    return changes
  }

  function block({ row, column, rows, columns }: Rect, color = INK): BeadChange[] {
    return Array.from({ length: rows * columns }, (_cell, index) => ({ row: row + Math.floor(index / columns), column: column + (index % columns), color }))
  }

  function canvas(technique: Technique, changes: BeadChange[]): LayerSheet {
    const weave: Weave = { technique }
    return { beads: withColors({}, changes), weave, geometry: gridGeometry(weave) }
  }

  for (const technique of ['loom', 'peyote', 'brick'] as const) {
    describe(technique, () => {
      it('fills a hole in a Piece, inside and no further', () => {
        const ring = { row: 10, column: 10, rows: 8, columns: 12 }
        const sheet = canvas(technique, outline(ring))

        const filled = fillArea(sheet, 13, 15, FILL, { onScreen: SCREEN })

        expect(filled).toEqual(withColors(sheet.beads, block({ row: 11, column: 11, rows: 6, columns: 10 }, FILL)))
      })

      it('refuses a hole wider than the screen as open space: nothing changes', () => {
        const sheet = canvas(technique, outline({ row: -5, column: -5, rows: 50, columns: 70 }))

        expect(fillArea(sheet, 20, 30, FILL, { onScreen: SCREEN })).toBe('open')
      })

      it('refuses a press in open space between two Pieces', () => {
        const sheet = canvas(technique, [...block({ row: 10, column: 5, rows: 10, columns: 10 }), ...block({ row: 10, column: 40, rows: 10, columns: 10 })])

        expect(fillArea(sheet, 15, 25, FILL, { onScreen: SCREEN })).toBe('open')
      })

      it('refuses empty space when nothing is known to be on screen', () => {
        const sheet = canvas(technique, outline({ row: 10, column: 10, rows: 8, columns: 12 }))

        expect(fillArea(sheet, 13, 15, FILL)).toBe('open')
      })

      it('recolours a Piece larger than the screen whole', () => {
        const piece = { row: -20, column: -30, rows: 80, columns: 120 }
        const sheet = canvas(technique, block(piece))

        const filled = fillArea(sheet, 5, 5, FILL, { onScreen: SCREEN })

        expect(filled).toEqual(withColors({}, block(piece, FILL)))
      })

      it('refuses a Piece over the Fill cap as too big, and fills one at the cap', () => {
        const sheet = canvas(technique, block({ row: 0, column: 0, rows: 10, columns: 10 }))

        expect(fillArea(sheet, 5, 5, FILL, { onScreen: SCREEN, cap: 99 })).toBe('too-big')
        expect(beadCount(fillArea(sheet, 5, 5, FILL, { onScreen: SCREEN, cap: 100 }) as BeadMap)).toBe(100)
      })

      it('refuses an enclosed hole over the Fill cap as too big', () => {
        const sheet = canvas(technique, outline({ row: 10, column: 10, rows: 8, columns: 12 }))

        expect(fillArea(sheet, 13, 15, FILL, { onScreen: SCREEN, cap: 59 })).toBe('too-big')
      })

      it('in a Frame, fills from edge to edge whatever is on screen, past the cap', () => {
        const edge = { row: 0, column: 0, rows: 30, columns: 40 }
        const weave: Weave = { technique }
        const filled = fillArea({ beads: {}, weave, geometry: gridGeometry(weave, edge), edge }, 1, 1, FILL, { onScreen: { row: 0, column: 0, rows: 2, columns: 2 }, cap: 10 })

        expect(beadCount(filled as BeadMap)).toBe(1200)
      })
    })
  }

  // The maintainer's drawing on 2026-10-29 once the runaway Fill was taken out (`reports/fixtures/` in the docs repo):
  // its 50 Canvas beads at the same positions, in made-up colors, beside its 40 × 11 Frame.
  const FREEZE_DRAWING: Record<number, number[]> = {
    [-71]: [17, 18],
    [-70]: [16, 17, 19],
    [-69]: [16, 19],
    [-68]: [16, 19],
    [-67]: [16, 19],
    [-66]: [15, 16, 19],
    [-65]: [15, 16, 17, 18, 19],
    [-64]: [15, 16, 18, 19],
    [-63]: [15, 16, 19],
    [-62]: [16, 19],
    [-61]: [16, 18, 19],
    [-60]: [16, 17, 18],
    [-59]: [17, 18],
    [-14]: [-23, -22, -21, -20, -19, -18, -17],
    [-2]: [-17, -16, -15, -14, -13, -12, -11],
  }

  function freezeProject(): Project {
    const base = createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 40, height: 11, unit: 'beads' } })
    const changes = Object.entries(FREEZE_DRAWING).flatMap(([row, columns]) => columns.map((column) => ({ row: Number(row), column, color: '#e63746' })))
    return withLayers(base, { beads: withColors({}, changes), frame: { ...frameSheetOf(base)!, row: -74, column: 275 } })
  }

  it('on the drawing that froze, a press 1,000 positions away changes nothing, a screen wide at the Zoom floor', () => {
    const project = freezeProject()
    expect(beadCount(layerOf(project, 'canvas').beads)).toBe(50)
    const press = { row: -40, column: -1000 }
    // At the 10% Zoom floor a screen is about 1,000 positions wide: one round the press, and one from it to the drawing.
    const screens = [{ row: -340, column: -1500, rows: 600, columns: 1000 }, { row: -340, column: -1010, rows: 600, columns: 1100 }]

    for (const onScreen of screens) {
      expect(fillAt(project, press.row, press.column, '#1a1a1a', { onScreen })).toBe(project)
    }
  })

  it('on the drawing that froze, a press in a hole of its outline fills the hole alone', () => {
    const project = freezeProject()

    const filled = fillAt(project, -68, 17, '#1a1a1a', { onScreen: { row: -340, column: -500, rows: 600, columns: 1000 } })

    expect(beadCount(layerOf(filled, 'canvas').beads)).toBe(59)
  })
})
