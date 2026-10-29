import { describe, expect, it } from 'vitest'
import { makerCodeOf } from './beadCodeSearch'
import { findBead } from './beads'

const delica11 = findBead('miyuki/delica/11-0')!
const delica15 = findBead('miyuki/delica/15-0')!
const round11 = findBead('miyuki/round/11-0')!
const round6 = findBead('miyuki/round/6-0')!
const toho11 = findBead('toho/round/11-0')!
const tohoCube = findBead('toho/cube/1.5mm')!

describe('makerCodeOf for Miyuki Delica', () => {
  it('reads the retailer forms of DB433 as Miyuki’s own DB433', () => {
    for (const typed of ['DB433', 'DB-0433', 'DB0433', 'db 433', '#DB433', 'DB-433 ']) {
      expect(makerCodeOf(typed, delica11), typed).toBe('DB433')
    }
  })

  it('keeps a letter suffix and gives a bare number the Bead’s own Delica prefix', () => {
    expect(makerCodeOf('dbs-0022l', delica15)).toBe('DBS22L')
    expect(makerCodeOf('0433', delica11)).toBe('DB433')
    expect(makerCodeOf('22', delica15)).toBe('DBS22')
    expect(makerCodeOf('dbm-0010', findBead('miyuki/delica/10-0')!)).toBe('DBM10')
    expect(makerCodeOf('DBL 10', findBead('miyuki/delica/8-0')!)).toBe('DBL10')
  })

  it('does not read a prefix of another Delica size or of another Brand', () => {
    expect(makerCodeOf('DBS22', delica11)).toBeUndefined()
    expect(makerCodeOf('DB433', delica15)).toBeUndefined()
    expect(makerCodeOf('TO11R49', delica11)).toBeUndefined()
    expect(makerCodeOf('11-433', delica11)).toBeUndefined()
    expect(makerCodeOf('', delica11)).toBeUndefined()
    expect(makerCodeOf('blue', delica11)).toBeUndefined()
  })
})

describe('makerCodeOf for Miyuki Round Rocailles', () => {
  it('reads the retailer forms of 1F as Miyuki’s own 1F', () => {
    for (const typed of ['1F', '#1F', '11-1F', 'RR11-0001F', 'N-RR11-0001F', 'rr11-1f', '0001F']) {
      expect(makerCodeOf(typed, round11), typed).toBe('1F')
    }
    expect(makerCodeOf('11-401', round11)).toBe('401')
  })

  it('reads a square-hole SKU of the Bead’s size', () => {
    expect(makerCodeOf('N-RR6S-3284', round6)).toBe('3284')
    expect(makerCodeOf('6-3284', round6)).toBe('3284')
  })

  it('does not read a prefix of another size or of another Brand', () => {
    expect(makerCodeOf('15-1F', round11)).toBeUndefined()
    expect(makerCodeOf('RR11-1F', round6)).toBeUndefined()
    expect(makerCodeOf('DB1', round11)).toBeUndefined()
    expect(makerCodeOf('TO11R1F', round11)).toBeUndefined()
  })
})

describe('makerCodeOf for TOHO', () => {
  it('reads the retailer forms of 49 as TOHO’s bare 49', () => {
    for (const typed of ['49', '#49', 'TO11R49', '11-49', '11 49', 'to11r049', '11R49', 'TO49']) {
      expect(makerCodeOf(typed, toho11), typed).toBe('49')
    }
    expect(makerCodeOf('TO11R23BDA', toho11)).toBe('23BDA')
    expect(makerCodeOf('11-PF21', toho11)).toBe('PF21')
    expect(makerCodeOf('TO11RPF21', toho11)).toBe('PF21')
    expect(makerCodeOf('pf0021', toho11)).toBe('PF21')
  })

  it('reads a number without a separator as the code itself, not as a size', () => {
    expect(makerCodeOf('1149', toho11)).toBe('1149')
  })

  it('reads the Cube’s code without a size prefix, as 1.5mm has none a shop writes', () => {
    expect(makerCodeOf('#49', tohoCube)).toBe('49')
    expect(makerCodeOf('TO11R49', tohoCube)).toBeUndefined()
  })

  it('does not read a prefix of another size or of another Brand', () => {
    expect(makerCodeOf('TO8R49', toho11)).toBeUndefined()
    expect(makerCodeOf('15-49', toho11)).toBeUndefined()
    expect(makerCodeOf('DB49', toho11)).toBeUndefined()
    expect(makerCodeOf('RR11-49', toho11)).toBeUndefined()
  })
})
