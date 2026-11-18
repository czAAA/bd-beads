import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG } from '../../domain/beads'
import { DEFAULT_COLOR_FILES } from '../../domain/defaultColors'
import { familyColorId } from '../../domain/palette'
import { loadColorCatalog } from '../../services/colorCatalogs'

const CATALOG_IDS = Object.keys(import.meta.glob('../colorCatalogs/*.json')).map((path) => path.slice(path.lastIndexOf('/') + 1, -'.json'.length))

// Every Color catalog names its default colors (ticket 1070): a new Brand's catalog brings its file in this folder,
// drafted by the docs repo's scripts/draft-default-colors.mjs. Each one is a measured code of its family, made in the size.
describe('the default colors each Color catalog names', () => {
  it('has a file for every catalog, and none for a catalog that is not there', () => {
    expect(Object.keys(DEFAULT_COLOR_FILES).sort()).toEqual([...CATALOG_IDS].sort())
    for (const [id, file] of Object.entries(DEFAULT_COLOR_FILES)) expect(file.id).toBe(id)
  })

  it.each(CATALOG_IDS)('names %s’s default colors for every Bead size it lists codes in, and only those', async (id) => {
    const catalog = await loadColorCatalog(id)
    const sizes = BEAD_CATALOG.filter((bead) => bead.formFactor.colorCatalog === id).map((bead) => bead.size)
    const listed = sizes.filter((size) => catalog.codes.some((code) => code.sizes.includes(size)))
    expect(Object.keys(DEFAULT_COLOR_FILES[id]?.sizes ?? {}).sort()).toEqual([...new Set(listed)].sort())
  })

  it.each(CATALOG_IDS)('takes for %s only codes the catalog lists in that size, of that family, as measured', async (id) => {
    const catalog = await loadColorCatalog(id)
    const families = BEAD_CATALOG.find((bead) => bead.formFactor.colorCatalog === id)!.brand.colorFamilies!.map((family) => family.id)
    const wrong: string[] = []
    for (const [size, picks] of Object.entries(DEFAULT_COLOR_FILES[id]?.sizes ?? {})) {
      for (const [family, pick] of Object.entries(picks)) {
        const entry = catalog.codes.find((code) => code.code === pick.code)
        const where = `${size} ${family} ${pick.code}`
        if (!families.includes(family)) wrong.push(`${where}: not a color family of the Brand`)
        if (!entry) wrong.push(`${where}: not in the catalog`)
        else if (!entry.sizes.includes(size)) wrong.push(`${where}: not made in ${size}`)
        else if (!entry.family.some((name) => familyColorId(name) === family)) wrong.push(`${where}: of another family`)
        else if (!entry.hex) wrong.push(`${where}: no measured color`)
        else if (entry.hex !== pick.hex) wrong.push(`${where}: ${pick.hex} is not its measured ${entry.hex}`)
      }
    }
    expect(wrong).toEqual([])
  })

  it('never has two default colors of one size that draw the same', () => {
    const twins = Object.values(DEFAULT_COLOR_FILES).flatMap((file) =>
      Object.entries(file.sizes).flatMap(([size, picks]) => {
        const hexes = Object.values(picks).map((pick) => pick.hex)
        return hexes.filter((hex, index) => hexes.indexOf(hex) !== index).map((hex) => `${file.id} ${size} ${hex}`)
      }),
    )
    expect(twins).toEqual([])
  })
})
