import { beforeEach, describe, expect, it } from 'vitest'
import { BEAD_CATALOG, beadPitchMm, findBead } from './beads'

beforeEach(() => {
  localStorage.clear()
})

describe('beadPitchMm', () => {
  it('is the width alone when the bead has no correction', () => {
    expect(beadPitchMm({ widthMm: 1.5 })).toBe(1.5)
  })

  it('adds the per-bead correction to the width', () => {
    expect(beadPitchMm({ widthMm: 1.5, widthCorrectionMm: 0.15 })).toBeCloseTo(1.65)
  })

  it('makes 15mm of TOHO Round 11/0 nine columns and 160mm seventy-three rows, as measured on a loom', () => {
    const round = findBead('toho-round-11-0')!
    expect(Math.round(15 / beadPitchMm(round))).toBe(9)
    expect(Math.round(160 / round.heightMm)).toBe(73)
  })
})

describe('findBead', () => {
  it('finds a seeded bead by id', () => {
    expect(findBead('toho-cube-1.5mm')?.brand).toBe('TOHO')
  })

  it('returns undefined for an unknown id', () => {
    expect(findBead('not-a-bead')).toBeUndefined()
  })

  it('ignores custom-bead data left over in storage from before ticket 38', () => {
    localStorage.setItem(
      'bd-beads:custom-beads',
      JSON.stringify([
        {
          id: 'custom-1',
          brand: 'Acme',
          name: 'Fancy',
          size: '8/0',
          formFactor: 'round',
          color: '#e63746',
          widthMm: 3,
          heightMm: 3,
        },
      ]),
    )

    expect(findBead('custom-1')).toBeUndefined()
  })
})

describe('Bead weights (ticket 155)', () => {
  it('gives every catalog Bead a positive average weight of one bead in grams', () => {
    for (const bead of BEAD_CATALOG) {
      expect(bead.gramsPerBead).toBeGreaterThan(0)
    }
  })
})
