// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { startingRowProgress } from './rowWays'

describe('startingRowProgress (ticket 1172)', () => {
  it('turns the Technique\'s way as seen back into the Frame\'s own rows by the Canvas\'s quarter turns', () => {
    // Loom runs top to bottom as seen: along its own rows upright, down its columns once the Canvas is turned a quarter.
    expect(startingRowProgress('loom')).toEqual({ direction: 'rows', currentRow: 0, currentColumn: 0 })
    expect(startingRowProgress('loom', 1)).toEqual({ direction: 'columns', currentRow: 0, currentColumn: 0 })
    // Peyote's Canvas starts turned a quarter: left to right as seen is up its own rows.
    expect(startingRowProgress('peyote', 1)).toEqual({ direction: 'rows', reversed: true, currentRow: 0, currentColumn: 0 })
    expect(startingRowProgress('brick', 2)).toEqual({ direction: 'rows', currentRow: 0, currentColumn: 0 })
  })

  it('starts a Frame with a Frame shape along its rows whatever the Technique and the turn', () => {
    expect(startingRowProgress('peyote', 1, true)).toEqual({ direction: 'rows', currentRow: 0, currentColumn: 0 })
  })
})
