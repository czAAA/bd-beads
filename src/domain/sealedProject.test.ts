import { describe, expect, it } from 'vitest'
import { SIZE_GATE_BEADS } from './openingLimits'
import { gated, projectSummaryOf } from './sealedProject'

describe('a sealed Project (ticket 0716)', () => {
  it('is gated only past the size gate: a Project just under it opens as before', () => {
    expect(gated({ beads: SIZE_GATE_BEADS })).toBe(false)
    expect(gated({ beads: SIZE_GATE_BEADS + 1 })).toBe(true)
  })

  it('is summed up from its stored form: its name, maker, dates and beads per layer', () => {
    const stored = {
      id: 'p',
      makerName: '@1111',
      createdAt: 10,
      updatedAt: 20,
      savedAt: 30,
      layers: [{ name: 'test1', encodedBeads: { colors: ['#000'], rows: { 0: '0:1x3' } } }, { encodedBeads: { colors: ['#000'], rows: { 0: '0:1x4' } } }],
    }
    expect(projectSummaryOf(stored)).toEqual({ id: 'p', name: 'test1', makerName: '@1111', createdAt: 10, updatedAt: 20, savedAt: 30, layerBeads: [3, 4], beads: 7 })
  })

  it('has no summary for a Project stored before its layers', () => {
    expect(projectSummaryOf({ id: 'old', encodedBeads: { colors: [], rows: {} } })).toBeUndefined()
  })
})
