import { describe, expect, it } from 'vitest'
import { createProject } from '../domain/createProject'
import type { Project } from '../domain/project'
import { applyLegacyMakerName, LEGACY_MAKER_NAME_KEY, migrateLegacyMakerName } from './legacyMakerName'
import type { LibraryStore } from './libraryStore'

const make = (name: string, makerName?: string): Project => ({
  ...createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name, size: { width: 3, height: 3, unit: 'beads' } }),
  ...(makerName ? { makerName } : {}),
})

describe('applyLegacyMakerName (temporary, ADR 0060)', () => {
  it('gives the device name to every Project without one, and leaves the others alone', () => {
    const result = applyLegacyMakerName([make('Fox'), make('Owl', 'Eve')], '  Ada ')
    expect(result.map((project) => project.makerName)).toEqual(['Ada', 'Eve'])
  })

  it('changes nothing for an empty device name', () => {
    const projects = [make('Fox')]
    expect(applyLegacyMakerName(projects, '  ')).toBe(projects)
  })
})

describe('migrateLegacyMakerName', () => {
  function fakes(device: Record<string, string>, projects: Project[]) {
    const data = new Map(Object.entries(device))
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
    }
    let saved: Project[] | undefined
    const library: LibraryStore = { load: () => projects, open: () => ({ projects, sealed: [] }), unseal: () => projects[0]!, save: (next) => void (saved = next) }
    return { storage, library, data, saved: () => saved }
  }

  it('copies the device name into the library, then clears the device value', () => {
    const { storage, library, data, saved } = fakes({ [LEGACY_MAKER_NAME_KEY]: 'Ada' }, [make('Fox')])
    migrateLegacyMakerName(library, storage)

    expect(saved()?.[0]?.makerName).toBe('Ada')
    expect(data.has(LEGACY_MAKER_NAME_KEY)).toBe(false)
  })

  it('does nothing when no device name was saved', () => {
    const { storage, library, saved } = fakes({}, [make('Fox')])
    migrateLegacyMakerName(library, storage)
    expect(saved()).toBeUndefined()
  })

  it('keeps the device value when the library refuses the write, to try again next load', () => {
    const { storage, data } = fakes({ [LEGACY_MAKER_NAME_KEY]: 'Ada' }, [])
    const library: LibraryStore = { load: () => [make('Fox')], open: () => ({ projects: [], sealed: [] }), unseal: () => make('Fox'), save: () => { throw new Error('quota') } }
    migrateLegacyMakerName(library, storage)
    expect(data.get(LEGACY_MAKER_NAME_KEY)).toBe('Ada')
  })
})
