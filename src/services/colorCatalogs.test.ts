import { readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadColorCatalog } from './colorCatalogs'
import { BEAD_CATALOG } from '../domain/beads'

describe('loadColorCatalog', () => {
  it('loads and validates Delica: 1,288 codes of 11/0, the other sizes too, some discontinued', async () => {
    const catalog = await loadColorCatalog('miyuki-delica')
    expect(catalog.codes.filter((code) => code.sizes.includes('11/0'))).toHaveLength(1288)
    const sizes = new Set(catalog.codes.flatMap((code) => code.sizes))
    expect([...sizes].sort()).toEqual(['10/0', '11/0', '15/0', '8/0'])
    expect(catalog.codes.some((code) => code.discontinued)).toBe(true)
    expect(catalog.codes.find((code) => code.code === 'DB1')).toMatchObject({ family: ['Gray'], finish: 'metallic' })
  })

  it('shares one load between callers', async () => {
    expect(await loadColorCatalog('miyuki-delica')).toBe(await loadColorCatalog('miyuki-delica'))
  })

  it('rejects an id with no file', async () => {
    await expect(loadColorCatalog('toho')).rejects.toThrow('No color catalog toho')
  })

  it('loads every file in the catalogs folder by its name, with no list to edit (ADR 0078)', async () => {
    const files = readdirSync(new URL('../data/colorCatalogs/', import.meta.url)).filter((name) => name.endsWith('.json'))
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const id = file.replace(/\.json$/, '')
      await expect(loadColorCatalog(id)).resolves.toMatchObject({ id })
    }
  })

  it('has a file for every catalog a Form factor names', async () => {
    const named = new Set(BEAD_CATALOG.flatMap((bead) => bead.formFactor.colorCatalog ?? []))
    for (const id of named) await expect(loadColorCatalog(id)).resolves.toMatchObject({ id })
  })
})
