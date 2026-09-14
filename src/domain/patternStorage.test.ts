import { beforeEach, describe, expect, it } from 'vitest'
import { createPattern } from './pattern'
import { loadPatterns, removePattern, savePattern } from './patternStorage'
import { BEAD_CATALOG } from './beads'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

function makePattern() {
  return createPattern({
    technique: 'loom',
    beadId: cubeBead.id,
    size: { width: 15, height: 15, unit: 'mm' },
  })
}

beforeEach(() => {
  localStorage.clear()
})

describe('patternStorage', () => {
  it('returns no patterns when nothing has been saved yet', () => {
    expect(loadPatterns()).toEqual([])
  })

  it('saves a pattern and lists it back', () => {
    const pattern = makePattern()

    savePattern(pattern)

    expect(loadPatterns()).toEqual([pattern])
  })

  it('accumulates multiple saved patterns instead of overwriting them', () => {
    const first = makePattern()
    const second = makePattern()

    savePattern(first)
    savePattern(second)

    expect(loadPatterns()).toEqual([first, second])
  })

  it('overwrites an existing pattern with the same id instead of duplicating it', () => {
    const pattern = makePattern()
    savePattern(pattern)

    const updated = { ...pattern, updatedAt: pattern.updatedAt + 1 }
    savePattern(updated)

    expect(loadPatterns()).toEqual([updated])
  })

  it('removes a pattern by id, leaving the others untouched', () => {
    const first = makePattern()
    const second = makePattern()
    savePattern(first)
    savePattern(second)

    removePattern(first.id)

    expect(loadPatterns()).toEqual([second])
  })

  it('ignores corrupted data in storage instead of throwing', () => {
    localStorage.setItem('bd-beads:patterns', 'not json')

    expect(loadPatterns()).toEqual([])
  })
})
