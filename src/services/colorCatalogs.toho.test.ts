import { describe, expect, it } from 'vitest'
import { loadColorCatalog } from './colorCatalogs'
import { BEAD_CATALOG } from '../domain/beads'
import { brandColors, familyHex } from '../domain/palette'

// The toho catalog (tickets 0694, 0695): built by the docs repo's build-toho-catalog.mjs from TOHO's Japanese search
// data (the full facts-only table, committed since 2026-10-29) merged with the text tables of TOHO's international
// sample cards 111, 110, 13 and PF, which a human has still to check against the card images. Every TOHO Form factor reads it.

/** TOHO's Cube sizes (its Shape Chart No.200 and cube card 13). */
const CUBE_SIZES = ['1.5mm', '2mm', '3mm', '4mm']
const ROUND_SIZES = BEAD_CATALOG.filter((bead) => bead.id.startsWith('toho/round/')).map((bead) => bead.size)
/** TOHO Round sizes neither the Japanese file nor a card here covers. */
const ROUND_SIZES_WITHOUT_SOURCE = ['10/0', '7/0']

describe('the toho catalog', () => {
  it('lists real codes for every TOHO Round size a source covers and for every Cube size, none for 10/0 and 7/0', async () => {
    const catalog = await loadColorCatalog('toho')
    const inSize = (size: string) => catalog.codes.filter((code) => code.sizes.includes(size))
    for (const size of [...ROUND_SIZES.filter((size) => !ROUND_SIZES_WITHOUT_SOURCE.includes(size)), ...CUBE_SIZES]) expect(inSize(size).length, size).toBeGreaterThan(0)
    for (const size of ROUND_SIZES_WITHOUT_SOURCE) expect(inSize(size), size).toEqual([])
    expect(catalog.codes.find((code) => code.code === '1')).toMatchObject({ family: ['Crystal'], finish: 'transparent', sizes: expect.arrayContaining(['15/0', '11/0', '8/0', '1.5mm']) })
  })

  it('names only TOHO Round and Cube sizes, so a Bead sees its own subset', async () => {
    const catalog = await loadColorCatalog('toho')
    const sizes = new Set(catalog.codes.flatMap((code) => code.sizes))
    for (const size of sizes) expect([...ROUND_SIZES, ...CUBE_SIZES], size).toContain(size)
  })

  it('gives every code a family with a swatch in TOHO\'s own set, so the picker drops none', async () => {
    const catalog = await loadColorCatalog('toho')
    const colors = brandColors('toho')
    const orphans = catalog.codes.filter((code) => !code.family.some((family) => familyHex(family, colors)))
    expect(orphans.map((code) => code.code)).toEqual([])
  })

  it('holds the 1,066 card codes and no other: a code on no card is gone (ticket 0712)', async () => {
    const catalog = await loadColorCatalog('toho')
    expect(catalog.codes).toHaveLength(1066)
    const codes = catalog.codes.map((row) => row.code)
    for (const japanOnly of ['108C', '194', '423F', '1221F', '1222F']) expect(codes).not.toContain(japanOnly)
  })

  it('takes a card code\'s finish and wording from the card\'s heading', async () => {
    const catalog = await loadColorCatalog('toho')
    const byCode = (code: string) => catalog.codes.find((row) => row.code === code)
    expect(byCode('1F')).toMatchObject({ finish: 'matte', wording: 'Transparent · Matte' })
    expect(byCode('21')).toMatchObject({ finish: 'silver-lined', wording: 'Transparent Silver Lined' })
  })

  it('holds the PermaFinish codes, plated, in the three sizes of the PF card', async () => {
    const catalog = await loadColorCatalog('toho')
    const pf = catalog.codes.filter((row) => row.code.startsWith('PF'))
    for (const row of pf) expect(row.finish, row.code).toBe('plated')
    expect(catalog.codes.find((row) => row.code === 'PF581')?.sizes).toEqual(['15/0', '11/0', '8/0'])
  })
})
