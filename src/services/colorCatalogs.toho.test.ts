import { describe, expect, it } from 'vitest'
import { loadColorCatalog } from './colorCatalogs'
import { BEAD_CATALOG, findBead } from '../domain/beads'
import { catalogSwatches, swatchHex } from '../domain/beadSwatch'
import { createProject } from '../domain/createProject'
import { addedColorId, brandColors, defaultPaletteIds, familyHex, projectPalette } from '../domain/palette'
import { setPalette } from '../domain/paletteEdits'
import { parseProjectsFile, serializeProject } from '../domain/projectFile'

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

  // The colors read from TOHO's sample cards (tickets 1067, 1068; ADR 0072), written by the docs repo's catalog script. The
  // rules are asserted, not the colors, so a rerun that reads them again or takes some out still passes.
  it('carries a color read from the sample cards for some codes, a hex each, and none for the others', async () => {
    const catalog = await loadColorCatalog('toho')
    const read = catalog.codes.filter((code) => code.hex)
    expect(read.length).toBeGreaterThan(0)
    expect(read.length).toBeLessThan(catalog.codes.length)
    expect(read.filter((code) => !/^#[0-9a-f]{6}$/.test(code.hex!)).map((code) => code.code)).toEqual([])
  })

  it('draws a read code in its own color on a Cube and a Round, and one with none in its generated, approximate swatch', async () => {
    const catalog = await loadColorCatalog('toho')
    const colors = brandColors('toho')
    const read = catalog.codes.find((code) => code.hex && code.sizes.includes('1.5mm') && code.sizes.includes('11/0'))!
    const generated = catalog.codes.find((code) => !code.hex && code.sizes.includes('1.5mm') && code.sizes.includes('11/0'))!
    for (const size of ['1.5mm', '11/0']) {
      const swatches = catalogSwatches(catalog, size, [], colors)
      expect(swatches.find((entry) => entry.code === read.code), size).toMatchObject({ hex: read.hex, approximate: false })
      expect(swatches.find((entry) => entry.code === generated.code), size).toMatchObject({ approximate: true })
    }
  })

  it('leaves a Project made before as it was: its beads keep the hex they were painted with (ticket 1068)', async () => {
    const catalog = await loadColorCatalog('toho')
    const code = catalog.codes.find((entry) => entry.hex && entry.sizes.includes('1.5mm'))!
    // The code as the generated swatch made it, the color the Project was painted with before its color was read.
    const before = swatchHex(code.family[0]!, code.finish, brandColors('toho'))!
    expect(code.hex).not.toBe(before)

    const made = createProject({ technique: 'loom', beadId: findBead('toho/cube/1.5mm')!.id, name: '', makerName: '' })
    const old = setPalette(made, [...defaultPaletteIds(), addedColorId(before)], { [before]: code.code })
    const opened = parseProjectsFile(serializeProject(old)).projects[0]!

    expect(projectPalette(opened).colors.find((color) => color.hex === before)).toMatchObject({ hex: before, code: code.code })
    expect(projectPalette(opened).colors.some((color) => color.hex === code.hex)).toBe(false)
  })
})
