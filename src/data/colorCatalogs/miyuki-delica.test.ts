import { describe, expect, it } from 'vitest'
import { findBead } from '../../domain/beads'
import { swatchHex } from '../../domain/beadSwatch'
import { createProject } from '../../domain/createProject'
import { addedColorId, brandColors, defaultPaletteIds, projectPalette } from '../../domain/palette'
import { setPalette } from '../../domain/paletteEdits'
import { parseProjectsFile, serializeProject } from '../../domain/projectFile'
import { loadColorCatalog } from '../../services/colorCatalogs'

// The Delica catalog carries the color read from Miyuki's photograph of each code (tickets 0885, 0886; ADR 0072), written
// by the docs repo's catalog script. The rules are asserted, not the colors, so a rerun that reads them again still passes.
describe('the Miyuki Delica color catalog', () => {
  it('has a color read for every code but DB38, which the owner kept on its generated swatch (ticket 0885)', async () => {
    const catalog = await loadColorCatalog('miyuki-delica')
    expect(catalog.codes.filter((code) => !code.hex).map((code) => code.code)).toEqual(['DB38'])
    expect(catalog.codes.filter((code) => code.hex && !/^#[0-9a-f]{6}$/.test(code.hex)).map((code) => code.code)).toEqual([])
  })

  it('leaves a Project made before as it was: its beads keep the hex they were painted with (ticket 0886)', async () => {
    const catalog = await loadColorCatalog('miyuki-delica')
    const colors = brandColors('miyuki')
    // DB2394 as the generated swatch made it ("Silver-lined Black"), the color the Project was painted with.
    const before = swatchHex('Black', 'silver-lined', colors)!
    const now = catalog.codes.find((code) => code.code === 'DB2394')!.hex!
    expect(now).not.toBe(before)

    const made = createProject({ technique: 'loom', beadId: findBead('miyuki/delica/11-0')!.id, name: '', makerName: '' })
    const old = setPalette(made, [...defaultPaletteIds(), addedColorId(before)], { [before]: 'DB2394' })
    const opened = parseProjectsFile(serializeProject(old)).projects[0]!

    const held = projectPalette(opened).colors.find((color) => color.hex === before)
    expect(held).toMatchObject({ hex: before, code: 'DB2394' })
    expect(projectPalette(opened).colors.some((color) => color.hex === now)).toBe(false)
  })
})
