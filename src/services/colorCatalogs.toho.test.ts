import { describe, expect, it } from 'vitest'
import { loadColorCatalog } from './colorCatalogs'
import { BEAD_CATALOG } from '../domain/beads'
import { brandColors, familyHex } from '../domain/palette'

// The toho catalog (ticket 0694): built by the docs repo's build-toho-catalog.mjs from TOHO's Japanese search data,
// today its `--sample` subset until a human says the full table may be committed. Every TOHO Form factor reads it.

describe('the toho catalog', () => {
  it('lists real codes for TOHO Round sizes and Cube 3mm and 4mm, none yet for Cube 1.5mm', async () => {
    const catalog = await loadColorCatalog('toho')
    const inSize = (size: string) => catalog.codes.filter((code) => code.sizes.includes(size))
    expect(inSize('11/0').length).toBeGreaterThan(30)
    expect(inSize('15/0').length).toBeGreaterThan(10)
    expect(inSize('3mm').length).toBeGreaterThan(5)
    expect(inSize('1.5mm')).toEqual([])
    expect(catalog.codes.find((code) => code.code === '1')).toMatchObject({ family: ['Crystal'], finish: 'transparent', sizes: expect.arrayContaining(['11/0', '8/0']) })
  })

  it('names only sizes a TOHO Round or Cube has or may have, so a Bead sees its own subset', async () => {
    const catalog = await loadColorCatalog('toho')
    const roundSizes = BEAD_CATALOG.filter((bead) => bead.id.startsWith('toho/round/')).map((bead) => bead.size)
    const sizes = new Set(catalog.codes.flatMap((code) => code.sizes))
    for (const size of sizes) expect(roundSizes.includes(size) || /^\d(\.\d)?mm$/.test(size)).toBe(true)
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
    expect(catalog.codes.every((code) => /\([^)]+\)/.test(code.wording))).toBe(true)
  })
})
