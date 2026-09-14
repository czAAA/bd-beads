import { beforeEach, describe, expect, it } from 'vitest'
import { createPattern } from './pattern'
import { loadPattern, savePattern } from './patternStorage'
import { BEAD_CATALOG } from './beads'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

beforeEach(() => {
  localStorage.clear()
})

describe('patternStorage', () => {
  it('returns undefined when nothing has been saved yet', () => {
    expect(loadPattern()).toBeUndefined()
  })

  it('round-trips a saved pattern unchanged', () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 15, unit: 'mm' },
    })

    savePattern(pattern)

    expect(loadPattern()).toEqual(pattern)
  })

  it('overwrites a previously saved pattern', () => {
    const first = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 15, unit: 'mm' },
    })
    const second = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 30, height: 30, unit: 'mm' },
    })

    savePattern(first)
    savePattern(second)

    expect(loadPattern()).toEqual(second)
  })

  it('ignores corrupted data in storage instead of throwing', () => {
    localStorage.setItem('bd-beads:pattern', 'not json')

    expect(loadPattern()).toBeUndefined()
  })
})
