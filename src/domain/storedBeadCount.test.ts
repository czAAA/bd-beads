import { describe, expect, it } from 'vitest'
import { storedBeadCount, storedLayerBeads } from './storedBeadCount'

/** A Project as the library stores it, shaped like the maintainer's repaired drawing (ticket 0716): a Canvas of 50 beads
 * in short runs with gaps and a negative first column, and a 40 × 11 Frame of 440 beads. Synthetic, made up here. */
const repairedDrawing = {
  id: 'repaired',
  createdAt: 1,
  updatedAt: 2,
  layers: [
    {
      id: 'repaired:canvas',
      name: 'test1',
      encodedBeads: {
        colors: ['#1a1a1a', '#2f6fed', '#e63746', '#ffffff', '#181818'],
        rows: {
          '-71': '17:2x2',
          '-70': '16:2x2,0,2',
          '-69': '16:2,0x2,2',
          '-68': '16:2,0x2,2',
          '-67': '16:2,0x2,2',
          '-66': '15:2x2,0x2,2',
          '-65': '15:2x5',
          '-64': '15:2x2,0,2x2',
          '-63': '15:2x2,0x2,2',
          '-62': '16:2,0x2,2',
          '-61': '16:2,0,2x2',
          '-60': '16:2x3',
          '-59': '17:2x2',
          '-14': '-23:3x6,4',
          '-2': '-17:5x7',
        },
      },
    },
    {
      id: 'repaired:frame',
      rows: 11,
      columns: 40,
      encodedBeads: {
        colors: ['#2f6fed', '#e63746', '#f2994a'],
        rows: Object.fromEntries(Array.from({ length: 11 }, (_row, row) => [String(row), row % 2 ? '0:1x6,2x2,1x7,2x2,1x7,2x2,1x7,2x2,1x5' : '0:1x40'])),
      },
    },
  ],
}

describe('the bead count read from the stored runs (ticket 0716)', () => {
  it('counts each layer of the repaired drawing without decoding it: 50 on the Canvas, 440 in the Frame', () => {
    expect(storedLayerBeads(repairedDrawing)).toEqual([50, 440])
    expect(storedBeadCount(repairedDrawing)).toBe(490)
  })

  it('counts a solid run of 9 million beads from its 3 000 row strings', () => {
    const rows = Object.fromEntries(Array.from({ length: 3000 }, (_row, row) => [String(row - 1500), '-1500:1x3000']))
    const solid = { layers: [{ encodedBeads: { colors: ['#1a1a1a'], rows } }] }
    expect(storedLayerBeads(solid)).toEqual([9_000_000])
  })

  it('counts a Frame\'s Folded beads with its own', () => {
    const folded = { layers: [{ encodedBeads: { colors: ['#000'], rows: { 0: '0:1x3' } }, encodedFolded: { colors: ['#000'], rows: { 0: '5:1,0x2,1' } } }] }
    expect(storedLayerBeads(folded)).toEqual([5])
  })

  it('reads a Project stored before its layers (library version 4): the Canvas, then the Frame', () => {
    const flat = { encodedBeads: { colors: ['#000'], rows: { 0: '0:1x2' } }, frame: { encodedBeads: { colors: ['#000'], rows: { 0: '0:1x4' } } } }
    expect(storedLayerBeads(flat)).toEqual([2, 4])
  })

  it('has no count for a shape it does not know, so the caller decodes it as before', () => {
    expect(storedLayerBeads({ cells: { colors: [], runs: '' } })).toBeUndefined()
    expect(storedLayerBeads(null)).toBeUndefined()
  })
})
