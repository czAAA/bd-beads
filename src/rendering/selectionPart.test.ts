// @vitest-environment node
import { frameIdIn, FRAME_ID } from '../testUtils/frameId'
import { describe, expect, it } from 'vitest'
import { withColors } from '../domain/canvas'
import { createProject } from '../domain/createProject'
import { withFrame } from '../domain/frame'
import { withLayer } from '../domain/layerRecord'
import { wordChartOf } from '../domain/wordChart'
import type { Project } from '../domain/project'
import { trimmedArea } from './chartPageKey'
import { acrossNumber, downNumber } from './printPages'
import { selectionPart } from './selectionPart'

const RED = '#e63746'

/** A loom Frame of 6 columns by 30 rows with a red bead in each row from 1, so the full chart counts rows 1...30. */
function framed(): Project {
  const base = withFrame(createProject({ technique: 'loom', beadId: 'toho/cube/1.5mm', size: { width: 8, height: 40, unit: 'beads' } }), { row: 2, column: 1, rows: 30, columns: 6 }, frameIdIn(createProject({ technique: 'loom', beadId: 'toho/cube/1.5mm', size: { width: 8, height: 40, unit: 'beads' } })))
  const beads = withColors({}, Array.from({ length: 30 }, (_, row) => ({ row, column: 2, color: RED })))
  return withLayer(base, FRAME_ID, { beads })
}

describe('selectionPart', () => {
  it('keeps the whole chart\'s row and column numbers for a part of the Frame (ticket 1210)', () => {
    const project = framed()
    // Frame rows 11-19 (own).
    const part = selectionPart(project, { top: 11, left: 2, rows: 9, columns: 3, layer: FRAME_ID }, 'part')!
    const trim = trimmedArea(part, frameIdIn(part))

    expect(downNumber(trim, trim.firstDown)).toBe(12)
    expect(downNumber(trim, trim.lastDown)).toBe(20)
    // The chart's first column is the painted one (own column 2), which the part holds: 1, as the full chart's.
    expect(acrossNumber(trim, trim.firstAcross)).toBe(1)
  })

  it('writes the Word chart\'s lines with the same numbers', () => {
    const part = selectionPart(framed(), { top: 11, left: 2, rows: 9, columns: 3, layer: FRAME_ID }, 'part')!
    const numbers = wordChartOf(part, frameIdIn(part))!.rows.map((row) => row.number)

    expect(numbers[0]).toBe(12)
    expect(numbers[numbers.length - 1]).toBe(20)
  })

  it('counts a Canvas part from 1, having no chart to match', () => {
    const plain = withLayer(createProject({ technique: 'loom', beadId: 'toho/cube/1.5mm', size: { width: 8, height: 20, unit: 'beads' } }), 'canvas', { beads: withColors({}, [{ row: 6, column: 2, color: RED }, { row: 8, column: 2, color: RED }]) })
    const part = selectionPart(withFrame(plain, undefined, frameIdIn(plain)), { top: 5, left: 1, rows: 6, columns: 4, layer: 'canvas' }, 'part')!
    const trim = trimmedArea(part, frameIdIn(part))

    expect(downNumber(trim, trim.firstDown)).toBe(1)
    expect(wordChartOf(part, frameIdIn(part))!.rows[0]!.number).toBe(1)
  })
})
