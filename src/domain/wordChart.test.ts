import { describe, expect, it } from 'vitest'
import { createProject, type Project } from './project'
import type { Technique } from './weave'
import { hasWordChart, wordChartOf } from './wordChart'

const HEX: Record<string, string> = { A: '#111111', B: '#222222', C: '#333333' }

/** A Frame of `rows` (a letter per bead, `.` for an empty cell), Letters on, each letter's hex kept as its own. */
function framed(technique: Technique, rows: string[], changes: Partial<Project> = {}): Project {
  const base = createProject({ technique, beadId: 'toho-cube-1.5mm', size: { width: rows[0].length, height: rows.length, unit: 'beads' } })
  const beads: Record<number, Record<number, string>> = {}
  rows.forEach((row, r) => {
    beads[r] = {}
    ;[...row].forEach((letter, c) => {
      if (letter !== '.') beads[r][c] = HEX[letter]
    })
  })
  return { ...base, frame: { ...base.frame!, beads }, letters: true, paletteLetters: { [HEX.A]: 'A', [HEX.B]: 'B', [HEX.C]: 'C' }, ...changes }
}

const lines = (project: Project) => wordChartOf(project)!.rows.map((row) => `${row.both ? '1&2' : row.number}${row.marker ? `(${row.marker})` : ''}: ${row.runs.map((run) => `${run.count}${run.letter ?? '*'}`).join(',')}`)

describe('Word chart (ticket 0574)', () => {
  it('has none for Right-angle weave and Netting, nor with Letters off', () => {
    expect([hasWordChart('loom'), hasWordChart('peyote'), hasWordChart('brick')]).toEqual([true, true, true])
    expect([hasWordChart('rightAngle'), hasWordChart('netting')]).toEqual([false, false])
    expect(wordChartOf(framed('loom', ['AB'], { letters: false }))).toBeUndefined()
    expect(wordChartOf({ ...framed('loom', ['AB']), frame: undefined })).toBeUndefined()
  })

  it('writes a loom row per line, left to right, without a marker', () => {
    const chart = wordChartOf(framed('loom', ['AABCC', 'B.CCC']))!
    expect(lines(framed('loom', ['AABCC', 'B.CCC']))).toEqual(['1: 2A,1B,2C', '2: 1B,1*,3C'])
    expect(chart.firstEdge).toBe('top')
    expect(chart.lastNumber).toBe(2)
    expect(chart.hasEmpty).toBe(true)
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
    const turned = framed('loom', ['AAB'], { rotation: 180 })
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
    const project = framed('loom', ['AB', 'CC'], { rotation, rowProgress: { direction, currentRow: 0, currentColumn: 0 } })
    const chart = wordChartOf(project)!
    expect(chart.firstEdge).toBe(edge)
    expect(chart.rows[0]!.runs.map((run) => `${run.count}${run.letter}`).join(',')).toBe(runs)
  })
})
