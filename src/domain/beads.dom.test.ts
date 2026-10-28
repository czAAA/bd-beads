import { beforeEach, describe, expect, it } from 'vitest'
import { BEAD_CATALOG, DEFAULT_BEAD, beadAfterPick, beadCopy, beadLabel, beadPitchMm, findBead, gramsPerBead, offeredBeads } from './beads'

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
    const round = findBead('toho/round/11-0')!
    expect(Math.round(15 / beadPitchMm(round))).toBe(9)
    expect(Math.round(160 / round.heightMm)).toBe(73)
  })
})

describe('findBead', () => {
  it('finds a seeded bead by id', () => {
    expect(findBead('toho/cube/1.5mm')?.brand.name).toBe('TOHO')
  })

  it('reads the three ids written before ids were built from their parts', () => {
    expect(findBead('toho-cube-1.5mm')).toBe(findBead('toho/cube/1.5mm'))
    expect(findBead('toho-round-11-0')).toBe(findBead('toho/round/11-0'))
    expect(findBead('miyuki-delica-11-0')).toBe(findBead('miyuki/delica/11-0'))
  })

  it('returns undefined for an unknown id', () => {
    expect(findBead('not-a-bead')).toBeUndefined()
  })

  it('ignores custom-bead data left over in storage from before ticket 38', () => {
    localStorage.setItem(
      'openbeads:custom-beads',
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

describe('the catalog (ADR 0072)', () => {
  // An id is never removed: a Bead that leaves is flagged `retired`, so every saved file still resolves.
  const PUBLISHED_IDS = ['toho/cube/1.5mm', 'toho/round/11-0', 'miyuki/delica/11-0']

  it('keeps every id it ever published', () => {
    const ids = BEAD_CATALOG.map((bead) => bead.id)
    for (const id of PUBLISHED_IDS) {
      expect(ids).toContain(id)
    }
  })

  it('builds each id from its Brand, Form factor and size', () => {
    for (const bead of BEAD_CATALOG) {
      expect(bead.id).toBe(`${bead.brand.id}/${bead.formFactor.id}/${bead.size.replace('/', '-')}`)
    }
  })

  it('offers no retired Bead', () => {
    expect(offeredBeads().every((bead) => !bead.retired)).toBe(true)
  })

  it('starts a new Project on the named default', () => {
    expect(BEAD_CATALOG).toContain(DEFAULT_BEAD)
  })

  it('keeps a Brand\'s color families on its row, out of the Bead a Project saves (ADR 0078)', () => {
    const delica = findBead('miyuki/delica/11-0')!
    expect(delica.brand.colorFamilies?.length).toBeGreaterThan(0)
    expect(beadCopy(delica).brand).toEqual({ id: 'miyuki', name: 'Miyuki' })
  })
})

describe('Bead weights (ticket 155, ADR 0072)', () => {
  it('derives grams per bead from beads per kg', () => {
    expect(gramsPerBead(findBead('miyuki/delica/11-0'))).toBe(0.005)
    expect(gramsPerBead(findBead('toho/cube/1.5mm'))).toBe(0.0108)
  })

  it('has none for a Bead with no published figure', () => {
    expect(gramsPerBead({ beadsPerKg: undefined })).toBeUndefined()
  })
})

describe('beadLabel', () => {
  it('names the Brand, the Form factor in the language given, and the size', () => {
    const cube = findBead('toho/cube/1.5mm')!
    expect(beadLabel(cube)).toBe('TOHO Cube 1.5mm')
    expect(beadLabel(cube, { cube: 'Куб', round: 'Круглый', delica: 'Delica' })).toBe('TOHO Куб 1.5mm')
  })
})

describe('beadAfterPick (ticket 554)', () => {
  const beads = offeredBeads()
  const delica11 = findBead('miyuki/delica/11-0')!

  it('keeps the Type and size when the new Brand has them', () => {
    const toho = findBead('toho/round/11-0')!
    const next = beadAfterPick(beads, toho, { brandId: 'miyuki' })
    expect(next?.brand.id).toBe('miyuki')
    expect(next?.size).toBe(toho.size)
  })

  it('takes the new Brand\'s first Bead when it has neither the Type nor the size', () => {
    const cube = beads.find((bead) => bead.formFactor.id === 'cube')!
    const next = beadAfterPick(beads, cube, { brandId: 'miyuki' })
    expect(next?.brand.id).toBe('miyuki')
  })

  it('keeps the Brand and the size when only the Type changes', () => {
    const next = beadAfterPick(beads, delica11, { formFactorId: delica11.formFactor.id })
    expect(next?.id).toBe(delica11.id)
  })

  it('is undefined for a Brand with no Beads', () => {
    expect(beadAfterPick(beads, delica11, { brandId: 'nobody' })).toBeUndefined()
  })
})
