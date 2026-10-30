import { describe, expect, it } from 'vitest'
import delicaFile from '../data/colorCatalogs/miyuki-delica.json'
import roundFile from '../data/colorCatalogs/miyuki-round.json'
import tohoFile from '../data/colorCatalogs/toho.json'
import { beadColorFilterCounts, codeInOtherSizes, filterBeadColors, searchBeadColors, type BeadColorFilter } from './beadColorFilter'
import { findBead } from './beads'
import { catalogSwatches, type CatalogSwatch } from './beadSwatch'
import { parseColorCatalog } from './colorCatalog'
import { brandColors } from './palette'

const delica = parseColorCatalog(delicaFile, 'miyuki-delica')
const round = parseColorCatalog(roundFile, 'miyuki-round')
const toho = parseColorCatalog(tohoFile, 'toho')

const delica11 = findBead('miyuki/delica/11-0')!
const round11 = findBead('miyuki/round/11-0')!
const toho11 = findBead('toho/round/11-0')!

const swatchesOf = (catalog: typeof delica, bead: typeof delica11) => catalogSwatches(catalog, bead.size, [], brandColors(bead.brand.id))
const familyName = (family: string) => family
const codesFound = (catalog: typeof delica, bead: typeof delica11, typed: string) => searchBeadColors(swatchesOf(catalog, bead), typed, bead, familyName).map((entry) => entry.code)

const none: BeadColorFilter = { families: [], finishes: [] }
const entry = (over: Partial<CatalogSwatch>): CatalogSwatch => ({ code: 'DB1', family: 'Blue', finish: 'opaque', hex: '#123456', approximate: true, discontinued: false, taken: false, ...over })
const sample = [
  entry({ code: 'DB1', family: 'Blue', finish: 'matte' }),
  entry({ code: 'DB2', family: 'Blue', finish: 'opaque' }),
  entry({ code: 'DB3', family: 'Red', finish: 'matte' }),
  entry({ code: 'DB4', family: 'Red', finish: 'opaque' }),
  entry({ code: 'DB5', family: 'Green', finish: 'matte' }),
]

describe('searchBeadColors', () => {
  it('lists every code in catalog order while nothing is typed', () => {
    const all = swatchesOf(delica, delica11)
    expect(searchBeadColors(all, '  ', delica11, familyName)).toEqual(all)
  })

  it('reads a partly typed Delica code as a prefix, the exact code first and the rest in catalog order', () => {
    const codes = codesFound(delica, delica11, 'DB-04')
    expect(codes[0]).toBe('DB4')
    expect(codes.every((code) => code.startsWith('DB4'))).toBe(true)
    expect(codes).toContain('DB433')
    expect(codes.indexOf('DB40')).toBeLessThan(codes.indexOf('DB433'))
    expect(codesFound(delica, delica11, 'db 04')).toEqual(codes)
  })

  it('puts the exact code before the codes it is a prefix of, and those before the codes it is only a part of', () => {
    const typed = codesFound(delica, delica11, 'DB-0433')
    expect(typed[0]).toBe('DB433')
    expect(typed.slice(1).every((code) => code.startsWith('DB433'))).toBe(true)

    const part = codesFound(delica, delica11, '433')
    expect(part[0]).toBe('DB433')
    expect(part).toContain('DB1433')
    expect(part.slice(0, part.indexOf('DB1433')).every((code) => code.startsWith('DB433'))).toBe(true)
  })

  it('reads a TOHO code with its size prefix as a prefix of the bare code', () => {
    const codes = codesFound(toho, toho11, '11-4')
    expect(codes[0]).toBe('4')
    expect(codes).toContain('49')
    expect(codes.every((code) => code.startsWith('4'))).toBe(true)
    expect(codesFound(toho, toho11, 'TO11R4')).toEqual(codes)
  })

  it('reads a Miyuki Round code after its # as a prefix', () => {
    const codes = codesFound(round, round11, '#1')
    expect(codes[0]).toBe('1')
    expect(codes[1]).toBe('1F')
    expect(codes.every((code) => code.startsWith('1'))).toBe(true)
  })

  it('finds nothing for a prefix of another size or Brand', () => {
    expect(codesFound(delica, delica11, 'DBS2')).toEqual([])
    expect(codesFound(toho, toho11, 'TO8R4')).toEqual([])
    expect(codesFound(toho, toho11, 'DB4')).toEqual([])
  })

  it('finds a family by name after every code match, and the rest in catalog order', () => {
    const swatches = [entry({ code: 'DB10', family: 'Red' }), entry({ code: 'DB1', family: 'Blue' }), entry({ code: 'DB2', family: 'Red' }), entry({ code: 'DB110', family: 'Green' })]
    const found = searchBeadColors(swatches, '1', delica11, familyName).map((entry) => entry.code)
    expect(found).toEqual(['DB1', 'DB10', 'DB110'])
    expect(searchBeadColors(swatches, 'red', delica11, familyName).map((entry) => entry.code)).toEqual(['DB10', 'DB2'])
  })
})

describe('filterBeadColors', () => {
  it('keeps every code while no value is on, and the codes of any on family in any on Finish otherwise', () => {
    expect(filterBeadColors(sample, none)).toEqual(sample)
    expect(filterBeadColors(sample, { families: ['Blue', 'Green'], finishes: [] }).map((entry) => entry.code)).toEqual(['DB1', 'DB2', 'DB5'])
    expect(filterBeadColors(sample, { families: ['Blue'], finishes: ['matte'] }).map((entry) => entry.code)).toEqual(['DB1'])
    expect(filterBeadColors(sample, { families: [], finishes: ['plated'] })).toEqual([])
  })
})

describe('beadColorFilterCounts', () => {
  it('counts each value by the rows it would show given the other row, not its own', () => {
    const counts = beadColorFilterCounts(sample, { families: ['Blue'], finishes: ['matte'] })
    expect(counts.families.get('Blue')).toBe(1)
    expect(counts.families.get('Red')).toBe(1)
    expect(counts.families.get('Green')).toBe(1)
    expect(counts.finishes.get('matte')).toBe(1)
    expect(counts.finishes.get('opaque')).toBe(1)
    expect(counts.finishes.get('plated')).toBeUndefined()
  })

  it('counts every row with nothing on', () => {
    const counts = beadColorFilterCounts(sample, none)
    expect(counts.families.get('Blue')).toBe(2)
    expect(counts.finishes.get('matte')).toBe(3)
  })
})

describe('codeInOtherSizes', () => {
  it('names the sizes a typed code exists in when the Bead’s size is not among them', () => {
    expect(codeInOtherSizes(toho, '#4', findBead('toho/round/6-0')!)).toEqual({ code: '4', sizes: ['15/0', '11/0', '8/0'] })
    expect(codeInOtherSizes(delica, 'DB-0433', findBead('miyuki/delica/15-0')!)).toEqual({ code: 'DB433', sizes: ['11/0'] })
  })

  it('names nothing for a code in the Bead’s size, a code the catalog lacks or a family name', () => {
    expect(codeInOtherSizes(toho, '4', toho11)).toBeUndefined()
    expect(codeInOtherSizes(delica, 'DB99999', delica11)).toBeUndefined()
    expect(codeInOtherSizes(delica, 'blue', delica11)).toBeUndefined()
  })
})
