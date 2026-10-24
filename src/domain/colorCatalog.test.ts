import { describe, expect, it } from 'vitest'
import { parseColorCatalog } from './colorCatalog'
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

  it('leaves the photos and durability out of what it keeps', () => {
    const catalog = parseColorCatalog({ id: 'x', codes: [{ ...row, photo: 'a.jpg', durability: 1 }] }, 'x')
    expect(Object.keys(catalog.codes[0]!)).toEqual(['code', 'family', 'finish', 'wording', 'sizes'])
  })

  it('keeps a measured hex, lowercase, and drops one that is not a color', () => {
    const catalog = parseColorCatalog({ id: 'x', codes: [{ ...row, hex: '#ABCDEF' }, { ...row, code: 'DB2', hex: 'blue' }] }, 'x')
    expect(catalog.codes.map((code) => code.hex)).toEqual(['#abcdef', undefined])
  })
})

describe('a Form factor names its catalog', () => {
  it('gives Delica one and leaves the other Beads without', () => {
    expect(BEAD_CATALOG.map((bead) => bead.formFactor.colorCatalog)).toEqual([undefined, undefined, 'miyuki-delica'])
  })
})
