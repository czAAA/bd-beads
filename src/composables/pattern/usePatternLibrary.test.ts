import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BEAD_CATALOG } from '../../domain/beads'
import { createPattern, paintCells, type Pattern, frameGrid } from '../../domain/pattern'
import { NO_MIRROR_AXES } from '../../domain/mirror'
import { loadPatterns } from '../../services/libraryStore'
import { refuseStorageWrites, spyOnStorageWrites } from '../../testUtils/storageWrites'
import { usePatternLibrary } from './usePatternLibrary'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

function makePattern(overrides: Partial<Pattern> = {}): Pattern {
  return {
    ...createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 15, unit: 'mm' },
    }),
    ...overrides,
  }
}

/** One painted cell, the way a stroke's per-cell commit arrives at replacePattern. */
function withPaintedCell(pattern: Pattern, row: number, column: number): Pattern {
  return paintCells(pattern, [{ row, column }], '#e63746', NO_MIRROR_AXES, false)
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('usePatternLibrary', () => {
  it('starts from what was saved, with the most recently updated Pattern open', () => {
    const older = makePattern({ updatedAt: 1000 })
    const newer = makePattern({ updatedAt: 2000 })
    localStorage.setItem('bd-beads:patterns', JSON.stringify([older, newer]))

    const library = usePatternLibrary()

    expect(library.patterns.value.map((pattern) => pattern.id)).toEqual([newer.id, older.id])
    expect(library.activePatternId.value).toBe(newer.id)
    expect(library.activePattern.value?.id).toBe(newer.id)
  })

  it('opens nothing when nothing has been saved yet', () => {
    const library = usePatternLibrary()

    expect(library.patterns.value).toEqual([])
    expect(library.activePatternId.value).toBeUndefined()
    expect(library.activePattern.value).toBeUndefined()
  })

  it('adds a Pattern, opens it, and persists straight away', () => {
    const library = usePatternLibrary()

    library.addPattern(makePattern())

    expect(library.activePatternId.value).toBe(library.patterns.value[0]!.id)
    expect(loadPatterns()).toEqual(library.patterns.value)
  })

  it('persists a replaced Pattern straight away by default', () => {
    const library = usePatternLibrary()
    const pattern = makePattern()
    library.addPattern(pattern)

    library.replacePattern(withPaintedCell(pattern, 0, 0))

    expect(frameGrid(loadPatterns()[0]!)[0]![0]!.color).toBe('#e63746')
  })

  it('holds back a deferred replace until the pending save is flushed', () => {
    const library = usePatternLibrary()
    const pattern = makePattern()
    library.addPattern(pattern)

    library.replacePattern(withPaintedCell(pattern, 0, 0), { deferSave: true })

    expect(frameGrid(library.activePattern.value!)[0]![0]!.color).toBe('#e63746')
    expect(frameGrid(loadPatterns()[0]!)[0]![0]!.color).toBeNull()

    library.flushPendingSave()

    expect(frameGrid(loadPatterns()[0]!)[0]![0]!.color).toBe('#e63746')
  })

  it('writes once for a whole stroke of deferred cells, not once per cell', () => {
    const library = usePatternLibrary()
    library.addPattern(makePattern())

    const writes = spyOnStorageWrites()
    for (let column = 0; column < 10; column++) {
      library.replacePattern(withPaintedCell(library.activePattern.value!, 0, column), { deferSave: true })
    }
    expect(writes.count).toBe(0)

    library.flushPendingSave()

    expect(writes.count).toBe(1)
    expect(frameGrid(loadPatterns()[0]!)[0]!.every((cell) => cell.color === '#e63746')).toBe(true)
  })

  it('flushing with nothing pending writes nothing', () => {
    const library = usePatternLibrary()
    library.addPattern(makePattern())

    const writes = spyOnStorageWrites()
    library.flushPendingSave()

    expect(writes.count).toBe(0)
  })

  it('persists an immediate change together with whatever a deferred one left pending', () => {
    const library = usePatternLibrary()
    const pattern = makePattern()
    library.addPattern(pattern)

    library.replacePattern(withPaintedCell(pattern, 0, 0), { deferSave: true })
    library.replacePattern(withPaintedCell(library.activePattern.value!, 1, 1))

    const grid = frameGrid(loadPatterns()[0]!)
    expect(grid[0]![0]!.color).toBe('#e63746')
    expect(grid[1]![1]!.color).toBe('#e63746')
  })

  it('removes a Pattern, persists the removal, and opens another remaining one', () => {
    const library = usePatternLibrary()
    const first = makePattern({ updatedAt: 1000 })
    const second = makePattern({ updatedAt: 2000 })
    library.addPattern(first)
    library.addPattern(second)

    library.removePattern(second.id)

    expect(library.patterns.value.map((pattern) => pattern.id)).toEqual([first.id])
    expect(library.activePatternId.value).toBe(first.id)
    expect(loadPatterns().map((pattern) => pattern.id)).toEqual([first.id])
  })

  it('leaves the open Pattern alone when a different one is removed', () => {
    const library = usePatternLibrary()
    const first = makePattern({ updatedAt: 1000 })
    const second = makePattern({ updatedAt: 2000 })
    library.addPattern(first)
    library.addPattern(second)

    library.removePattern(first.id)

    expect(library.activePatternId.value).toBe(second.id)
  })

  it('adds imported Patterns and persists them', () => {
    const library = usePatternLibrary()
    const imported = [makePattern({ updatedAt: 1000 }), makePattern({ updatedAt: 2000 })]

    library.addPatterns(imported)

    expect(loadPatterns().map((pattern) => pattern.id)).toEqual([imported[1]!.id, imported[0]!.id])
    expect(library.activePatternId.value).toBe(imported[1]!.id)
  })

  it('never interrupts an open Pattern when importing', () => {
    const library = usePatternLibrary()
    const open = makePattern({ updatedAt: 1000 })
    library.addPattern(open)

    library.addPatterns([makePattern({ updatedAt: 5000 })])

    expect(library.activePatternId.value).toBe(open.id)
  })

  it('reports a failed save instead of throwing, and clears the report once a save gets through', () => {
    const library = usePatternLibrary()
    const pattern = makePattern()
    library.addPattern(pattern)
    expect(library.saveFailed.value).toBe(false)

    const failing = refuseStorageWrites()
    expect(() => library.replacePattern(withPaintedCell(pattern, 0, 0))).not.toThrow()
    expect(library.saveFailed.value).toBe(true)

    failing.mockRestore()
    library.replacePattern(withPaintedCell(library.activePattern.value!, 1, 1))

    expect(library.saveFailed.value).toBe(false)
  })

  it('reports a failed save on a deferred stroke only once it is flushed', () => {
    const library = usePatternLibrary()
    const pattern = makePattern()
    library.addPattern(pattern)

    refuseStorageWrites()
    library.replacePattern(withPaintedCell(pattern, 0, 0), { deferSave: true })
    expect(library.saveFailed.value).toBe(false)

    library.flushPendingSave()

    expect(library.saveFailed.value).toBe(true)
  })

  it('keeps a failed change pending so the next save retries it', () => {
    const library = usePatternLibrary()
    const pattern = makePattern()
    library.addPattern(pattern)

    const failing = refuseStorageWrites()
    library.replacePattern(withPaintedCell(pattern, 0, 0))
    failing.mockRestore()

    library.flushPendingSave()

    expect(frameGrid(loadPatterns()[0]!)[0]![0]!.color).toBe('#e63746')
    expect(library.saveFailed.value).toBe(false)
  })

  describe('saveNow (ticket 115)', () => {
    it('writes a deferred change straight away and reports that it landed', () => {
      const library = usePatternLibrary()
      const pattern = makePattern()
      library.addPattern(pattern)
      library.replacePattern(withPaintedCell(pattern, 0, 0), { deferSave: true })

      const saved = library.saveNow()

      expect(saved).toBe(true)
      expect(frameGrid(loadPatterns()[0]!)[0]![0]!.color).toBe('#e63746')
    })

    it('writes even with nothing pending, so a "saved" answer never rests on an assumption', () => {
      const library = usePatternLibrary()
      library.addPattern(makePattern())

      const writes = spyOnStorageWrites()

      expect(library.saveNow()).toBe(true)
      expect(writes.count).toBe(1)
    })

    it('reports a refused write and raises saveFailed', () => {
      const library = usePatternLibrary()
      library.addPattern(makePattern())

      refuseStorageWrites()

      expect(library.saveNow()).toBe(false)
      expect(library.saveFailed.value).toBe(true)
    })

    it('clears an earlier saveFailed once the write gets through', () => {
      const library = usePatternLibrary()
      const pattern = makePattern()
      library.addPattern(pattern)
      const failing = refuseStorageWrites()
      library.replacePattern(withPaintedCell(pattern, 0, 0))
      failing.mockRestore()

      expect(library.saveNow()).toBe(true)
      expect(library.saveFailed.value).toBe(false)
    })
  })

  describe('last-saved order (ticket 145)', () => {
    const ids = (library: ReturnType<typeof usePatternLibrary>) => library.patterns.value.map((pattern) => pattern.id)

    function storedLibrary(...patterns: Pattern[]) {
      localStorage.setItem('bd-beads:patterns', JSON.stringify(patterns))
    }

    it('gives a library saved before the order existed a stable order, newest edit first, loading every Pattern unchanged', () => {
      const a = makePattern({ updatedAt: 1000 })
      const b = makePattern({ updatedAt: 3000 })
      const c = makePattern({ updatedAt: 2000 })
      const d = makePattern({ updatedAt: 2000 })
      storedLibrary(a, b, c, d)

      const library = usePatternLibrary()

      expect(ids(library)).toEqual([b.id, c.id, d.id, a.id])
      expect(library.patterns.value.find((pattern) => pattern.id === a.id)).toEqual(a)
      expect(ids(usePatternLibrary())).toEqual([b.id, c.id, d.id, a.id])
    })

    it('puts a new Pattern first, and keeps that order across a reload', () => {
      const older = makePattern({ updatedAt: 5000, savedAt: 5000 })
      storedLibrary(older)
      const library = usePatternLibrary()

      const created = makePattern({ updatedAt: 1 })
      library.addPattern(created)

      expect(ids(library)).toEqual([created.id, older.id])
      expect(ids(usePatternLibrary())).toEqual([created.id, older.id])
    })

    it('moves a Pattern to the front when a change to it is saved, even one saved before', () => {
      const first = makePattern({ savedAt: 3000 })
      const second = makePattern({ savedAt: 2000 })
      const third = makePattern({ savedAt: 1000 })
      storedLibrary(first, second, third)
      const library = usePatternLibrary()

      library.replacePattern(withPaintedCell(third, 0, 0))

      expect(ids(library)).toEqual([third.id, first.id, second.id])
      expect(ids(usePatternLibrary())).toEqual([third.id, first.id, second.id])
    })

    it('moves the open Pattern to the front on Save, even with nothing changed', () => {
      const first = makePattern({ savedAt: 3000, updatedAt: 3000 })
      const opened = makePattern({ savedAt: 1000, updatedAt: 1000 })
      storedLibrary(first, opened)
      const library = usePatternLibrary()
      library.activePatternId.value = opened.id

      library.saveNow()

      expect(ids(library)).toEqual([opened.id, first.id])
      expect(ids(usePatternLibrary())).toEqual([opened.id, first.id])
    })

    it('puts imported Patterns first, the most recently edited of them leading', () => {
      const existing = makePattern({ savedAt: 5000, updatedAt: 9000 })
      storedLibrary(existing)
      const library = usePatternLibrary()

      const older = makePattern({ updatedAt: 1000 })
      const newer = makePattern({ updatedAt: 2000 })
      library.addPatterns([older, newer])

      expect(ids(library)).toEqual([newer.id, older.id, existing.id])
      expect(ids(usePatternLibrary())).toEqual([newer.id, older.id, existing.id])
    })

    it('keeps the order of the rest when one is removed', () => {
      const first = makePattern({ savedAt: 3000 })
      const second = makePattern({ savedAt: 2000 })
      const third = makePattern({ savedAt: 1000 })
      storedLibrary(first, second, third)
      const library = usePatternLibrary()

      library.removePattern(second.id)

      expect(ids(library)).toEqual([first.id, third.id])
      expect(ids(usePatternLibrary())).toEqual([first.id, third.id])
    })
  })
})
