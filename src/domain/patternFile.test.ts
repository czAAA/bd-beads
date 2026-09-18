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
  createPatternFromImage,
  moveToRow,
  paintCells,
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
  const painted = paintCells(makePattern(), [{ row: 2, column: 3 }], '#e63746', { columns: 0, rows: 0 })
  return moveToRow(setRowProgressEnabled(painted, true), 4)
}

describe('single-Pattern roundtrip', () => {
  it('restores an identical Pattern from its exported file', () => {
    const pattern = decoratedPattern()

    expect(parsePatternsFile(serializePattern(pattern)).patterns).toEqual([pattern])
  })

  it('carries the grid, technique, bead and row progress through the file', () => {
    const pattern = decoratedPattern()

    const [restored] = parsePatternsFile(serializePattern(pattern)).patterns

    expect(restored!.technique).toBe('peyote')
    expect(restored!.beadId).toBe(cubeBead.id)
    expect(restored!.grid[2]![3]!.color).toBe('#e63746')
    expect(restored!.rowProgress).toEqual({
      enabled: true,
      direction: 'rows',
      currentRow: 4,
      currentColumn: 0,
    })
  })

  it('stays readable version-1 JSON with a cell per grid cell, not the compact stored form (ADR 0009)', () => {
    const file = JSON.parse(serializePattern(decoratedPattern()))

    // A Pattern file exists to move work between devices and to be read; compactness belongs to localStorage only, so
    // export/import is an encode/decode boundary rather than a passthrough of whatever is stored.
    expect(file.version).toBe(1)
    expect(file.patterns[0].cells).toBeUndefined()
    expect(file.patterns[0].grid[2][3]).toEqual({ color: '#e63746' })
  })

  it('does not write a color-to-bead mapping into the file (ADR 0007)', () => {
    const file = JSON.parse(serializePattern(decoratedPattern()))

    expect(file.colorBeadDefaults).toBeUndefined()
    expect(file.patterns[0].colorBeadOverrides).toBeUndefined()
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

    expect(parsePatternsFile(serializeLibrary(library))).toEqual({ patterns: library })
  })

  it('exports to one predictable file name', () => {
    expect(libraryFileName()).toBe('bd-beads-library.json')
  })

  it('reads a single-Pattern file too, so one import button handles both', () => {
    const pattern = makePattern()

    expect(parsePatternsFile(serializePattern(pattern)).patterns).toEqual([pattern])
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

    const { patterns } = parsePatternsFile(JSON.stringify(file))

    expect(patterns[0]!.rowProgress).toEqual({
      enabled: false,
      direction: 'rows',
      currentRow: 0,
      currentColumn: 0,
    })
  })

  it('still imports a file exported before this change, ignoring its color-to-bead defaults and overrides', () => {
    const file = JSON.parse(serializePattern(makePattern()))
    file.colorBeadDefaults = { red: 'toho-cube-1.5mm' }
    file.patterns[0].colorBeadOverrides = { red: 'miyuki-delica-11-0' }

    const { patterns } = parsePatternsFile(JSON.stringify(file))

    expect(patterns[0]!.id).toBe(file.patterns[0].id)
    expect((patterns[0] as unknown as { colorBeadOverrides?: unknown }).colorBeadOverrides).toBeUndefined()
  })
})

describe('importPatterns', () => {
  it('adds Patterns that are not on this device yet, untouched', () => {
    const incoming = [makePattern('Fox')]

    expect(importPatterns(incoming, [])).toEqual(incoming)
  })

  it('keeps a same-identity local Pattern and brings the imported one in alongside it', () => {
    const local = decoratedPattern()
    const incoming = paintCells(local, [{ row: 0, column: 0 }], '#2f6fed', { columns: 0, rows: 0 })

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

describe('Image colors through a Pattern file (ticket 58)', () => {
  function converted(): Pattern {
    return createPatternFromImage({
      name: 'Logo',
      technique: 'peyote',
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

  it('exports and imports a converted Pattern with its Image colors intact', () => {
    const pattern = converted()

    const [restored] = parsePatternsFile(serializePattern(pattern)).patterns

    expect(restored).toEqual(pattern)
    expect(restored!.imageColors).toEqual(['#ff0000', '#00ff00', '#0000ff'])
  })

  it('carries them through a whole-library file too', () => {
    const pattern = converted()

    const { patterns } = parsePatternsFile(serializeLibrary([makePattern('Plain'), pattern]))

    expect(patterns[0]!.imageColors).toBeUndefined()
    expect(patterns[1]!.imageColors).toEqual(['#ff0000', '#00ff00', '#0000ff'])
  })

  it('leaves a Pattern created any other way without the field, rather than giving it an empty list', () => {
    const [restored] = parsePatternsFile(serializePattern(makePattern())).patterns

    expect(restored!.imageColors).toBeUndefined()
    expect('imageColors' in restored!).toBe(false)
  })
})
