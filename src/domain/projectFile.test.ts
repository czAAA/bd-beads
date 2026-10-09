// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG } from './beads'
import {
  importProjects,
  libraryFileName,
  parseProjectsFile,
  projectFileName,
  serializeLibrary,
  serializeProject,
} from './projectFile'
import {
  createProject,
  createProjectFromImage,
  moveToRow,
  paintCells,
  setRowProgressEnabled,
  withTechnique,
  type Project,
  frameGrid,
} from './project'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

function makeProject(name = 'Fox'): Project {
  return createProject({
    name,
    technique: 'peyote',
    beadId: cubeBead.id,
    size: { width: 15, height: 15, unit: 'mm' },
  })
}

function decoratedProject(): Project {
  const painted = paintCells(makeProject(), [{ row: 2, column: 3 }], '#e63746', { columns: 0, rows: 0 })
  return moveToRow(setRowProgressEnabled(painted, true), 4)
}

describe('single-Project roundtrip', () => {
  it('restores an identical Project from its exported file', () => {
    const project = decoratedProject()

    expect(parseProjectsFile(serializeProject(project)).projects).toEqual([project])
  })

  it('carries a Technique changed on an open Project through the file (ticket 351)', () => {
    const project = withTechnique(decoratedProject(), 'brick')

    const [restored] = parseProjectsFile(serializeProject(project)).projects

    expect(restored!.technique).toBe('brick')
    expect(restored).toEqual(project)
  })

  it('carries the grid, technique, bead and row progress through the file', () => {
    const project = decoratedProject()

    const [restored] = parseProjectsFile(serializeProject(project)).projects

    expect(restored!.technique).toBe('peyote')
    expect(restored!.beadId).toBe(cubeBead.id)
    expect(frameGrid(restored!)[2]![3]!.color).toBe('#e63746')
    expect(restored!.rowProgress).toEqual({
      enabled: true,
      direction: 'rows',
      currentRow: 4,
      currentColumn: 0,
    })
  })

  it('stays readable version-2 JSON with a color per bead, not the compact stored form (ADR 0009)', () => {
    const file = JSON.parse(serializeProject(decoratedProject()))

    // A Project file exists to move work between devices and to be read; compactness belongs to localStorage only, so
    // export/import is an encode/decode boundary rather than a passthrough of whatever is stored.
    expect(file.version).toBe(2)
    expect(file.patterns[0].encodedBeads).toBeUndefined()
    expect(file.patterns[0].beads[2][3]).toBe('#e63746')
    expect(file.patterns[0].frame).toBeDefined()
  })

  it('does not write a color-to-bead mapping into the file (ADR 0007)', () => {
    const file = JSON.parse(serializeProject(decoratedProject()))

    expect(file.colorBeadDefaults).toBeUndefined()
    expect(file.patterns[0].colorBeadOverrides).toBeUndefined()
  })

  it('names the file after the Project, without characters a filesystem would choke on', () => {
    expect(projectFileName(makeProject('Fox'))).toBe('bd-beads-fox.json')
    expect(projectFileName(makeProject('TOHO Cube 1.5mm'))).toBe('bd-beads-toho-cube-1-5mm.json')
    expect(projectFileName(makeProject('a/b:c*?'))).toBe('bd-beads-a-b-c.json')
  })

  it('falls back to a generic name for a Project whose name has nothing filename-safe in it', () => {
    expect(projectFileName(makeProject('???'))).toBe('bd-beads-project.json')
  })
})

describe('whole-library roundtrip', () => {
  it('restores every saved Project from one exported file', () => {
    const library = [decoratedProject(), makeProject('Owl')]

    expect(parseProjectsFile(serializeLibrary(library))).toEqual({ projects: library })
  })

  it('exports to one predictable file name', () => {
    expect(libraryFileName()).toBe('bd-beads-library.json')
  })

  it('reads a single-Project file too, so one import button handles both', () => {
    const project = makeProject()

    expect(parseProjectsFile(serializeProject(project)).projects).toEqual([project])
  })
})

describe('parseProjectsFile', () => {
  it('rejects a file that is not JSON at all', () => {
    expect(() => parseProjectsFile('not json')).toThrow()
  })

  it('rejects JSON that is not a bd-beads file', () => {
    expect(() => parseProjectsFile('{"kind":"something-else","projects":[]}')).toThrow()
  })

  it('rejects a file written by a newer, unknown version of the format', () => {
    const tampered = JSON.parse(serializeProject(makeProject()))
    tampered.version = 99

    expect(() => parseProjectsFile(JSON.stringify(tampered))).toThrow()
  })

  it('rejects a file whose projects are not Projects', () => {
    expect(() =>
      parseProjectsFile('{"kind":"bd-beads/library","version":1,"projects":[{"id":"x"}]}'),
    ).toThrow()
  })

  it('backfills fields a Project exported by an older version would be missing', () => {
    const file = JSON.parse(serializeProject(makeProject()))
    delete file.patterns[0].rowProgress

    const { projects } = parseProjectsFile(JSON.stringify(file))

    expect(projects[0]!.rowProgress).toEqual({
      enabled: false,
      direction: 'rows',
      currentRow: 0,
      currentColumn: 0,
    })
  })

  it('still imports a file exported before ADR 0026, ignoring the millimetre size it stored and keeping the grid', () => {
    const original = makeProject()
    const file = JSON.parse(serializeProject(original))
    file.patterns[0].widthMm = 15
    file.patterns[0].heightMm = 15

    const { projects } = parseProjectsFile(JSON.stringify(file))

    expect(projects[0]!.frame!.columns).toBe(original.frame!.columns)
    expect(projects[0]!.frame!.rows).toBe(original.frame!.rows)
    expect(frameGrid(projects[0]!)).toEqual(frameGrid(original))
    expect(projects[0]).not.toHaveProperty('widthMm')
    expect(projects[0]).not.toHaveProperty('heightMm')
  })

  it('writes no millimetre size into a file (ADR 0026)', () => {
    const [project] = JSON.parse(serializeProject(makeProject())).patterns

    expect(project).not.toHaveProperty('widthMm')
    expect(project).not.toHaveProperty('heightMm')
  })

  it('still imports a file exported before this change, ignoring its color-to-bead defaults and overrides', () => {
    const file = JSON.parse(serializeProject(makeProject()))
    file.colorBeadDefaults = { red: 'toho-cube-1.5mm' }
    file.patterns[0].colorBeadOverrides = { red: 'miyuki-delica-11-0' }

    const { projects } = parseProjectsFile(JSON.stringify(file))

    expect(projects[0]!.id).toBe(file.patterns[0].id)
    expect((projects[0] as unknown as { colorBeadOverrides?: unknown }).colorBeadOverrides).toBeUndefined()
  })
})

describe('importProjects', () => {
  it('adds Projects that are not on this device yet, untouched', () => {
    const incoming = [makeProject('Fox')]

    expect(importProjects(incoming, [])).toEqual(incoming)
  })

  it('keeps a same-identity local Project and brings the imported one in alongside it', () => {
    const local = decoratedProject()
    const incoming = paintCells(local, [{ row: 0, column: 0 }], '#2f6fed', { columns: 0, rows: 0 })

    const added = importProjects([incoming], [local], () => 'fresh-id')

    expect(added).toHaveLength(1)
    expect(added[0]!.id).toBe('fresh-id')
    expect(frameGrid(added[0]!)[0]![0]!.color).toBe('#2f6fed')
    expect(frameGrid(local)[0]![0]!.color).toBeNull()
  })

  it('gives every colliding Project in one file its own new identity', () => {
    const local = makeProject('Fox')
    let next = 0

    const added = importProjects([local, local], [local], () => `fresh-${next++}`)

    expect(added.map((project) => project.id)).toEqual(['fresh-0', 'fresh-1'])
  })

  it('treats a Project already imported in the same batch as a collision too', () => {
    const incoming = makeProject('Fox')

    const added = importProjects([incoming, incoming], [], () => 'fresh-id')

    expect(added.map((project) => project.id)).toEqual([incoming.id, 'fresh-id'])
  })
})

describe('Image colors through a Project file (ticket 58)', () => {
  function converted(): Project {
    return createProjectFromImage({
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

  it('exports and imports a converted Project with its Image colors intact', () => {
    const project = converted()

    const [restored] = parseProjectsFile(serializeProject(project)).projects

    expect(restored).toEqual(project)
    expect(restored!.imageColors).toEqual(['#ff0000', '#00ff00', '#0000ff'])
  })

  it('carries them through a whole-library file too', () => {
    const project = converted()

    const { projects } = parseProjectsFile(serializeLibrary([makeProject('Plain'), project]))

    expect(projects[0]!.imageColors).toBeUndefined()
    expect(projects[1]!.imageColors).toEqual(['#ff0000', '#00ff00', '#0000ff'])
  })

  it('leaves a Project created any other way without the field, rather than giving it an empty list', () => {
    const [restored] = parseProjectsFile(serializeProject(makeProject())).projects

    expect(restored!.imageColors).toBeUndefined()
    expect('imageColors' in restored!).toBe(false)
  })
})
