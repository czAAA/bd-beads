import { beforeEach, describe, expect, it } from 'vitest'
import { findBead } from './beadStorage'

beforeEach(() => {
  localStorage.clear()
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
