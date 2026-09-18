import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPattern, type Technique } from './pattern'
import { loadPatterns, savePatterns } from './patternStorage'
import { BEAD_CATALOG } from './beads'
import { refuseStorageWrites } from '../testUtils/storageWrites'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

function makePattern(technique: Technique = 'loom') {
  return createPattern({
    technique,
    beadId: cubeBead.id,
    size: { width: 15, height: 15, unit: 'mm' },
  })
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('patternStorage', () => {
  it('returns no patterns when nothing has been saved yet', () => {
    expect(loadPatterns()).toEqual([])
  })

  it('saves a pattern and lists it back', () => {
    const pattern = makePattern()

    savePatterns([pattern])

    expect(loadPatterns()).toEqual([pattern])
  })

  it('saves a whole library in one write', () => {
    const first = makePattern()
    const second = makePattern()

    savePatterns([first, second])

    expect(loadPatterns()).toEqual([first, second])
  })

  it('replaces what was stored rather than merging with it', () => {
    const pattern = makePattern()
    savePatterns([pattern])

    const updated = { ...pattern, updatedAt: pattern.updatedAt + 1 }
    savePatterns([updated])

    expect(loadPatterns()).toEqual([updated])
  })

  it('saving an empty library clears what was stored', () => {
    savePatterns([makePattern()])

    savePatterns([])

    expect(loadPatterns()).toEqual([])
  })

  it('ignores corrupted data in storage instead of throwing', () => {
    localStorage.setItem('bd-beads:patterns', 'not json')

    expect(loadPatterns()).toEqual([])
  })

  it.each(['peyote', 'brick'] as const)('saves and reloads a %s pattern identically to a loom one', (technique) => {
    const pattern = makePattern(technique)

    savePatterns([pattern])

    expect(loadPatterns()).toEqual([pattern])
  })

  it('backfills a name from the bead label for patterns saved before names existed', () => {
    const { name: _name, ...legacyPattern } = makePattern()
    localStorage.setItem('bd-beads:patterns', JSON.stringify([legacyPattern]))

    expect(loadPatterns()[0]!.name).toBe('TOHO Cube 1.5mm')
  })

  it('lets a write that does not fit through to the caller instead of swallowing it', () => {
    refuseStorageWrites()

    expect(() => savePatterns([makePattern()])).toThrow()
  })
})
