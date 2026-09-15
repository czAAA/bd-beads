import { beforeEach, describe, expect, it } from 'vitest'
import { BEAD_CATALOG, type Bead } from './beads'
import { allBeads, findBead, loadCustomBeads, removeCustomBead, saveCustomBead } from './beadStorage'

function makeCustomBead(overrides: Partial<Bead> = {}): Bead {
  return {
    id: 'custom-1',
    brand: 'Acme',
    name: 'Fancy',
    size: '8/0',
    formFactor: 'round',
    color: '#e63746',
    widthMm: 3,
    heightMm: 3,
    ...overrides,
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('loadCustomBeads', () => {
  it('returns no beads when none have been saved yet', () => {
    expect(loadCustomBeads()).toEqual([])
  })

  it('ignores corrupted data in storage instead of throwing', () => {
    localStorage.setItem('bd-beads:custom-beads', 'not json')

    expect(loadCustomBeads()).toEqual([])
  })
})

describe('saveCustomBead / removeCustomBead', () => {
  it('saves a custom bead and lists it back', () => {
    const bead = makeCustomBead()

    saveCustomBead(bead)

    expect(loadCustomBeads()).toEqual([bead])
  })

  it('overwrites an existing custom bead with the same id instead of duplicating it', () => {
    const bead = makeCustomBead()
    saveCustomBead(bead)

    const edited = { ...bead, name: 'Renamed' }
    saveCustomBead(edited)

    expect(loadCustomBeads()).toEqual([edited])
  })

  it('removes a custom bead by id, leaving the others untouched', () => {
    const first = makeCustomBead({ id: 'custom-1' })
    const second = makeCustomBead({ id: 'custom-2' })
    saveCustomBead(first)
    saveCustomBead(second)

    removeCustomBead('custom-1')

    expect(loadCustomBeads()).toEqual([second])
  })
})

describe('allBeads', () => {
  it('lists the seeded catalog when no custom beads exist', () => {
    expect(allBeads()).toEqual(BEAD_CATALOG)
  })

  it('appends custom beads after the seeded catalog', () => {
    const custom = makeCustomBead()
    saveCustomBead(custom)

    expect(allBeads()).toEqual([...BEAD_CATALOG, custom])
  })
})

describe('findBead', () => {
  it('finds a seeded bead by id', () => {
    expect(findBead('toho-cube-1.5mm')?.brand).toBe('TOHO')
  })

  it('finds a custom bead by id', () => {
    const custom = makeCustomBead()
    saveCustomBead(custom)

    expect(findBead(custom.id)).toEqual(custom)
  })

  it('returns undefined for an unknown id', () => {
    expect(findBead('not-a-bead')).toBeUndefined()
  })
})
