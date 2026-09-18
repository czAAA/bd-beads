import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPattern, createPatternFromImage, type Grid, type Pattern, type Technique } from './pattern'
import { loadPatterns, savePatterns } from './patternStorage'
import { parsePatternsFile, serializeLibrary } from './patternFile'
import { BEAD_CATALOG } from './beads'
import { refuseStorageWrites } from '../testUtils/storageWrites'

const STORAGE_KEY = 'bd-beads:patterns'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

function makePattern(technique: Technique = 'loom') {
  return createPattern({
    technique,
    beadId: cubeBead.id,
    size: { width: 15, height: 15, unit: 'mm' },
  })
}

/** An ordinary 60×90 Pattern — 9×13.5cm in 1.5mm cubes — painted the blocky way beadwork designs actually look. */
function paintedOrdinaryPattern(): Pattern {
  const hexes = ['#1f1f1f', '#ffffff', '#c81e3c', '#1e64c8', '#1ea05a', '#f0c419', '#8e44ad', '#e67e22', null]
  const pattern = createPattern({
    technique: 'loom',
    beadId: cubeBead.id,
    size: { width: 90, height: 135, unit: 'mm' },
  })
  const grid: Grid = pattern.grid.map((cells, row) =>
    cells.map((_cell, column) => ({
      color: hexes[(Math.floor(row / 10) + Math.floor(column / 10)) % hexes.length]!,
    })),
  )
  return { ...pattern, grid }
}

function storedBytes(): number {
  return localStorage.getItem(STORAGE_KEY)!.length
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

  describe('the compact stored format (ADR 0009)', () => {
    it('writes a version marker and a compact grid instead of an object per cell', () => {
      savePatterns([makePattern()])

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(stored.version).toBe(2)
      expect(stored.patterns[0].grid).toBeUndefined()
      expect(stored.patterns[0].cells).toEqual({ colors: [], runs: '0x100' })
    })

    it('reads a library saved in the old unversioned format back unchanged', () => {
      const pattern = makePattern()
      localStorage.setItem(STORAGE_KEY, JSON.stringify([pattern]))

      expect(loadPatterns()).toEqual([pattern])
    })

    it('rewrites a library saved in the old format compactly on the next save', () => {
      const legacy = paintedOrdinaryPattern()
      localStorage.setItem(STORAGE_KEY, JSON.stringify([legacy]))
      const legacyBytes = storedBytes()

      const loaded = loadPatterns()
      savePatterns(loaded)

      expect(loaded).toEqual([legacy])
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).version).toBe(2)
      expect(storedBytes()).toBeLessThan(legacyBytes / 10)
    })

    it('ignores a library written by a newer format version instead of throwing', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, patterns: [{ whatever: true }] }))

      expect(loadPatterns()).toEqual([])
    })

    it('ignores a library whose shape does not match the version it claims', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, patterns: null }))

      expect(loadPatterns()).toEqual([])
    })

    it('keeps a stored value it cannot read, so the next save cannot quietly replace it', () => {
      const unreadable = JSON.stringify({ version: 99, patterns: [{ whatever: true }] })
      localStorage.setItem(STORAGE_KEY, unreadable)

      loadPatterns()
      savePatterns([]) // what an edit made on the empty library the app started from would write

      expect(localStorage.getItem('bd-beads:patterns:unreadable')).toBe(unreadable)
    })

    it('opens a Pattern whose runs do not add up to its grid, rather than refusing it', () => {
      // A hand-edited or truncated stored value: two cells of runs for a 10x10 grid. The Pattern's own dimensions
      // decide the shape, so the rest comes back empty instead of the Pattern being unopenable.
      const { grid: _grid, ...rest } = makePattern()
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 2, patterns: [{ ...rest, cells: { colors: ['#ff0000'], runs: '1x2' } }] }),
      )

      const [loaded] = loadPatterns()

      expect(loaded!.grid.length).toBe(10)
      expect(loaded!.grid.every((row) => row.length === 10)).toBe(true)
      expect([loaded!.grid[0]![0]!.color, loaded!.grid[0]![1]!.color, loaded!.grid[0]![2]!.color]).toEqual([
        '#ff0000',
        '#ff0000',
        null,
      ])
    })

    it('drops runs that overrun the grid instead of growing it', () => {
      const { grid: _grid, ...rest } = makePattern()
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 2, patterns: [{ ...rest, cells: { colors: ['#ff0000'], runs: '1x400' } }] }),
      )

      const [loaded] = loadPatterns()

      expect(loaded!.grid.length).toBe(10)
      expect(loaded!.grid.every((row) => row.length === 10)).toBe(true)
    })

    it('hands exported Pattern files plain Patterns, so a file stays readable JSON', () => {
      const pattern = paintedOrdinaryPattern()
      savePatterns([pattern])

      const exported = serializeLibrary(loadPatterns())

      expect(JSON.parse(exported).patterns[0].cells).toBeUndefined()
      expect(parsePatternsFile(exported).patterns).toEqual([pattern])
    })

    it('costs a painted 60x90 Pattern roughly 3KB rather than roughly 100KB', () => {
      const pattern = paintedOrdinaryPattern()
      const plainJsonBytes = JSON.stringify([pattern]).length

      savePatterns([pattern])

      // Measured: 105,510 bytes as plain JSON against 3,156 stored — the 100KB → 3KB ADR 0009 records. The bound is
      // loose enough that an encoding tweak doesn't have to be chased here, and tight enough to fail if the compact
      // form ever stops being written.
      expect(plainJsonBytes).toBeGreaterThan(90 * 1024)
      expect(storedBytes()).toBeLessThan(5 * 1024)
    })
  })
})

describe('Image colors through storage (ticket 58)', () => {
  function converted(): Pattern {
    return createPatternFromImage({
      name: 'Logo',
      technique: 'brick',
      beadId: cubeBead.id,
      size: { width: 4.5, height: 4.5, unit: 'mm' }, // 3 columns x 3 rows in 1.5mm cubes
      grid: [
        [{ color: '#ff0000' }, { color: '#00ff00' }, { color: null }],
        [{ color: null }, { color: '#ff0000' }, { color: '#0000ff' }],
        [{ color: '#0000ff' }, { color: null }, { color: '#00ff00' }],
      ],
      imageColors: ['#ff0000', '#00ff00', '#0000ff'],
    })
  }

  it('saves and loads a converted Pattern with its Image colors intact', () => {
    const pattern = converted()

    savePatterns([pattern])

    expect(loadPatterns()).toEqual([pattern])
    expect(loadPatterns()[0]!.imageColors).toEqual(['#ff0000', '#00ff00', '#0000ff'])
  })

  it('keeps Image colors apart from the compact encoding own color table, which follows the grid', () => {
    // The grid has three colors; erasing one leaves the stored table with two, while Image colors still records what
    // the conversion found (ADR 0011).
    const pattern = converted()
    const erased = {
      ...pattern,
      grid: pattern.grid.map((row) => row.map((cell) => ({ color: cell.color === '#0000ff' ? null : cell.color }))),
    }

    savePatterns([erased])
    const [loaded] = loadPatterns()

    expect(loaded!.imageColors).toEqual(['#ff0000', '#00ff00', '#0000ff'])
    expect(new Set(loaded!.grid.flat().map((cell) => cell.color))).toEqual(new Set(['#ff0000', '#00ff00', null]))
  })

  it('leaves a Pattern created any other way without the field', () => {
    savePatterns([makePattern()])

    expect(loadPatterns()[0]!.imageColors).toBeUndefined()
  })
})
