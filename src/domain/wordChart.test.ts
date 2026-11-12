import { describe, expect, it } from 'vitest'
import { changeFrame } from './changeFrame'
import { frameLayoutOf } from './frameShape'
import { onLayer } from './layers'
import { createProject } from './createProject'
import { paintCells } from './drawing'
import type { Project } from './project'
import type { Technique } from './weave'
import { wordChartOf } from './wordChart'
import { frameOf, withFrameSheet } from './layerRecord'
import { type LayersChange, withLayers } from '../testUtils/layerFields'

const HEX: Record<string, string> = { A: '#111111', B: '#222222', C: '#333333' }

/** A Frame of `rows` (a letter per bead, `.` for an empty cell), Letters on, each letter's hex kept as its own. */
function framed(technique: Technique, rows: string[], changes: LayersChange = {}): Project {
  const base = createProject({ technique, beadId: 'toho-cube-1.5mm', size: { width: rows[0].length, height: rows.length, unit: 'beads' } })
  const beads: Record<number, Record<number, string>> = {}
  rows.forEach((row, r) => {
    beads[r] = {}
    ;[...row].forEach((letter, c) => {
      if (letter !== '.') beads[r][c] = HEX[letter]
    })
  })
  return withLayers(base, { frame: { ...frameOf(base)!, beads }, letters: true, paletteLetters: { [HEX.A]: 'A', [HEX.B]: 'B', [HEX.C]: 'C' }, ...changes })
}

const lines = (project: Project) => wordChartOf(project)!.rows.map((row) => `${row.both ? '1&2' : row.number}${row.marker ? `(${row.marker})` : ''}: ${row.runs.map((run) => `${run.count}${run.letter ?? '*'}`).join(',')}`)

describe('Word chart (ticket 0574)', () => {
  it('has none with no Frame, and one with Letters off: Row by row asks for it (ticket 0916)', () => {
    expect(wordChartOf(withLayers(framed('loom', ['AB']), { frame: undefined }))).toBeUndefined()
    expect(lines(framed('loom', ['AB'], { letters: false }))).toEqual(['1: 1A,1B'])
  })

  it('writes a loom row per line, left to right, without a marker', () => {
    const chart = wordChartOf(framed('loom', ['AABCC', 'B.CCC']))!
    expect(lines(framed('loom', ['AABCC', 'B.CCC']))).toEqual(['1: 2A,1B,2C', '2: 1B,1*,3C'])
    expect(chart.firstEdge).toBe('top')
    expect(chart.lastNumber).toBe(2)
    expect(chart.hasEmpty).toBe(true)
  })

  it('numbers rows from the Frame\'s last line once rows run bottom to top, with Row 1 on the opposite edge', () => {
    const project = framed('loom', ['AB', 'CC'], { rowProgress: { direction: 'rows', reversed: true, currentRow: 0, currentColumn: 0 } })
    expect(lines(project)).toEqual(['1: 2C', '2: 1A,1B'])
    expect(wordChartOf(project)!.firstEdge).toBe('bottom')
  })

  it('alternates (L) and (R) on brick stitch and reads an (R) row from the right', () => {
    expect(lines(framed('brick', ['AAB', 'ABB', 'CCC']))).toEqual(['1(L): 2A,1B', '2(R): 2B,1A', '3(L): 3C'])
  })

  it('starts peyote with Rows 1&2 and one line per pass, an odd count 7, 4, 3 beads', () => {
    const project = framed('peyote', ['AAAAAAA', 'BBBBBBB'])
    const chart = wordChartOf(project)!
    expect(chart.count).toBe('odd')
    expect(lines(project)).toEqual(['1&2(L): 7A', '3(R): 4B', '4(L): 3B'])
    expect(chart.lastNumber).toBe(4)
  })

  it('counts an even peyote width and splits a pass at every other bead', () => {
    const project = framed('peyote', ['ABAB', 'AABB'])
    const chart = wordChartOf(project)!
    expect(chart.count).toBe('even')
    // Pass 1 takes the even positions (0 and 2) of line 1, pass 2 the odd ones.
    expect(lines(project)).toEqual(['1&2(L): 1A,1B,1A,1B', '3(R): 1B,1A', '4(L): 1A,1B'])
  })

  it('follows Row direction down the columns and says where the first row is', () => {
    const project = framed('loom', ['AB', 'AB', 'AB'], { rowProgress: { direction: 'columns', currentRow: 0, currentColumn: 0 } })
    expect(lines(project)).toEqual(['1: 3A', '2: 3B'])
    expect(wordChartOf(project)!.firstEdge).toBe('left')
  })

  it('moves the first row round the picture with the rotation and reads on screen left to right', () => {
    const turned = framed('loom', ['AAB'], { orientation: 180 })
    expect(wordChartOf(turned)!.firstEdge).toBe('bottom')
    expect(lines(turned)).toEqual(['1: 1B,2A'])
  })

  it.each<[0 | 90 | 180 | 270, 'rows' | 'columns', string, string]>([
    [0, 'rows', 'top', '1A,1B'],
    [90, 'rows', 'right', '1A,1B'],
    [180, 'rows', 'bottom', '1B,1A'],
    [270, 'rows', 'left', '1B,1A'],
    [0, 'columns', 'left', '1A,1C'],
    [90, 'columns', 'top', '1C,1A'],
    [180, 'columns', 'right', '1C,1A'],
    [270, 'columns', 'bottom', '1A,1C'],
  ])('at %s° with rows run %s puts Row 1 at the %s and reads %s', (rotation, direction, edge, runs) => {
    // The first line is A then B along the rows, and A then C down the columns.
    const project = framed('loom', ['AB', 'CC'], { orientation: rotation, rowProgress: { direction, currentRow: 0, currentColumn: 0 } })
    const chart = wordChartOf(project)!
    expect(chart.firstEdge).toBe(edge)
    expect(chart.rows[0]!.runs.map((run) => `${run.count}${run.letter}`).join(',')).toBe(runs)
  })
})

describe('Word chart of a Custom frame (ticket 0594)', () => {
  /** An open Canvas with a Custom frame of a Frame shape and size, Letters on, its beads painted A where `paint` says. */
  function shaped(shape: 'triangle' | 'warpedSquare' | 'kite' | 'star' | 'kaleidocycle', size: number, paint: (position: { row: number; column: number }) => boolean, hex = HEX.A): Project {
    const open = withFrameSheet(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 4, unit: 'beads' } }), undefined)
    const placed = changeFrame(open, { custom: { shape, size, centre: { row: 20, column: 20 } } })
    if (placed.kind !== 'changed') throw new Error('expected a Custom frame')
    const painted = onLayer(placed.project, 'frame', (view) => paintCells(view, frameLayoutOf(frameOf(placed.project)!)!.positions.filter(paint), hex))
    return withLayers(painted, { letters: true, paletteLetters: { [HEX.A]: 'A', [HEX.B]: 'B' } })
  }
  const words = (project: Project) => wordChartOf(project)!.rows.map((row) => `${row.number} ${JSON.stringify(row.step)}: ${row.runs.map((run) => `${run.count}${run.letter ?? '*'}`).join(',')}`)

  it('lists a Triangle round by round from the centre, each round round the shape', () => {
    const chart = wordChartOf(shaped('triangle', 3, ({ column }) => column % 3 === 0))!
    expect(chart.start).toBe('centre')
    expect(chart.marked).toBe(false)
    expect(words(shaped('triangle', 3, ({ column }) => column % 3 === 0))).toEqual([
      '1 {"kind":"round","number":1}: 1*,1A,1*',
      '2 {"kind":"round","number":2}: 1*,1A,2*,1A,1*',
      '3 {"kind":"round","number":3}: 1*,1A,2*,1A,2*,1A,1*',
    ])
  })

  /** A round's sides as a beader reads them: `(pair)` and the singles' runs, sides apart. */
  const sided = (project: Project, number: number) => wordChartOf(project)!.rows[number - 1]!.sides?.map(({ corner, singles }) => [`(${corner.map((run) => `${run.count}${run.letter ?? '*'}`).join(' ')})`, ...singles.map((run) => `${run.count}${run.letter ?? '*'}`)].join(','))

  it('writes a Warped Square in one color side by side from its corner pairs (ticket 0873)', () => {
    const square = shaped('warpedSquare', 5, () => true)
    // Round 1 is the ring, a run with no pairs.
    expect(wordChartOf(square)!.rows[0]).toMatchObject({ runs: [{ count: 4, letter: 'A' }] })
    expect(sided(square, 1)).toBeUndefined()
    expect(sided(square, 2)).toEqual(['(2A)', '(2A)', '(2A)', '(2A)'])
    expect(sided(square, 3)).toEqual(['(2A),1A', '(2A),1A', '(2A),1A', '(2A),1A'])
    expect(sided(square, 5)).toEqual(['(2A),3A', '(2A),3A', '(2A),3A', '(2A),3A'])
  })

  it('writes a Triangle\'s round 4 as a pair and two singles, three times (ticket 0873)', () => {
    expect(sided(shaped('triangle', 4, () => true), 4)).toEqual(['(2A),2A', '(2A),2A', '(2A),2A'])
  })

  it('writes a pair of two colors with both, in the order they are picked up (ticket 0873)', () => {
    // Round 3 of a Triangle: the first side's beads are panel 0's, its pair's first bead the last panel's last.
    const triangle = shaped('triangle', 3, ({ row, column }) => row === 2 && column < 3, HEX.B)
    expect(sided(triangle, 3)).toEqual(['(1* 1B),1B', '(1B 1*),1*', '(2*),1*'])
  })

  it('writes a Kaleidocycle triangle\'s rounds side by side as a Triangle\'s (ticket 0873)', () => {
    const ring = shaped('kaleidocycle', 3, () => true)
    expect(wordChartOf(ring)!.rows[4]).toMatchObject({ step: { kind: 'round', number: 2, part: 2 } })
    expect(sided(ring, 5)).toEqual(['(2A)', '(2A)', '(2A)'])
    expect(sided(ring, 19)).toBeUndefined()
  })

  /** A Kite row as a beader reads it: its end, then its runs with the middle pair in brackets. */
  const across = (project: Project) =>
    wordChartOf(project)!.rows.map(({ marker, spine }) => `(${marker}) ${[...spine!.before.map(run), `(${spine!.pair.map(run).join(' ')})`, ...spine!.after.map(run)].join(',')}`)
  const run = ({ count, letter }: { count: number; letter: string | undefined }) => `${count}${letter ?? '*'}`

  it('lists a Kite row by row from its point, back and forth, each row round its middle pair (ticket 0874)', () => {
    const chart = wordChartOf(shaped('kite', 5, () => true))!
    expect(chart.start).toBe('point')
    expect(chart.marked).toBe(true)
    expect(across(shaped('kite', 5, () => true))).toEqual(['(L) (2A)', '(R) (2A)', '(L) 1A,(2A),1A', '(R) 1A,(2A),1A', '(L) 2A,(2A),2A'])
    expect(chart.rows.map(({ runs }) => runs)).toEqual([2, 2, 4, 4, 6].map((count) => [{ count, letter: 'A' }]))
  })

  it('reads a Kite row from the wing it starts at: the left wing first on an odd row, the right on an even one (ticket 0874)', () => {
    // The right wing painted: an odd row ends on it, an even row starts on it, a pair of two colors read in that order.
    const kite = shaped('kite', 4, ({ column }) => column % 2 === 1, HEX.B)
    expect(across(kite)).toEqual(['(L) (1* 1B)', '(R) (1B 1*)', '(L) 1*,(1* 1B),1B', '(R) 1B,(1B 1*),1*'])
  })

  it('lists a Fringe earring\'s top from its base row up, then each strand from the top down (ticket 0597)', () => {
    const open = withFrameSheet(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 4, unit: 'beads' } }), undefined)
    const placed = changeFrame(open, { custom: { shape: 'fringeEarring', settings: { topWidth: 3, topRows: 2, fringeStyle: 'v', fringeLength: 3 }, centre: { row: 20, column: 20 } } })
    if (placed.kind !== 'changed') throw new Error('expected a Custom frame')
    // The strands' last beads painted, a drop at each tip.
    const tips = frameLayoutOf(frameOf(placed.project)!)!.positions.filter(({ row, column }) => row === 1000 + (column === 1 ? 2 : 0))
    const project = withLayers(onLayer(placed.project, 'frame', (view) => paintCells(view, tips, HEX.A)), { letters: true, paletteLetters: { [HEX.A]: 'A' } })
    expect(wordChartOf(project)!.start).toBe('base')
    expect(words(project)).toEqual([
      '1 {"kind":"row","number":1}: 3*',
      '2 {"kind":"row","number":2}: 2*',
      '3 {"kind":"strand","number":1}: 1A',
      '4 {"kind":"strand","number":2}: 2*,1A',
      '5 {"kind":"strand","number":3}: 1A',
    ])
  })

  it('lists a Star part by part and then its joins, each join a line with no runs', () => {
    const chart = wordChartOf(shaped('star', 2, () => false))!
    expect(chart.start).toBe('parts')
    expect(chart.rows).toHaveLength(5 * 2 + 5)
    expect(chart.rows[2]).toMatchObject({ number: 3, step: { kind: 'round', number: 1, part: 2 }, runs: [{ count: 4, letter: undefined }] })
    expect(chart.rows[10]).toMatchObject({ number: 11, step: { kind: 'join', step: 'zip', parts: [1, 2] }, runs: [] })
    expect(chart.lastNumber).toBe(15)
  })

  it('writes a Star square\'s whole rounds, front and back: 4, 8, 12, 16 beads and a partial last round of 9 (ticket 0875)', () => {
    const chart = wordChartOf(shaped('star', 5, () => true))!
    expect(chart.rows.slice(0, 5).map((row) => row.runs)).toEqual([4, 8, 12, 16, 9].map((count) => [{ count, letter: 'A' }]))
    const star = shaped('star', 5, () => true)
    expect(sided(star, 1)).toBeUndefined()
    expect(sided(star, 2)).toEqual(['(2A)', '(2A)', '(2A)', '(2A)'])
    expect(sided(star, 3)).toEqual(['(2A),1A', '(2A),1A', '(2A),1A', '(2A),1A'])
    expect(sided(star, 4)).toEqual(['(2A),2A', '(2A),2A', '(2A),2A', '(2A),2A'])
    // The last round's corners, at the centre front, the tip and the centre back, are single beads.
    expect(chart.rows[4]!.sides).toEqual([4, 4, 1].map((count) => ({ corner: [], singles: [{ count, letter: 'A' }] })))
  })

  it('writes the back\'s letters as the front\'s in mirror order (ticket 0875)', () => {
    // Square 1's round 4 with its second bead out from the centre B, and its ridge's second bead B.
    const star = shaped('star', 5, ({ row, column }) => !((row === 3 || row === 4) && column === 1))
    const marked = withLayers(onLayer(star, 'frame', (view) => paintCells(view, [{ row: 3, column: 1 }, { row: 4, column: 1 }], HEX.B)), {})
    // Out along arm 1's half on the front, then back in on the back: B second out, then second from last in.
    expect(sided(marked, 4)).toEqual(['(2A),1B,1A', '(2A),1A,1B', '(2A),2A', '(2A),2A'])
    const last = wordChartOf(marked)!.rows[4]!.sides!.map(({ singles }) => singles.map((run) => `${run.count}${run.letter}`).join(','))
    expect(last).toEqual(['1A,1B,2A', '3A,1B', '1A'])
  })
})
