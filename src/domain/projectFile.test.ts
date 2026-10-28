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
import { createProject } from './createProject'
import { moveToRow } from './rowProgress'
import { setPalette } from './paletteEdits'
import { withWeave } from './weaveSwitch'
import type { Project } from './project'
import { paintCells } from './drawing'
import { changeFrame } from './changeFrame'
import { onLayer } from './layers'
import { frameGrid } from '../testUtils/frameGrid'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!

function makeProject(name = 'Fox'): Project {
  return createProject({
    name,
    technique: 'peyote',
    beadId: cubeBead.id,
    size: { width: 15, height: 15, unit: 'mm' },
  })
}

/** A Project with a five-round Triangle holding two beads, one on its outer round. */
function customFramed(): Project {
  const result = changeFrame(makeProject('Kite'), { custom: { kind: 'triangle', size: 5, centre: { row: 10, column: 10 } } })
  if (result.kind !== 'changed') throw new Error('expected a Triangle')
  return onLayer(result.project, 'frame', (view) => paintCells(view, [{ row: 0, column: 2 }, { row: 4, column: 14 }], '#e63746'))
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
    const project = withWeave(decoratedProject(), 'canvas', { technique: 'brick' })

    const [restored] = parseProjectsFile(serializeProject(project)).projects

    expect(restored!.technique).toBe('brick')
    expect(restored).toEqual(project)
  })

  it('carries a square stitch Project through the file (ticket 0635)', () => {
    const project = withWeave(decoratedProject(), 'canvas', { technique: 'square' })

    expect(parseProjectsFile(serializeProject(project)).projects).toEqual([project])
  })

  it('carries a Brick block through the file, and reads a file without one as 1 (ticket 477)', () => {
    const project = withWeave(decoratedProject(), 'canvas', { technique: 'brick', techniqueSettings: { brickBlock: 3 } })

    const [restored] = parseProjectsFile(serializeProject(project)).projects

    expect(restored!.techniqueSettings).toEqual({ brickBlock: 3 })
    expect(restored).toEqual(project)

    const one = withWeave(decoratedProject(), 'canvas', { technique: 'brick' })
    const file = JSON.parse(serializeProject(one))
    expect(file.projects[0]).not.toHaveProperty('brickBlock')
    expect(parseProjectsFile(JSON.stringify(file)).projects[0]!.techniqueSettings).toEqual({ brickBlock: 1 })
  })

  it('stores each layer\'s settings as the map the app holds, the Brick block in it, with no flat field (ticket 0636)', () => {
    const canvas = withWeave(decoratedProject(), 'canvas', { technique: 'brick', techniqueSettings: { brickBlock: 3 } })
    const project = withWeave(canvas, 'frame', { technique: 'brick', techniqueSettings: { brickBlock: 4 } })
    const [stored] = JSON.parse(serializeProject(project)).projects
    expect(stored).toMatchObject({ technique: 'brick', techniqueSettings: { brickBlock: 3 }, frame: { technique: 'brick', techniqueSettings: { brickBlock: 4 } } })
    expect(stored).not.toHaveProperty('brickBlock')
    expect(stored.frame).not.toHaveProperty('brickBlock')
  })

  it('reads an unreadable Brick block in an earlier version\'s flat field as the default (ticket 477)', () => {
    for (const bad of [0, 21, 2.5, 'two', null]) {
      const file = JSON.parse(serializeProject(withWeave(decoratedProject(), 'canvas', { technique: 'brick' })))
      file.version = 10
      file.projects[0].brickBlock = bad
      expect(parseProjectsFile(JSON.stringify(file)).projects[0]!.techniqueSettings).toEqual({ brickBlock: 1 })
    }
  })

  it('reads an unreadable settings map, or an unreadable value in it, as the defaults (ticket 0636)', () => {
    const brick = withWeave(withWeave(decoratedProject(), 'canvas', { technique: 'brick' }), 'frame', { technique: 'brick' })
    for (const bad of [{ brickBlock: 'two' }, { brickBlock: null }, 'three', null, [3]]) {
      const file = JSON.parse(serializeProject(brick))
      file.projects[0].techniqueSettings = bad
      file.projects[0].frame.techniqueSettings = bad
      const [read] = parseProjectsFile(JSON.stringify(file)).projects
      expect(read!.techniqueSettings).toEqual({ brickBlock: 1 })
      expect(read!.frame!.techniqueSettings).toEqual({ brickBlock: 1 })
    }
  })

  it('reads a flat Brick block only from a file of version 10 or earlier (ticket 0636)', () => {
    const file = JSON.parse(serializeProject(withWeave(decoratedProject(), 'canvas', { technique: 'brick' })))
    file.projects[0].brickBlock = 3
    expect(parseProjectsFile(JSON.stringify(file)).projects[0]!.techniqueSettings).toEqual({ brickBlock: 1 })
    file.version = 10
    expect(parseProjectsFile(JSON.stringify(file)).projects[0]!.techniqueSettings).toEqual({ brickBlock: 3 })
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

  it('writes version 11 with the compact encoding, the Frame\'s beads in the Frame, and the openbeads kind (ADR 0048, 0066)', () => {
    const file = JSON.parse(serializeProject(decoratedProject()))

    expect(file.kind).toBe('openbeads/project')
    expect(file.version).toBe(11)
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
    file.version = 12
    expect(() => parseProjectsFile(JSON.stringify(file))).toThrow('Unsupported openbeads file version: 12')
  })

  it('carries the Palette through a file (ticket 0525), and reads a version 4 file as the built-in twelve', () => {
    const custom = setPalette(decoratedProject(), ['red', addedColorId('#123456'), ...defaultPaletteIds().filter((id) => id !== 'red')])
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

describe('a Technique this build does not know in a file (ticket 0644)', () => {
  it('refuses a Project woven in it, as a file this build cannot read', () => {
    const file = serializeProject(decoratedProject()).replace('"technique":"peyote"', '"technique":"herringbone"')

    expect(() => parseProjectsFile(file)).toThrow()
  })

  it('skips a Project of a library woven in it, and reads the rest', () => {
    const fox = makeProject('Fox')
    const owl = makeProject('Owl')
    const file = JSON.parse(serializeLibrary([fox, owl]))
    file.projects[0].technique = 'herringbone'

    expect(parseProjectsFile(JSON.stringify(file)).projects).toEqual([owl])
  })

  it('reads a Frame woven in it in the Canvas\'s Weave', () => {
    const project = withWeave(decoratedProject(), 'canvas', { technique: 'brick', techniqueSettings: { brickBlock: 3 } })
    const file = JSON.parse(serializeProject(project))
    file.projects[0].frame.technique = 'herringbone'

    expect(parseProjectsFile(JSON.stringify(file)).projects[0]!.frame).toMatchObject({ technique: 'brick', techniqueSettings: { brickBlock: 3 } })
  })
})

describe('the Frame kind in a file (ticket 0591)', () => {
  it('opens a Frame with no kind, or with one this build does not know, as Rectangular, left unsaved', () => {
    const project = decoratedProject()
    const stated = serializeProject(project).replace('"frame":{', '"frame":{"kind":"rectangular",')
    const unknown = serializeProject(project).replace('"frame":{', '"frame":{"kind":"hexagon",')

    expect(stated).toContain('"kind":"rectangular"')
    for (const file of [serializeProject(project), stated, unknown]) {
      const [restored] = parseProjectsFile(file).projects
      expect(restored).toEqual(project)
      expect(restored!.frame).not.toHaveProperty('kind')
    }
  })

  it('carries a Custom frame through a file and the library: its kind, Rounds and beads by layout position (ticket 0592)', () => {
    const triangle = customFramed()
    expect(JSON.parse(serializeProject(triangle)).projects[0].frame).toMatchObject({ kind: 'triangle', settings: { rounds: 5 } })
    expect(parseProjectsFile(serializeProject(triangle)).projects).toEqual([triangle])
    const plain = makeProject()
    expect(parseProjectsFile(serializeLibrary([triangle, plain])).projects).toEqual([triangle, plain])
  })

  it('reads a Custom frame\'s Rounds within its range, and a Rectangular Frame without settings', () => {
    const wide = serializeProject(customFramed()).replace('"rounds":5', '"rounds":400')
    expect(parseProjectsFile(wide).projects[0]!.frame!.settings).toEqual({ rounds: 40 })
    const stray = serializeProject(decoratedProject()).replace('"frame":{', '"frame":{"settings":{"rounds":5},')
    expect(parseProjectsFile(stray).projects[0]!.frame).not.toHaveProperty('settings')
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
