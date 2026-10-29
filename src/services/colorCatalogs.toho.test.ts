import { describe, expect, it } from 'vitest'
import { loadColorCatalog } from './colorCatalogs'
import { BEAD_CATALOG } from '../domain/beads'
import { brandColors, familyHex } from '../domain/palette'

// The toho catalog (ticket 0694): built by the docs repo's build-toho-catalog.mjs from TOHO's Japanese search data,
// today its `--sample` subset until a human says the full table may be committed. Every TOHO Form factor reads it.

/** TOHO's Cube sizes (its Shape Chart No.200): the file has 3mm and 4mm, the app a Bead for 1.5mm only. */
const CUBE_SIZES = ['1.5mm', '2mm', '3mm', '4mm']
const ROUND_SIZES = BEAD_CATALOG.filter((bead) => bead.id.startsWith('toho/round/')).map((bead) => bead.size)
/** TOHO Round sizes the Japanese file has no category for (ticket 0695 adds the international cards). */
const ROUND_SIZES_NOT_IN_FILE = ['10/0', '7/0']

describe('the toho catalog', () => {
  it('lists real codes for every TOHO Round size the file has and for Cube 3mm and 4mm, none yet for Cube 1.5mm', async () => {
    const catalog = await loadColorCatalog('toho')
    const inSize = (size: string) => catalog.codes.filter((code) => code.sizes.includes(size))
    for (const size of [...ROUND_SIZES.filter((size) => !ROUND_SIZES_NOT_IN_FILE.includes(size)), '3mm', '4mm']) expect(inSize(size).length, size).toBeGreaterThan(0)
    for (const size of [...ROUND_SIZES_NOT_IN_FILE, '1.5mm']) expect(inSize(size), size).toEqual([])
    expect(catalog.codes.find((code) => code.code === '1')).toMatchObject({ family: ['Crystal'], finish: 'transparent', sizes: expect.arrayContaining(['11/0', '8/0']) })
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

  it('keeps TOHO\'s Japanese finish tag beside our English wording', async () => {
    const catalog = await loadColorCatalog('toho')
    expect(catalog.codes.find((code) => code.code === '1F')?.wording).toBe('Transparent (スキ) · Frosted (ツヤケシ)')
  })
})
