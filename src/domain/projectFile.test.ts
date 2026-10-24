// @vitest-environment node
import { addedColorId, defaultPaletteIds } from './palette'
import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG, findBead } from './beads'
import { paintAt } from '../testUtils/layers'
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
  moveToRow,
  withBrickBlock,
  withTechnique,
  type Project,
  frameGrid,
} from './project'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!

function makeProject(name = 'Fox'): Project {
  return createProject({
    name,
    technique: 'peyote',
    beadId: cubeBead.id,
    size: { width: 15, height: 15, unit: 'mm' },
  })
}

function decoratedProject(): Project {
  const painted = paintAt(makeProject(), [{ row: 2, column: 3 }], '#e63746')
  return moveToRow(painted, 4)
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

  it('carries a Brick block through the file, and reads a file without one as 1 (ticket 477)', () => {
    const project = withBrickBlock(withTechnique(decoratedProject(), 'brick'), 3)

    const [restored] = parseProjectsFile(serializeProject(project)).projects

    expect(restored!.brickBlock).toBe(3)
    expect(restored).toEqual(project)

    const file = JSON.parse(serializeProject(decoratedProject()))
    expect(file.projects[0]).not.toHaveProperty('brickBlock')
    expect(parseProjectsFile(JSON.stringify(file)).projects[0]!.brickBlock).toBeUndefined()
  })

  it('reads an unreadable Brick block as the default (ticket 477)', () => {
    for (const bad of [0, 21, 2.5, 'two', null]) {
      const file = JSON.parse(serializeProject(decoratedProject()))
      file.projects[0].brickBlock = bad
      expect(parseProjectsFile(JSON.stringify(file)).projects[0]!.brickBlock).toBeUndefined()
    }
  })

  it('carries the grid, technique, bead and row progress through the file', () => {
    const project = decoratedProject()

    const [restored] = parseProjectsFile(serializeProject(project)).projects

    expect(restored!.technique).toBe('peyote')
    expect(restored!.beadId).toBe(cubeBead.id)
    expect(frameGrid(restored!)[2]![3]!.color).toBe('#e63746')
    expect(restored!.rowProgress).toEqual({
      direction: 'rows',
      currentRow: 4,
      currentColumn: 0,
    })
  })

  it('writes Row progress without its flag, and reads an old file that has one with the Frame deciding (ticket 426)', () => {
    const project = decoratedProject()
    const file = JSON.parse(serializeProject(project))
    expect(file.projects[0].rowProgress).not.toHaveProperty('enabled')

    file.projects[0].rowProgress.enabled = false
    file.projects[0].rowProgress.decided = true
    const [restored] = parseProjectsFile(JSON.stringify(file)).projects
    expect(restored!.rowProgress).toEqual({ direction: 'rows', currentRow: 4, currentColumn: 0 })
  })

  it('writes version 8 with the compact encoding, the Frame\'s beads in the Frame, and the openbeads kind (ADR 0048, 0066)', () => {
    const file = JSON.parse(serializeProject(decoratedProject()))

    expect(file.kind).toBe('openbeads/project')
    expect(file.version).toBe(8)
    expect(file.patterns).toBeUndefined()
    expect(file.projects[0].beads).toBeUndefined()
    expect(file.projects[0].encodedBeads).toBeDefined()
    expect(file.projects[0].frame.encodedBeads.rows).toEqual({ 2: '3:1' })
    expect(file.projects[0].frame.beads).toBeUndefined()
    expect(JSON.parse(serializeLibrary([decoratedProject()])).kind).toBe('openbeads/library')
  })

  it('keeps the Canvas beside the Frame through a file, and the Frame\'s name', () => {
    const both = { ...decoratedProject(), beads: { 40: { 40: '#123456' } } }
    both.frame = { ...both.frame!, name: 'Cherry' }

    expect(parseProjectsFile(serializeProject(both)).projects).toEqual([both])
  })

  it('refuses a file of the next version rather than read it as this one, and a version 3 file is read as one (ADR 0066)', () => {
    const file = JSON.parse(serializeProject(decoratedProject()))
    file.version = 9
    expect(() => parseProjectsFile(JSON.stringify(file))).toThrow('Unsupported openbeads file version: 9')
  })

  it('carries the Palette through a file (ticket 0525), and reads a version 4 file as the built-in twelve', () => {
    const custom = { ...decoratedProject(), palette: ['red', addedColorId('#123456'), ...defaultPaletteIds().filter((id) => id !== 'red')] }
    const file = JSON.parse(serializeProject(custom))
    expect(file.projects[0].palette).toEqual(custom.palette)
    expect(parseProjectsFile(JSON.stringify(file)).projects).toEqual([custom])

    delete file.projects[0].palette
    file.version = 4
    expect(parseProjectsFile(JSON.stringify(file)).projects[0]!.palette).toEqual(defaultPaletteIds())
  })

  it('keeps Piece names through a file, and reads a file that has none (ticket 406)', () => {
    const named = { ...decoratedProject(), pieceNames: [{ row: 2, column: 3, name: 'Fox' }] }
    const file = JSON.parse(serializeProject(named))

    expect(parseProjectsFile(JSON.stringify(file)).projects[0].pieceNames).toEqual([{ row: 2, column: 3, name: 'Fox' }])

    delete file.projects[0].pieceNames
    expect(parseProjectsFile(JSON.stringify(file)).projects[0].pieceNames).toBeUndefined()
  })

  it('drops Piece names that are not well formed', () => {
    const file = JSON.parse(serializeProject(decoratedProject()))
    file.projects[0].pieceNames = [{ row: 1, column: 1, name: '  ' }, { row: 'x', column: 1, name: 'Bad' }, { row: 0, column: 0, name: 'Ok' }]

    expect(parseProjectsFile(JSON.stringify(file)).projects[0].pieceNames).toEqual([{ row: 0, column: 0, name: 'Ok' }])
  })

  it('does not write a color-to-bead mapping into the file (ADR 0007)', () => {
    const file = JSON.parse(serializeProject(decoratedProject()))

    expect(file.colorBeadDefaults).toBeUndefined()
    expect(file.projects[0].colorBeadOverrides).toBeUndefined()
  })

  it('names the file after the Project, without characters a filesystem would choke on', () => {
    expect(projectFileName(makeProject('Fox'))).toBe('fox_pr.openbeads')
    expect(projectFileName(makeProject('TOHO Cube 1.5mm'))).toBe('toho-cube-1-5mm_pr.openbeads')
    expect(projectFileName(makeProject('a/b:c*?'))).toBe('a-b-c_pr.openbeads')
    expect(projectFileName(makeProject('Лиса'))).toBe('лиса_pr.openbeads')
  })

  it('falls back to a generic name for a Project whose name has nothing filename-safe in it', () => {
    expect(projectFileName(makeProject('???'))).toBe('openbeads_pr.openbeads')
  })
})

describe('Right-angle weave in a file (ticket 482)', () => {
  const woven = () =>
    paintAt(createProject({ technique: 'rightAngle', beadId: cubeBead.id, size: { width: 3, height: 2, unit: 'beads' } }), [{ row: 1, column: 2 }], '#e63746')

  it('keeps the Technique and every bead through the file', () => {
    const project = woven()

    const [restored] = parseProjectsFile(serializeProject(project)).projects

    expect(restored).toEqual(project)
    expect(restored!.technique).toBe('rightAngle')
  })

  it('is refused as an unknown Technique by an app that does not have it', () => {
    const file = serializeProject(woven()).replace('"rightAngle"', '"herringbone"')

    expect(() => parseProjectsFile(file)).toThrow()
  })
})

describe('whole-library roundtrip', () => {
  it('restores every saved Project from one exported file', () => {
    const library = [decoratedProject(), makeProject('Owl')]

    expect(parseProjectsFile(serializeLibrary(library))).toEqual({ projects: library })
  })

  it('exports to one predictable file name', () => {
    expect(libraryFileName()).toBe('openbeads_lib.openbeads')
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

  it('rejects JSON that is not an openbeads file, including the old kinds', () => {
    expect(() => parseProjectsFile('{"kind":"something-else","projects":[]}')).toThrow()
    expect(() => parseProjectsFile('{"kind":"bd-beads/library","version":3,"patterns":[]}')).toThrow()
  })

  it('rejects a file written by a newer, unknown version of the format', () => {
    const tampered = JSON.parse(serializeProject(makeProject()))
    tampered.version = 99

    expect(() => parseProjectsFile(JSON.stringify(tampered))).toThrow()
  })

  it('rejects a file whose projects are not Projects', () => {
    expect(() =>
      parseProjectsFile('{"kind":"openbeads/library","version":3,"projects":[{"id":"x"}]}'),
    ).toThrow()
  })

  it('backfills fields a Project exported by an older version would be missing', () => {
    const file = JSON.parse(serializeProject(makeProject()))
    delete file.projects[0].rowProgress

    const { projects } = parseProjectsFile(JSON.stringify(file))

    expect(projects[0]!.rowProgress).toEqual({
      direction: 'rows',
      currentRow: 0,
      currentColumn: 0,
    })
  })

  it('still imports a file exported before ADR 0026, ignoring the millimetre size it stored and keeping the grid', () => {
    const original = makeProject()
    const file = JSON.parse(serializeProject(original))
    file.projects[0].widthMm = 15
    file.projects[0].heightMm = 15

    const { projects } = parseProjectsFile(JSON.stringify(file))

    expect(projects[0]!.frame!.columns).toBe(original.frame!.columns)
    expect(projects[0]!.frame!.rows).toBe(original.frame!.rows)
    expect(frameGrid(projects[0]!)).toEqual(frameGrid(original))
    expect(projects[0]).not.toHaveProperty('widthMm')
    expect(projects[0]).not.toHaveProperty('heightMm')
  })

  it('writes no millimetre size into a file (ADR 0026)', () => {
    const [project] = JSON.parse(serializeProject(makeProject())).projects

    expect(project).not.toHaveProperty('widthMm')
    expect(project).not.toHaveProperty('heightMm')
  })

  it('still imports a file exported before this change, ignoring its color-to-bead defaults and overrides', () => {
    const file = JSON.parse(serializeProject(makeProject()))
    file.colorBeadDefaults = { red: 'toho-cube-1.5mm' }
    file.projects[0].colorBeadOverrides = { red: 'miyuki-delica-11-0' }

    const { projects } = parseProjectsFile(JSON.stringify(file))

    expect(projects[0]!.id).toBe(file.projects[0].id)
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
    const incoming = paintAt(local, [{ row: 0, column: 0 }], '#2f6fed')

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

describe('Netting in a file (ticket 485)', () => {
  const woven = (netSize: number) =>
    paintAt(createProject({ technique: 'netting', netSize, beadId: cubeBead.id, size: { width: 3, height: 2, unit: 'beads' } }), [{ row: 1, column: 1 }], '#e63746')

  it('keeps the Technique, the Net size and every bead through the file', () => {
    for (const netSize of [3, 5, 9]) {
      const project = woven(netSize)

      const [restored] = parseProjectsFile(serializeProject(project)).projects

      expect(restored).toEqual(project)
      expect(restored).toMatchObject({ technique: 'netting', netSize })
    }
  })

  it('reads a Net size that is not odd from 3 to 9 as 3', () => {
    const file = serializeProject(woven(5)).replace('"netSize":5', '"netSize":4')

    expect(parseProjectsFile(file).projects[0]!.netSize).toBe(3)
  })
})

describe('the Bead copy in a file (ticket 534)', () => {
  it('round-trips the copy of a Bead the catalog does not have', () => {
    const retired = { ...findBead('toho/cube/1.5mm')!, id: 'old-maker/cube/2mm', widthMm: 2 }
    const project = { ...decoratedProject(), beadId: retired.id, bead: retired }
    expect(parseProjectsFile(serializeProject(project)).projects[0]!.bead).toEqual(retired)
  })

  it('opens a version 6 file, which has no copy, with the catalog’s Bead', () => {
    const file = JSON.parse(serializeProject(decoratedProject()))
    file.version = 6
    delete file.projects[0].bead

    expect(parseProjectsFile(JSON.stringify(file)).projects[0]!.bead).toEqual(findBead(decoratedProject().beadId))
  })
})
