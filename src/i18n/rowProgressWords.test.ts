import { describe, expect, it } from 'vitest'
import { createProject } from '../domain/createProject'
import { moveToRow, toggleRowDirection } from '../domain/rowProgress'
import { withLayers } from '../testUtils/layerFields'
import { en } from './en'
import { rowProgressAnnouncement } from './rowProgressWords'

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
    const peyote = framed('peyote', 6, 14)
    expect(rowProgressAnnouncement(words, moveToRow(peyote, 2))).toBe('Pass 3 of 27, row 2')
    expect(rowProgressAnnouncement(words, moveToRow(toggleRowDirection(framed('peyote', 14, 6)), 2))).toMatch(/^Pass 3 of \d+, column 2$/)
  })
})
