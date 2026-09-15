import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG } from './beads'
import {
  importPatterns,
  libraryFileName,
  parsePatternsFile,
  patternFileName,
  serializeLibrary,
  serializePattern,
} from './patternFile'
import {
  createPattern,
  moveToRow,
  paintCell,
  setColorBeadOverride,
  setRowProgressEnabled,
  type Pattern,
} from './pattern'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

function makePattern(name = 'Fox'): Pattern {
  return createPattern({
    name,
    technique: 'peyote',
    beadId: cubeBead.id,
    size: { width: 15, height: 15, unit: 'mm' },
  })
}

function decoratedPattern(): Pattern {
  const painted = paintCell(makePattern(), 2, 3, '#e63746')
  const mapped = setColorBeadOverride(painted, 'red', 'miyuki-delica-11-0')
  return moveToRow(setRowProgressEnabled(mapped, true), 4)
}

describe('single-Pattern roundtrip', () => {
  it('restores an identical Pattern from its exported file', () => {
    const pattern = decoratedPattern()

    expect(parsePatternsFile(serializePattern(pattern))).toEqual([pattern])
  })

  it('carries the grid, technique, bead, mappings and row progress through the file', () => {
    const pattern = decoratedPattern()

    const [restored] = parsePatternsFile(serializePattern(pattern))

    expect(restored!.technique).toBe('peyote')
    expect(restored!.beadId).toBe(cubeBead.id)
    expect(restored!.grid[2]![3]!.color).toBe('#e63746')
    expect(restored!.colorBeadOverrides).toEqual({ red: 'miyuki-delica-11-0' })
    expect(restored!.rowProgress).toEqual({ enabled: true, currentRow: 4 })
  })

  it('names the file after the Pattern, without characters a filesystem would choke on', () => {
    expect(patternFileName(makePattern('Fox'))).toBe('bd-beads-fox.json')
    expect(patternFileName(makePattern('TOHO Cube 1.5mm'))).toBe('bd-beads-toho-cube-1-5mm.json')
    expect(patternFileName(makePattern('a/b:c*?'))).toBe('bd-beads-a-b-c.json')
  })

  it('falls back to a generic name for a Pattern whose name has nothing filename-safe in it', () => {
    expect(patternFileName(makePattern('???'))).toBe('bd-beads-pattern.json')
  })
})

describe('whole-library roundtrip', () => {
  it('restores every saved Pattern from one exported file', () => {
    const library = [decoratedPattern(), makePattern('Owl')]

    expect(parsePatternsFile(serializeLibrary(library))).toEqual(library)
  })

  it('exports to one predictable file name', () => {
    expect(libraryFileName()).toBe('bd-beads-library.json')
  })

  it('reads a single-Pattern file too, so one import button handles both', () => {
    const pattern = makePattern()

    expect(parsePatternsFile(serializePattern(pattern))).toEqual([pattern])
  })
})

describe('parsePatternsFile', () => {
  it('rejects a file that is not JSON at all', () => {
    expect(() => parsePatternsFile('not json')).toThrow()
  })

  it('rejects JSON that is not a bd-beads file', () => {
    expect(() => parsePatternsFile('{"kind":"something-else","patterns":[]}')).toThrow()
  })

  it('rejects a file written by a newer, unknown version of the format', () => {
    const tampered = JSON.parse(serializePattern(makePattern()))
    tampered.version = 99

    expect(() => parsePatternsFile(JSON.stringify(tampered))).toThrow()
  })

  it('rejects a file whose patterns are not Patterns', () => {
    expect(() =>
      parsePatternsFile('{"kind":"bd-beads/library","version":1,"patterns":[{"id":"x"}]}'),
    ).toThrow()
  })

  it('backfills fields a Pattern exported by an older version would be missing', () => {
    const file = JSON.parse(serializePattern(makePattern()))
    delete file.patterns[0].rowProgress
    delete file.patterns[0].colorBeadOverrides

    const [restored] = parsePatternsFile(JSON.stringify(file))

    expect(restored!.rowProgress).toEqual({ enabled: false, currentRow: 0 })
    expect(restored!.colorBeadOverrides).toEqual({})
  })
})

describe('importPatterns', () => {
  it('adds Patterns that are not on this device yet, untouched', () => {
    const incoming = [makePattern('Fox')]

    expect(importPatterns(incoming, [])).toEqual(incoming)
  })

  it('keeps a same-identity local Pattern and brings the imported one in alongside it', () => {
    const local = decoratedPattern()
    const incoming = paintCell(local, 0, 0, '#2f6fed')

    const added = importPatterns([incoming], [local], () => 'fresh-id')

    expect(added).toHaveLength(1)
    expect(added[0]!.id).toBe('fresh-id')
    expect(added[0]!.grid[0]![0]!.color).toBe('#2f6fed')
    expect(local.grid[0]![0]!.color).toBeNull()
  })

  it('gives every colliding Pattern in one file its own new identity', () => {
    const local = makePattern('Fox')
    let next = 0

    const added = importPatterns([local, local], [local], () => `fresh-${next++}`)

    expect(added.map((pattern) => pattern.id)).toEqual(['fresh-0', 'fresh-1'])
  })

  it('treats a Pattern already imported in the same batch as a collision too', () => {
    const incoming = makePattern('Fox')

    const added = importPatterns([incoming, incoming], [], () => 'fresh-id')

    expect(added.map((pattern) => pattern.id)).toEqual([incoming.id, 'fresh-id'])
  })
})
