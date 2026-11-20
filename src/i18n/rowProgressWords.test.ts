import { describe, expect, it } from 'vitest'
import { createProject } from '../domain/createProject'
import { moveToRow, toggleRowDirection } from '../domain/rowProgress'
import { withLayers } from '../testUtils/layerFields'
import { en } from './en'
import { rowProgressAnnouncement, rowProgressCount } from './rowProgressWords'

const words = en.rowProgress

function framed(technique: 'loom' | 'peyote', columns: number, rows: number) {
  const project = createProject({ technique, beadId: 'toho-cube-1.5mm', size: { width: columns, height: rows, unit: 'beads' } })
  return withLayers(project, { frame: { technique, row: 0, column: 0, rows, columns, beads: {} } })
}

describe('rowProgressAnnouncement (ticket 0934)', () => {
  it('says the row as the counter counts it, from 1, and Pattern done after the last', () => {
    const loom = framed('loom', 3, 10)
    expect(rowProgressAnnouncement(words, moveToRow(loom, 6))).toBe('Row 7 of 10')
    expect(rowProgressAnnouncement(words, moveToRow(loom, 10))).toBe('Pattern done')
  })

  it('says the column while rows run down the columns', () => {
    expect(rowProgressAnnouncement(words, moveToRow(toggleRowDirection(framed('loom', 16, 3)), 3))).toBe('Column 4 of 16')
  })

  it('says the pass and the rulers\' row on peyote, where a line takes two passes', () => {
    // A new peyote Project's Canvas is turned a quarter: its second row is the rulers' 13th from the left (ticket 1165).
    const peyote = framed('peyote', 6, 14)
    expect(rowProgressAnnouncement(words, moveToRow(peyote, 2))).toBe('Pass 3 of 27, row 13')
    expect(rowProgressAnnouncement(words, moveToRow(toggleRowDirection(framed('peyote', 14, 6)), 2))).toMatch(/^Pass 3 of \d+, column 2$/)
  })
})

describe('rowProgressCount (ticket 0972)', () => {
  it('names the step with both numbers, and keeps a short form for a narrow bar', () => {
    expect(rowProgressCount(words, moveToRow(framed('loom', 3, 10), 6))).toEqual({ step: 'Row 7 of 10', short: '7/10', spoken: 'Row 7 of 10' })
    const columns = rowProgressCount(words, moveToRow(toggleRowDirection(framed('loom', 16, 3)), 3))
    expect(columns.step).toBe('Column 4 of 16')
  })

  it('counts passes on peyote with the rulers\' row after, which the announcer reads in the same words', () => {
    const count = rowProgressCount(words, moveToRow(framed('peyote', 6, 14), 2))
    expect(count).toEqual({ step: 'Pass 3 of 27', line: '· row 13', short: '3/27', spoken: 'Pass 3 of 27, row 13' })
  })

  it('says Pattern done once every pass is', () => {
    expect(rowProgressCount(words, moveToRow(framed('loom', 3, 10), 10))).toEqual({ step: 'Pattern done', short: 'Pattern done', spoken: 'Pattern done' })
  })
})
