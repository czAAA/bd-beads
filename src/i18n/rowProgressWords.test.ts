import { frameIdIn } from '../testUtils/frameId'
import { describe, expect, it } from 'vitest'
import { createProject } from '../domain/createProject'
import { moveToRow, toggleRowDirection } from '../domain/rowProgress'
import { withLayers } from '../testUtils/layerFields'
import { en } from './en'
import { rowProgressAnnouncement as announcement, rowProgressCount as count } from './rowProgressWords'
import { canvasOf } from '../domain/layerRecord'
import type { QuarterTurns } from '../domain/frameShape'
import type { Layered } from '../domain/layerRecord'

const words = en.rowProgress
/** The words of the Project's one Frame. */
const rowProgressAnnouncement = (w: typeof words, project: Layered) => announcement(w, project, frameIdIn(project))
const rowProgressCount = (w: typeof words, project: Layered) => count(w, project, frameIdIn(project))

function framed(technique: 'loom' | 'peyote', columns: number, rows: number) {
  const project = createProject({ technique, beadId: 'toho-cube-1.5mm', size: { width: columns, height: rows, unit: 'beads' } })
  // The Frame lies as a new Project's Canvas does: turned a quarter on the Table, as its Technique's lines start left to right as seen.
  return withLayers(project, { frame: { technique, row: 0, column: 0, rows, columns, beads: {}, quarterTurns: (canvasOf(project).orientation / 90) as QuarterTurns } })
}

function atRow(project: ReturnType<typeof framed>, row: number, turned = false) {
  const id = frameIdIn(project)
  return moveToRow(turned ? toggleRowDirection(project, id) : project, row, id)
}

describe('rowProgressAnnouncement (ticket 0934)', () => {
  it('says the row as the counter counts it, from 1, and Pattern done after the last', () => {
    const loom = framed('loom', 3, 10)
    expect(rowProgressAnnouncement(words, atRow(loom, 6))).toBe('Row 7 of 10')
    expect(rowProgressAnnouncement(words, atRow(loom, 10))).toBe('Pattern done')
  })

  it('says the column while rows run down the columns', () => {
    expect(rowProgressAnnouncement(words, atRow(framed('loom', 16, 3), 3, true))).toBe('Column 4 of 16')
  })

  it('says the pass and the rulers\' row on peyote, where a line takes two passes', () => {
    // A new peyote Project's Canvas is turned a quarter and its lines start left to right as seen, so they are columns
    // (spec 1182): its second is the rulers' 2nd from the left.
    const peyote = framed('peyote', 6, 14)
    expect(rowProgressAnnouncement(words, atRow(peyote, 2))).toBe('Pass 3 of 27, column 2')
    expect(rowProgressAnnouncement(words, atRow(framed('peyote', 14, 6), 2, true))).toBe('Pass 3 of 27, row 13')
  })
})

describe('rowProgressCount (ticket 0972)', () => {
  it('names the step with both numbers, and keeps a short form for a narrow bar', () => {
    expect(rowProgressCount(words, atRow(framed('loom', 3, 10), 6))).toEqual({ step: 'Row 7 of 10', short: '7/10', spoken: 'Row 7 of 10' })
    const columns = rowProgressCount(words, atRow(framed('loom', 16, 3), 3, true))
    expect(columns.step).toBe('Column 4 of 16')
  })

  it('counts passes on peyote with the rulers\' row after, which the announcer reads in the same words', () => {
    const count = rowProgressCount(words, atRow(framed('peyote', 6, 14), 2))
    expect(count).toEqual({ step: 'Pass 3 of 27', line: '· column 2', short: '3/27', spoken: 'Pass 3 of 27, column 2' })
  })

  it('says Pattern done once every pass is', () => {
    expect(rowProgressCount(words, atRow(framed('loom', 3, 10), 10))).toEqual({ step: 'Pattern done', short: 'Pattern done', spoken: 'Pattern done' })
  })
})
