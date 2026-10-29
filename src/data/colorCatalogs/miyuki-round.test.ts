import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG } from '../../domain/beads'
import { loadColorCatalog } from '../../services/colorCatalogs'

// The Miyuki Round catalog is Miyuki's seed-bead series read from its directory (ticket 0693): the number with its
// letter suffix is the key, square-hole codes are marked in their wording, and each code names the sizes it comes in.
// The rules are asserted, not the counts, so a rerun of the script that brings new codes still passes.
describe('the Miyuki Round color catalog', () => {
  const registrySizes = BEAD_CATALOG.filter((bead) => bead.formFactor.colorCatalog === 'miyuki-round').map((bead) => bead.size)

  it('parses, and every code names at least one size the registry’s Miyuki Round Beads have', async () => {
    const catalog = await loadColorCatalog('miyuki-round')
    expect(catalog.codes.length).toBeGreaterThan(800)
    const strays = catalog.codes.filter((code) => !code.sizes.some((size) => registrySizes.includes(size)))
    expect(strays.map((code) => code.code)).toEqual([])
  })

  it('keys a code by its number and letter suffix, with no # and no old number in parentheses', async () => {
    const catalog = await loadColorCatalog('miyuki-round')
    expect(catalog.codes.every((code) => /^\d+[A-Z]*$/.test(code.code))).toBe(true)
    expect(catalog.codes.find((code) => code.code === '1F')).toMatchObject({ finish: 'matte' })
    expect(catalog.codes.find((code) => code.code === '477')?.sizes).toContain('6/0')
  })

  it('marks the square-hole codes in their wording, each a 6/0 code', async () => {
    const catalog = await loadColorCatalog('miyuki-round')
    const squareHole = catalog.codes.filter((code) => code.wording.includes('(SH)'))
    expect(squareHole.length).toBeGreaterThan(0)
    expect(squareHole.every((code) => code.sizes.length === 1 && code.sizes[0] === '6/0')).toBe(true)
    expect(catalog.codes.find((code) => code.code === '3271')?.wording).toMatch(/Square hole \(SH\)$/)
  })

  it('keeps 2/0 and 5/0 as sizes (every such code is also 6/0) and leaves out code 596, whose listings name no color family', async () => {
    const catalog = await loadColorCatalog('miyuki-round')
    const rare = catalog.codes.filter((code) => code.sizes.includes('2/0') || code.sizes.includes('5/0'))
    expect(rare.length).toBeGreaterThan(0)
    expect(rare.every((code) => code.sizes.includes('6/0'))).toBe(true)
    expect(catalog.codes.find((code) => code.code === '596')).toBeUndefined()
  })
})
