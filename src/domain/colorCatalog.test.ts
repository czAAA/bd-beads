import { describe, expect, it } from 'vitest'
import { measuredColorSource, parseColorCatalog } from './colorCatalog'
import { BEAD_CATALOG } from './beads'

const row = { code: 'DB1', family: ['Gray'], finish: 'metallic', wording: 'Opaque · Metallic', sizes: ['11/0'] }

describe('parseColorCatalog', () => {
  it('reads a catalog, keeping the discontinued flag', () => {
    const catalog = parseColorCatalog({ id: 'x', codes: [row, { ...row, code: 'DB2', discontinued: true }] }, 'x')
    expect(catalog.codes.map((code) => code.discontinued)).toEqual([undefined, true])
  })

  it.each([
    ['another id', { id: 'y', codes: [row] }],
    ['an unknown finish', { id: 'x', codes: [{ ...row, finish: 'shiny' }] }],
    ['a code without sizes', { id: 'x', codes: [{ ...row, sizes: [] }] }],
    ['a code without a family', { id: 'x', codes: [{ ...row, family: undefined }] }],
    ['a code listed twice', { id: 'x', codes: [row, row] }],
    ['a row that is not an object', { id: 'x', codes: [null] }],
  ])('rejects %s', (_name, file) => {
    expect(() => parseColorCatalog(file, 'x')).toThrow(/Color catalog x/)
  })

  it('leaves the photos, durability and the retired Japan-only flag (ticket 0712) out of what it keeps', () => {
    const catalog = parseColorCatalog({ id: 'x', codes: [{ ...row, photo: 'a.jpg', durability: 1, japanOnly: true }] }, 'x')
    expect(Object.keys(catalog.codes[0]!)).toEqual(['code', 'family', 'finish', 'wording', 'sizes'])
  })

  it('keeps a measured hex, lowercase, and drops one that is not a color', () => {
    const catalog = parseColorCatalog({ id: 'x', codes: [{ ...row, hex: '#ABCDEF' }, { ...row, code: 'DB2', hex: 'blue' }] }, 'x')
    expect(catalog.codes.map((code) => code.hex)).toEqual(['#abcdef', undefined])
  })
})

describe('a Form factor names its catalog', () => {
  it('gives Delica and Miyuki Round one each and every TOHO Bead the one toho catalog (ticket 0694)', () => {
    const catalogOf = (id: string) => BEAD_CATALOG.find((bead) => bead.id === id)?.formFactor.colorCatalog
    expect(catalogOf('miyuki/delica/15-0')).toBe('miyuki-delica')
    expect(catalogOf('miyuki/round/11-0')).toBe('miyuki-round')
    const toho = BEAD_CATALOG.filter((bead) => bead.brand.id === 'toho')
    expect(toho.map((bead) => bead.formFactor.id)).toEqual(expect.arrayContaining(['cube', 'round']))
    expect(new Set(toho.map((bead) => bead.formFactor.colorCatalog))).toEqual(new Set(['toho']))
  })
})

describe('measuredColorSource (tickets 0886, 1068)', () => {
  const catalog = (id: string, hex?: string) => parseColorCatalog({ id, codes: [row, { ...row, code: 'DB2', ...(hex ? { hex } : {}) }] }, id)

  it('names the Brand\'s own source once any code carries a hex: MIYUKI\'s photographs for both Miyuki catalogs, TOHO\'s sample cards for TOHO', () => {
    const sources = ['miyuki-delica', 'miyuki-round', 'toho'].map((id) => measuredColorSource(catalog(id, '#223a70')))
    expect(sources).toEqual(['photographs', 'photographs', 'sample-cards'])
  })

  it('names none for a catalog of generated swatches, one no Form factor names, or none loaded', () => {
    expect([measuredColorSource(catalog('toho')), measuredColorSource(catalog('x', '#223a70')), measuredColorSource(undefined)]).toEqual([undefined, undefined, undefined])
  })
})
