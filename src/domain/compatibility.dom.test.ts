import { beforeEach, describe, expect, it } from 'vitest'
import { beadCopy, findBead } from './beads'
import { addedColorId, defaultPalette, defaultPaletteIds } from './palette'
import { lettersFor } from './swatchLetters'
import { framedGrid } from './layerBeads'
import { weaveOf } from './layerWeave'
import type { FrameSheet } from './canvas'
import type { FlatProject } from './flatWeave'
import type { Grid, Project, RowProgress } from './project'
import { parseLegacyProjectsFile } from '../services/legacyProjectFile'
import { parseProjectsFile, serializeLibrary, serializeProject } from './projectFile'
import { readProjectsFile } from '../services/projectFileCodec'
import { gzipJson } from '../testUtils/gzipJson'
import { loadProjects, saveProjects } from '../services/libraryStore'
import libraryFile from './fixtures/library-file.json?raw'
import libraryV1 from './fixtures/library-v1.json?raw'
import libraryV2 from './fixtures/library-v2.json?raw'
import libraryV2OverCap from './fixtures/library-v2-over-cap.json?raw'
import libraryFileV3 from './fixtures/library-file-v3-openbeads.json?raw'
import libraryFileV3Framed from './fixtures/library-file-v3-framed-covered.json?raw'
import libraryFileV4 from './fixtures/library-file-v4-openbeads.json?raw'
import libraryFileV4Weave from './fixtures/library-file-v4-openbeads-frame-weave.json?raw'
import libraryV3 from './fixtures/library-v3.json?raw'
import libraryV4 from './fixtures/library-v4.json?raw'
import libraryV4Weave from './fixtures/library-v4-frame-weave.json?raw'
import libraryV4BrickBlock from './fixtures/library-v4-brick-block.json?raw'
import projectFileV3Framed from './fixtures/project-file-v3-framed-covered.json?raw'
import projectFileV4 from './fixtures/project-file-v4-openbeads.json?raw'
import projectFileV7 from './fixtures/project-file-v7-bead-copy.json?raw'
import projectFileV9Custom from './fixtures/project-file-v9-custom-frame.json?raw'
import projectFileV9Turned from './fixtures/project-file-v9-custom-frame-turned.json?raw'
import projectFileV10Folded from './fixtures/project-file-v10-folded.json?raw'
import projectFileV6BrickBlock from './fixtures/project-file-v6-removed-defaults-brick-block.json?raw'
import projectFileV8BrickBlock from './fixtures/project-file-v8-swatch-codes-brick-block.json?raw'
import projectFileV11 from './fixtures/project-file-v11-weave-settings.json?raw'
import projectFileV11Turned from './fixtures/project-file-v11-frame-turned.json?raw'
import projectFileV12 from './fixtures/project-file-v12-layers.json?raw'
import projectFileV12Backgrounds from './fixtures/project-file-v12-backgrounds.json?raw'
import projectFileV12Twisted from './fixtures/project-file-v12-canvas-twisted.json?raw'
import libraryV5 from './fixtures/library-v5-layers.json?raw'
import projectFileV5Delica from './fixtures/project-file-v5-delica-palette.json?raw'
import projectFileV4Weave from './fixtures/project-file-v4-openbeads-frame-weave.json?raw'
import projectFileBrickBlock from './fixtures/project-file-v3-brick-block.json?raw'
import projectFileV3 from './fixtures/project-file-v3-openbeads.json?raw'
import projectFile from './fixtures/project-file.json?raw'
import { backgroundOf, beadsOfLayer, canvasOf, frameOf } from './layerRecord'
import { rowProgressOf } from './rowProgress'
import { frameSheetOf, layersView } from '../testUtils/layerFields'

// Stored-data compatibility (ticket 103, ADR 0018): the renderer work changes how a Project is drawn, not how it is
// kept, so every library and file format the app has written must keep opening as exactly the Projects it held.
// Fixtures are literal files generated once, never by the code under test.

const STORAGE_KEY = 'openbeads:patterns'

/** The most cells a Project could be created with before ADR 0019 took the limit away: the fixture below is past it. */
const FORMER_CELL_CAP = 10_000

const COLORS: Record<string, string> = { R: '#c81e3c', B: '#1e64c8', K: '#1f1f1f' }

/** A picture as text, one string per row: a letter is that color's bead, anything else an empty cell. */
function grid(rows: string[]): Grid {
  return rows.map((row) => [...row].map((letter) => ({ color: COLORS[letter] ?? null })))
}

const loomPicture = ['R.B.', '.KR.', 'B..K']
const peyotePicture = ['RRB..', '.KKR.', 'B...R', '..KBB']
const brickPicture = ['R.K', '.BR', 'K.B', 'R..']

const BEAD = 'toho-cube-1.5mm'
/** What a Project saved with that id reads as: the id the catalog builds today and its Bead copy (ticket 534). */
const CUBE_COPY = beadCopy(findBead(BEAD)!)
const noProgress: RowProgress = { direction: 'rows', currentRow: 0, currentColumn: 0 }

/** The Palette a Project saved before it held one opens with (ticket 0528): its Bead's built-in colors, TOHO's set. */
const defaultIds = defaultPaletteIds(defaultPalette(CUBE_COPY.id))
/** The Swatch letters a Project saved before letters opens with (ticket 0573): A, B, C… in Palette order. */
const defaultLetters = lettersFor(defaultPalette(CUBE_COPY.id).map((color) => color.hex), undefined)

/** A Project saved before it held its layers as it reads today (ticket 0664, ADR 0079): its Canvas from its own fields
 * (its rotation the Canvas's orientation) and its Frame with its Row progress, both with its Bead, Bead shape and
 * Letters, each layer named by the Project's id. */
function layered(flat: Omit<FlatProject, 'frame'> & { frame?: FrameSheet }): Project {
  const { name, technique, techniqueSettings, beadId, bead, beadShape, beads, frame, rowProgress, letters, pieceNames, rotation, ...rest } = flat
  const shared = { beadId, ...(bead ? { bead } : {}), ...(beadShape ? { beadShape } : {}), ...(letters ? { letters } : {}) }
  const canvas = { id: `${flat.id}:canvas`, name, ...weaveOf({ technique, techniqueSettings }), ...shared, beads, ...(pieceNames ? { pieceNames } : {}), orientation: rotation }
  return { ...rest, layers: frame ? [canvas, { id: `${flat.id}:frame`, ...shared, ...frame, rowProgress }] : [canvas] }
}

/** A Project the way it should read back: every field present, nothing a newer build dropped still hanging on. */
function expectedProject(fields: Partial<Omit<FlatProject, 'beads' | 'frame'>> & Pick<FlatProject, 'id' | 'name' | 'technique'> & { grid: Grid }): Project {
  const { grid: cells, ...rest } = fields
  const [, frame] = framedGrid(cells, weaveOf(fields)).layers
  const { id: _id, beadId: _beadId, rowProgress: _progress, ...sheet } = frame!
  return layered({
    beadId: CUBE_COPY.id,
    bead: CUBE_COPY,
    beads: {},
    frame: sheet,
    ...weaveOf(fields),
    rowProgress: noProgress,
    palette: defaultIds,
    paletteLetters: defaultLetters,
    rotation: 0,
    createdAt: 0,
    updatedAt: 0,
    ...rest,
  })
}

/** The bead's label, which a Project saved before names existed takes as its own. */
const CUBE_LABEL = 'TOHO Cube 1.5mm'

const v1Library: Project[] = [
  expectedProject({
    id: 'v1-oldest',
    name: CUBE_LABEL,
    technique: 'loom',
    grid: grid(loomPicture),
    // Saved before direction and the column pointer existed: they come back defaulted, the row pointer as it was.
    rowProgress: { direction: 'rows', currentRow: 1, currentColumn: 0 },
    createdAt: 1700000000000,
    updatedAt: 1700000001000,
  }),
  expectedProject({
    id: 'v1-later',
    name: 'Peyote strap',
    technique: 'peyote',
    grid: grid(peyotePicture),
    rowProgress: { direction: 'columns', currentRow: 2, currentColumn: 3 },
    rotation: 90,
    createdAt: 1700000002000,
    updatedAt: 1700000003000,
  }),
]

const v2Library: Project[] = [
  expectedProject({
    id: 'v2-brick',
    name: 'Brick swatch',
    technique: 'brick',
    grid: grid(brickPicture),
    createdAt: 1710000000000,
    updatedAt: 1710000001000,
  }),
  expectedProject({
    id: 'v2-loom',
    name: 'Loom rotated',
    technique: 'loom',
    grid: grid(loomPicture),
    rowProgress: { direction: 'columns', currentRow: 2, currentColumn: 1 },
    rotation: 90,
    createdAt: 1710000002000,
    updatedAt: 1710000003000,
  }),
]

/** 101 × 101 = 10,201 beads, one past the cap's worth of rows: rows cycle red, empty, blue. */
const overCapRows = Array.from({ length: 101 }, (_row, row) => ['R', '.', 'B'][row % 3]!.repeat(101))
const overCapProject = expectedProject({
  id: 'v2-over-cap',
  name: 'Over the cap',
  technique: 'peyote',
  grid: grid(overCapRows),
  rowProgress: { direction: 'rows', currentRow: 50, currentColumn: 0 },
  createdAt: 1720000000000,
  updatedAt: 1720000001000,
})

const fileRowProgress: RowProgress = { direction: 'rows', currentRow: 1, currentColumn: 0 }
const fileProjects = {
  peyote: expectedProject({
    id: 'file-one',
    name: 'Shared peyote',
    technique: 'peyote',
    grid: grid(peyotePicture),
    rowProgress: fileRowProgress,
    createdAt: 1730000000000,
    updatedAt: 1730000001000,
  }),
  loom: expectedProject({
    id: 'file-a',
    name: 'Loom in a file',
    technique: 'loom',
    grid: grid(loomPicture),
    rowProgress: fileRowProgress,
    createdAt: 1730000000000,
    updatedAt: 1730000001000,
  }),
  brick: expectedProject({
    id: 'file-b',
    name: 'Brick in a file',
    technique: 'brick',
    grid: grid(brickPicture),
    rowProgress: fileRowProgress,
    createdAt: 1730000000000,
    updatedAt: 1730000001000,
  }),
}

/** What version 3 stored as a Frame over a sketch and what the Frame sheet reads it as (ADR 0066): the beads inside the
 * old Frame are the Frame's own, counted from its first bead; the bead it covered is an ordinary Canvas bead; the name
 * anchored inside the Frame is the Frame's, the one outside stays on the Canvas. */
const framedOverSketch: Project = layered({
  id: 'v3-framed',
  name: 'Framed over a sketch',
  technique: 'loom',
  beadId: CUBE_COPY.id,
  bead: CUBE_COPY,
  beads: { 7: { 4: COLORS.R! }, 20: { 2: COLORS.B!, 3: COLORS.B!, 4: COLORS.B! } },
  frame: {
    technique: 'loom',
    row: 6,
    column: 4,
    columns: 4,
    rows: 3,
    name: 'Ornament',
    beads: { 0: { 0: COLORS.R!, 1: COLORS.B!, 3: COLORS.K! }, 1: { 1: COLORS.K!, 2: COLORS.K! } },
  },
  rowProgress: { direction: 'rows', currentRow: 1, currentColumn: 0 },
  palette: defaultIds,
  paletteLetters: defaultLetters,
  rotation: 0,
  pieceNames: [{ name: 'Sketch', row: 20, column: 2 }],
  createdAt: 1740000000000,
  updatedAt: 1740000001000,
})
const unframedSketch: Project = layered({
  id: 'v3-unframed',
  name: 'Just a sketch',
  technique: 'peyote',
  beadId: CUBE_COPY.id,
  bead: CUBE_COPY,
  beads: { [-3]: { [-2]: COLORS.B!, [-1]: COLORS.B! }, 4: { 0: COLORS.B! } },
  rowProgress: noProgress,
  palette: defaultIds,
  paletteLetters: defaultLetters,
  rotation: 0,
  createdAt: 1740000002000,
  updatedAt: 1740000003000,
})

beforeEach(() => {
  localStorage.clear()
})

describe('stored-data compatibility', () => {
  describe('the browser library', () => {
    it('opens a version 1 library (a bare array, an object per cell) as the Projects it held', () => {
      localStorage.setItem(STORAGE_KEY, libraryV1)

      expect(loadProjects()).toEqual(v1Library)
    })

    it('opens a version 2 library (the versioned envelope, compact cells) as the Projects it held', () => {
      localStorage.setItem(STORAGE_KEY, libraryV2)

      expect(loadProjects()).toEqual(v2Library)
    })

    it('opens a Project larger than the current cell cap, every bead where it was', () => {
      expect(frameOf(overCapProject)!.columns * frameOf(overCapProject)!.rows).toBeGreaterThan(FORMER_CELL_CAP)
      localStorage.setItem(STORAGE_KEY, libraryV2OverCap)

      expect(loadProjects()).toEqual([overCapProject])
    })

    it('opens a version 3 library (the Frame a rectangle of the Canvas, beads it covered kept aside) as the same picture on the Frame sheet (ADR 0066)', () => {
      localStorage.setItem(STORAGE_KEY, libraryV3)

      expect(loadProjects()).toEqual([framedOverSketch, unframedSketch])
    })

    it('opens a version 4 library as it is, and saves it back with the Palette each Project now holds (ticket 0525)', () => {
      localStorage.setItem(STORAGE_KEY, libraryV4Weave)

      const opened = loadProjects()
      expect(opened).toEqual([framedOverSketch, unframedSketch])
      saveProjects(opened)

      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).patterns.map((stored: { palette: string[] }) => stored.palette)).toEqual([defaultIds, defaultIds])
      expect(loadProjects()).toEqual(opened)
    })

    it('opens a version 4 library holding a flat Brick block with it in each layer\'s settings, and saves it back as a map (ticket 0636)', () => {
      localStorage.setItem(STORAGE_KEY, libraryV4BrickBlock)

      const opened = loadProjects()
      expect(layersView(opened[0]!)).toMatchObject({ technique: 'brick', techniqueSettings: { brickBlock: 2 }, frame: { technique: 'brick', techniqueSettings: { brickBlock: 3 }, beads: { 0: { 0: '#e63746' } } } })
      saveProjects(opened)

      const [saved] = JSON.parse(localStorage.getItem(STORAGE_KEY)!).patterns
      expect(saved).toMatchObject({ layers: [{ techniqueSettings: { brickBlock: 2 } }, { techniqueSettings: { brickBlock: 3 } }] })
      expect(saved.layers[0]).not.toHaveProperty('brickBlock')
      expect(loadProjects()).toEqual(opened)
    })

    it('opens a version 5 library as the layers each Project holds, and saves it back byte for byte (ticket 0664)', () => {
      localStorage.setItem(STORAGE_KEY, libraryV5)

      const [framed, open] = loadProjects()
      expect(framed!.layers.map((layer) => layer.id)).toEqual(['layer-canvas', 'layer-frame'])
      expect(canvasOf(framed!)).toMatchObject({ name: 'Layered fox', technique: 'brick', techniqueSettings: { brickBlock: 3 }, beadShape: 'real', letters: true, orientation: 90 })
      expect(frameOf(framed!)).toMatchObject({ technique: 'peyote', quarterTurns: 1, name: 'Fox', beadShape: 'real', rowProgress: { currentRow: 1 } })
      expect(open!.layers).toEqual([expect.objectContaining({ id: 'open-canvas', name: 'Open sketch', beads: { [-2]: { 4: '#1a1a1a' } }, orientation: 0 })])
      saveProjects(loadProjects())
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(JSON.parse(libraryV5))
    })

    it('keeps an unreadable value aside only for a value it cannot read, never for these', () => {
      for (const stored of [libraryV1, libraryV2, libraryV2OverCap, libraryV3, libraryV4, libraryV4BrickBlock, libraryV5]) {
        localStorage.setItem(STORAGE_KEY, stored)
        loadProjects()
      }

      expect(localStorage.getItem('openbeads:patterns:unreadable')).toBeNull()
    })

    it.each([
      ['version 1', libraryV1, v1Library],
      ['version 2', libraryV2, v2Library],
      ['over-cap', libraryV2OverCap, [overCapProject]],
    ])('saves a %s library back in the current format and reads it back the same', (_label, stored, expected) => {
      localStorage.setItem(STORAGE_KEY, stored)

      saveProjects(loadProjects())

      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toMatchObject({ version: 5 })
      expect(loadProjects()).toEqual(expected)
    })

    it('writes the current format the same way every time: save, load, save again is byte-for-byte the same', () => {
      localStorage.setItem(STORAGE_KEY, libraryV2)

      saveProjects(loadProjects())
      const first = localStorage.getItem(STORAGE_KEY)
      saveProjects(loadProjects())

      expect(localStorage.getItem(STORAGE_KEY)).toBe(first)
    })
  })

  describe('Project files', () => {
    it('opens a single-Project file as the Project it held (plain JSON, before ADR 0048)', () => {
      expect(parseLegacyProjectsFile(projectFile).projects).toEqual([fileProjects.peyote])
    })

    it('opens a whole-library file as every Project it held, in order (plain JSON, before ADR 0048)', () => {
      expect(parseLegacyProjectsFile(libraryFile).projects).toEqual([fileProjects.loom, fileProjects.brick])
    })

    it('opens a gzipped .openbeads Project file and library file (ADR 0048)', async () => {
      const one = new File([await gzipJson(projectFileV3)], 'a.openbeads')
      const many = new File([await gzipJson(libraryFileV3)], 'b.openbeads')
      expect((await readProjectsFile(one)).projects).toEqual([fileProjects.peyote])
      expect((await readProjectsFile(many)).projects).toEqual([fileProjects.loom, fileProjects.brick])
    })

    it('opens a version 3 file with a Frame over a covered sketch as the same picture on the Frame sheet, and a version 4 file as it is (ADR 0066)', async () => {
      const one = await readProjectsFile(new File([await gzipJson(projectFileV3Framed)], 'd.openbeads'))
      const many = await readProjectsFile(new File([await gzipJson(libraryFileV3Framed)], 'e.openbeads'))
      expect(one.projects).toEqual([framedOverSketch])
      expect(many.projects).toEqual([framedOverSketch, unframedSketch])
      expect((await readProjectsFile(new File([await gzipJson(projectFileV4)], 'f.openbeads'))).projects).toEqual([framedOverSketch])
      expect((await readProjectsFile(new File([await gzipJson(libraryFileV4)], 'g.openbeads'))).projects).toEqual([framedOverSketch, unframedSketch])
    })

    it('opens a version 7 file with the Bead copy of a Bead the catalog does not have, and writes it back the same (ticket 534)', () => {
      const [opened] = parseProjectsFile(projectFileV7).projects
      expect(layersView(opened!)).toMatchObject({ beadId: 'old-maker/cube/2mm', bead: { id: 'old-maker/cube/2mm', widthMm: 2, beadsPerKg: 50000 } })

      expect(parseProjectsFile(serializeProject(opened!)).projects).toEqual([opened])
    })

    it('opens a version 9 file with a Custom frame as its Frame shape, Rounds and beads by layout position, and writes it back the same (ticket 0592)', () => {
      const [opened] = parseProjectsFile(projectFileV9Custom).projects
      expect(frameSheetOf(opened)).toEqual({ row: 7, column: 7, rows: 12, columns: 10, technique: 'peyote', shape: 'triangle', settings: { rounds: 4 }, beads: { 0: { 1: '#e63746' }, 3: { 11: '#e63746' } } })
      expect(beadsOfLayer(opened, 'canvas')).toEqual({ 0: { 0: '#2fb6ae' } })
      expect(parseProjectsFile(serializeProject(opened!)).projects).toEqual([opened])
    })

    it('opens a version 9 Custom frame turned by Rotate Frame with its turn, and writes it back the same (ticket 0594)', () => {
      const [opened] = parseProjectsFile(projectFileV9Turned).projects
      expect(frameOf(opened)).toMatchObject({ rows: 10, columns: 12, shape: 'triangle', settings: { rounds: 4 }, quarterTurns: 1 })
      expect(parseProjectsFile(serializeProject(opened!)).projects).toEqual([opened])
    })

    it('opens a Frame without a shape turned by Rotate Frame, its beads in its own rows, and writes it back the same (ticket 0667)', () => {
      const [opened] = parseProjectsFile(projectFileV11Turned).projects
      expect(frameSheetOf(opened)).toEqual({ row: 8, column: 6, rows: 5, columns: 4, technique: 'peyote', quarterTurns: 3, beads: { 0: { 0: '#e63746' }, 4: { 3: '#e63746' } } })
      expect(rowProgressOf(opened)).toMatchObject({ direction: 'rows', currentRow: 2 })
      expect(JSON.parse(serializeProject(opened!))).toMatchObject({ version: 12, projects: [{ layers: [{}, { orientation: 270 }] }] })
      expect(parseProjectsFile(serializeProject(opened!)).projects).toEqual([opened])
    })

    it('opens a version 10 file with the Frame\'s Folded beads beyond its edge, and writes it back the same (ticket 0638)', () => {
      const [opened] = parseProjectsFile(projectFileV10Folded).projects
      expect(frameSheetOf(opened)).toEqual({ row: 7, column: 7, rows: 6, columns: 2, technique: 'peyote', beads: { 0: { 0: '#e63746' } }, folded: { 1: { 3: '#2f6fed' }, 4: { [-2]: '#27ae60', [-1]: '#27ae60' } } })
      expect(JSON.parse(serializeProject(opened!))).toMatchObject({ version: 12 })
      expect(parseProjectsFile(serializeProject(opened!)).projects).toEqual([opened])
    })

    it('reads a version 4 file and writes it back as version 12 with the built-in Palette (tickets 0525, 0664)', () => {
      const [framed] = parseProjectsFile(projectFileV4Weave).projects
      expect(JSON.parse(serializeProject(framed!))).toMatchObject({ version: 12, projects: [{ palette: defaultIds }] })
      const library = parseProjectsFile(libraryFileV4Weave).projects
      expect(parseProjectsFile(serializeLibrary(library)).projects).toEqual(library)
    })

    it('opens a version 6 file with a removed default and a flat Brick block on both layers, the Brick block in each layer\'s settings (ticket 0636)', () => {
      const [opened] = parseProjectsFile(projectFileV6BrickBlock).projects
      expect(layersView(opened!)).toMatchObject({ technique: 'brick', techniqueSettings: { brickBlock: 2 }, removedDefaults: ['#2fb6ae'], beads: { [-3]: { [-1]: '#e63746' } } })
      expect(frameSheetOf(opened)).toEqual({ row: 0, column: 0, columns: 3, rows: 2, technique: 'brick', techniqueSettings: { brickBlock: 3 }, beads: { 0: { 0: '#1a1a1a', 1: '#ffffff' }, 1: { 1: '#1a1a1a' } } })
      expect(canvasOf(opened!)).not.toHaveProperty('brickBlock')
      expect(parseProjectsFile(serializeProject(opened!)).projects).toEqual([opened])
    })

    it.each([4, 5, 7, 8, 9, 10])('opens the same file labelled version %i as the same Project: every version 4 to 10 stores the Brick block flat (ticket 0636)', (version) => {
      const [six] = parseProjectsFile(projectFileV6BrickBlock).projects

      const relabelled = { ...JSON.parse(projectFileV6BrickBlock), version }

      expect(parseProjectsFile(JSON.stringify(relabelled)).projects).toEqual([six])
    })

    it('opens a version 8 file with a swatch code, the Canvas\'s flat Brick block kept off brick stitch and the Frame\'s in its settings (ticket 0636)', () => {
      const [opened] = parseProjectsFile(projectFileV8BrickBlock).projects
      expect(layersView(opened!)).toMatchObject({ technique: 'loom', techniqueSettings: { brickBlock: 2 }, paletteCodes: { '#123456': 'DB1' } })
      expect(frameSheetOf(opened)).toEqual({ row: 4, column: 2, columns: 2, rows: 2, technique: 'brick', techniqueSettings: { brickBlock: 4 }, beads: { 1: { 0: '#123456', 1: '#123456' } } })
      expect(parseProjectsFile(serializeProject(opened!)).projects).toEqual([opened])
    })

    it('opens a version 11 file with each layer\'s settings map as it holds it, and writes it back as layers (tickets 0636, 0664)', () => {
      const [opened] = parseProjectsFile(projectFileV11).projects
      expect(layersView(opened!)).toMatchObject({ technique: 'brick', techniqueSettings: { brickBlock: 3 }, beads: { 0: { 0: '#2fb6ae' } } })
      expect(frameSheetOf(opened!)).toEqual({ row: 7, column: 7, rows: 2, columns: 3, technique: 'peyote', techniqueSettings: { brickBlock: 2 }, beads: { 1: { 2: '#e63746' } } })
      const written = JSON.parse(serializeProject(opened!))
      expect(written).toMatchObject({ version: 12, projects: [{ layers: [{ techniqueSettings: { brickBlock: 3 } }, { technique: 'peyote', techniqueSettings: { brickBlock: 2 } }] }] })
      expect(parseProjectsFile(JSON.stringify(written)).projects).toEqual([opened])
    })

    it('opens a version 12 file as the layer list it holds, the Canvas first, and writes it back the same (ticket 0664)', () => {
      const [opened] = parseProjectsFile(projectFileV12).projects
      expect(opened!.id).toBe('v12-layers')
      expect(opened!.makerName).toBe('Maria')
      expect(canvasOf(opened!)).toMatchObject({ id: 'layer-canvas', name: 'Layered fox', technique: 'brick', techniqueSettings: { brickBlock: 3 }, beadId: 'miyuki/delica/11-0', beadShape: 'real', letters: true, orientation: 90, pieceNames: [{ name: 'Tail', row: 30, column: 30 }] })
      expect(beadsOfLayer(opened!, 'canvas')).toEqual({ 0: { 0: '#2fb6ae' }, 30: { 30: '#e63746', 31: '#e63746' } })
      expect(frameSheetOf(opened!)).toEqual({ row: 8, column: 6, rows: 3, columns: 4, technique: 'peyote', quarterTurns: 1, name: 'Fox', beads: { 0: { 0: '#e63746', 1: '#1a1a1a' }, 2: { 3: '#e63746' } }, folded: { 1: { 5: '#2f6fed' } } })
      expect(frameOf(opened!)).toMatchObject({ id: 'layer-frame', beadId: 'miyuki/delica/11-0', beadShape: 'real', letters: true, rowProgress: { direction: 'rows', currentRow: 1, currentColumn: 0 } })
      expect(JSON.parse(serializeProject(opened!))).toEqual(JSON.parse(projectFileV12))
    })

    it('opens a version 12 file with each layer\'s own Background, and writes it back the same (ticket 0666)', () => {
      const [opened] = parseProjectsFile(projectFileV12Backgrounds).projects
      expect(backgroundOf(opened!, 'canvas')).toBe(3)
      expect(backgroundOf(opened!, 'frame')).toBe('#336699')
      expect(JSON.parse(serializeProject(opened!))).toEqual(JSON.parse(projectFileV12Backgrounds))
    })

    it('opens a version 12 file from before Backgrounds with none, so each layer shows the device\'s last pick (ticket 0666)', () => {
      const [opened] = parseProjectsFile(projectFileV12).projects
      expect([backgroundOf(opened!, 'canvas'), backgroundOf(opened!, 'frame')]).toEqual([undefined, undefined])
    })

    it('opens a version 12 file whose Canvas a twist left at any angle, and writes it back the same (ticket 0672)', () => {
      const [opened] = parseProjectsFile(projectFileV12Twisted).projects
      expect(canvasOf(opened!)).toMatchObject({ name: 'Twisted fox', orientation: 37.5 })
      expect(JSON.parse(serializeProject(opened!))).toEqual(JSON.parse(projectFileV12Twisted))
    })

    it('keeps every Frame a version 12 file holds, and a Frame\'s own Piece names, though the app shows one (ticket 0664)', () => {
      const file = JSON.parse(projectFileV12)
      const second = { ...file.projects[0].layers[1], id: 'layer-second', pieceNames: [{ name: 'Ear', row: 0, column: 0 }] }
      file.projects[0].layers.push(second)
      const [opened] = parseProjectsFile(JSON.stringify(file)).projects
      expect(opened!.layers.map((layer) => layer.id)).toEqual(['layer-canvas', 'layer-frame', 'layer-second'])
      expect(opened!.layers[2]!.pieceNames).toEqual([{ name: 'Ear', row: 0, column: 0 }])
      expect(parseProjectsFile(serializeProject(opened!)).projects).toEqual([opened])
    })

    it('opens a version 5 file written on Delica with the twelve and an added color showing the same swatches (ticket 0528)', () => {
      const [project] = parseProjectsFile(projectFileV5Delica).projects
      expect(project!.palette).toEqual(['black', 'white', 'red', 'orange', 'yellow', 'green', addedColorId('#2fb6ae'), 'blue', 'purple', 'pink', 'brown', 'grey', 'added-123456'])
      expect(project!.removedDefaults).toBeUndefined()
      expect(parseProjectsFile(serializeProject(project!)).projects).toEqual([project])
    })

    it('gives the Frame of a file written before it had a Weave of its own the Project\'s (ticket 492)', () => {
      expect(parseProjectsFile(projectFileV4).projects).toEqual([framedOverSketch])
    })

    it('gives the Frame of a version 3 file the Project\'s Weave, Brick block included (ticket 492)', async () => {
      const [framed] = (await readProjectsFile(new File([await gzipJson(projectFileV3Framed)], 'd.openbeads'))).projects
      expect(frameOf(framed)).toMatchObject({ technique: canvasOf(framed).technique })
    })

    it('opens a Project file that holds a Brick block (ticket 477), and one without as 1', async () => {
      const [block] = (await readProjectsFile(new File([await gzipJson(projectFileBrickBlock)], 'c.openbeads'))).projects
      expect(canvasOf(block!)).toMatchObject({ technique: 'brick', techniqueSettings: { brickBlock: 3 } })
      const [plain] = (await readProjectsFile(new File([await gzipJson(projectFileV3)], 'a.openbeads'))).projects
      expect(canvasOf(plain).techniqueSettings?.brickBlock ?? 1).toBe(1)
    })
  })
})

describe('swatch codes in a file (ticket 0538)', () => {
  it('writes them in version 8, reads them back, and opens a version 7 file as it was', () => {
    const [seven] = parseProjectsFile(projectFileV7).projects
    expect(seven!.paletteCodes).toBeUndefined()
    const coded = { ...seven!, palette: [...seven!.palette, 'added-123456'], paletteCodes: { '#123456': 'DB1' } }
    expect(parseProjectsFile(serializeProject(coded)).projects[0]!.paletteCodes).toEqual({ '#123456': 'DB1' })
  })
})
