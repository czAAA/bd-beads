import { beforeEach, describe, expect, it } from 'vitest'
import { beadCopy, findBead } from './beads'
import { addedColorId, defaultPalette, defaultPaletteIds } from './palette'
import { lettersFor } from './swatchLetters'
import { framedGrid } from './layerBeads'
import { weaveOf } from './layerWeave'
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
import projectFileV3Framed from './fixtures/project-file-v3-framed-covered.json?raw'
import projectFileV4 from './fixtures/project-file-v4-openbeads.json?raw'
import projectFileV7 from './fixtures/project-file-v7-bead-copy.json?raw'
import projectFileV9Custom from './fixtures/project-file-v9-custom-frame.json?raw'
import projectFileV9Turned from './fixtures/project-file-v9-custom-frame-turned.json?raw'
import projectFileV10Folded from './fixtures/project-file-v10-folded.json?raw'
import projectFileV5Delica from './fixtures/project-file-v5-delica-palette.json?raw'
import projectFileV4Weave from './fixtures/project-file-v4-openbeads-frame-weave.json?raw'
import projectFileBrickBlock from './fixtures/project-file-v3-brick-block.json?raw'
import projectFileV3 from './fixtures/project-file-v3-openbeads.json?raw'
import projectFile from './fixtures/project-file.json?raw'

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

/** The Swatch letters a Project saved before letters opens with (ticket 0573): A, B, C… in Palette order. */
const defaultLetters = lettersFor(defaultPalette(CUBE_COPY.id).map((color) => color.hex), undefined)

/** A Project the way it should read back: every field present, nothing a newer build dropped still hanging on. */
function expectedProject(fields: Partial<Omit<Project, 'beads' | 'frame'>> & Pick<Project, 'id' | 'name' | 'technique'> & { grid: Grid }): Project {
  const { grid: cells, ...rest } = fields
  return {
    beadId: CUBE_COPY.id,
    bead: CUBE_COPY,
    ...framedGrid(cells, weaveOf(fields)),
    ...weaveOf(fields),
    rowProgress: noProgress,
    palette: defaultPaletteIds(),
    paletteLetters: defaultLetters,
    rotation: 0,
    createdAt: 0,
    updatedAt: 0,
    ...rest,
  }
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
const framedOverSketch: Project = {
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
  palette: defaultPaletteIds(),
  paletteLetters: defaultLetters,
  rotation: 0,
  pieceNames: [{ name: 'Sketch', row: 20, column: 2 }],
  createdAt: 1740000000000,
  updatedAt: 1740000001000,
}
const unframedSketch: Project = {
  id: 'v3-unframed',
  name: 'Just a sketch',
  technique: 'peyote',
  beadId: CUBE_COPY.id,
  bead: CUBE_COPY,
  beads: { [-3]: { [-2]: COLORS.B!, [-1]: COLORS.B! }, 4: { 0: COLORS.B! } },
  rowProgress: noProgress,
  palette: defaultPaletteIds(),
  paletteLetters: defaultLetters,
  rotation: 0,
  createdAt: 1740000002000,
  updatedAt: 1740000003000,
}

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
      expect(overCapProject.frame!.columns * overCapProject.frame!.rows).toBeGreaterThan(FORMER_CELL_CAP)
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

      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).patterns.map((stored: { palette: string[] }) => stored.palette)).toEqual([defaultPaletteIds(), defaultPaletteIds()])
      expect(loadProjects()).toEqual(opened)
    })

    it('keeps an unreadable value aside only for a value it cannot read, never for these', () => {
      for (const stored of [libraryV1, libraryV2, libraryV2OverCap, libraryV3, libraryV4]) {
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

      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toMatchObject({ version: 4 })
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
      expect(opened).toMatchObject({ beadId: 'old-maker/cube/2mm', bead: { id: 'old-maker/cube/2mm', widthMm: 2, beadsPerKg: 50000 } })

      expect(parseProjectsFile(serializeProject(opened!)).projects).toEqual([opened])
    })

    it('opens a version 9 file with a Custom frame as its kind, Rounds and beads by layout position, and writes it back the same (ticket 0592)', () => {
      const [opened] = parseProjectsFile(projectFileV9Custom).projects
      expect(opened!.frame).toEqual({ row: 7, column: 7, rows: 12, columns: 10, technique: 'peyote', kind: 'triangle', settings: { rounds: 4 }, beads: { 0: { 1: '#e63746' }, 3: { 11: '#e63746' } } })
      expect(opened!.beads).toEqual({ 0: { 0: '#2fb6ae' } })
      expect(parseProjectsFile(serializeProject(opened!)).projects).toEqual([opened])
    })

    it('opens a version 9 Custom frame turned by Rotate Frame with its turn, and writes it back the same (ticket 0594)', () => {
      const [opened] = parseProjectsFile(projectFileV9Turned).projects
      expect(opened!.frame).toMatchObject({ rows: 10, columns: 12, kind: 'triangle', settings: { rounds: 4 }, quarterTurns: 1 })
      expect(parseProjectsFile(serializeProject(opened!)).projects).toEqual([opened])
    })

    it('opens a version 10 file with the Frame\'s Folded beads beyond its edge, and writes it back the same (ticket 0638)', () => {
      const [opened] = parseProjectsFile(projectFileV10Folded).projects
      expect(opened!.frame).toEqual({ row: 7, column: 7, rows: 6, columns: 2, technique: 'peyote', beads: { 0: { 0: '#e63746' } }, folded: { 1: { 3: '#2f6fed' }, 4: { [-2]: '#27ae60', [-1]: '#27ae60' } } })
      expect(JSON.parse(serializeProject(opened!))).toMatchObject({ version: 10 })
      expect(parseProjectsFile(serializeProject(opened!)).projects).toEqual([opened])
    })

    it('reads a version 4 file and writes it back as version 10 with the built-in Palette (ticket 0525)', () => {
      const [framed] = parseProjectsFile(projectFileV4Weave).projects
      expect(JSON.parse(serializeProject(framed!))).toMatchObject({ version: 10, projects: [{ palette: defaultPaletteIds() }] })
      const library = parseProjectsFile(libraryFileV4Weave).projects
      expect(parseProjectsFile(serializeLibrary(library)).projects).toEqual(library)
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
      expect(framed!.frame).toMatchObject({ technique: framed!.technique })
    })

    it('opens a Project file that holds a Brick block (ticket 477), and one without as 1', async () => {
      const [block] = (await readProjectsFile(new File([await gzipJson(projectFileBrickBlock)], 'c.openbeads'))).projects
      expect(block).toMatchObject({ technique: 'brick', techniqueSettings: { brickBlock: 3 } })
      const [plain] = (await readProjectsFile(new File([await gzipJson(projectFileV3)], 'a.openbeads'))).projects
      expect(plain!.techniqueSettings?.brickBlock ?? 1).toBe(1)
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
