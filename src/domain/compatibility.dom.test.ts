import { frameIdIn } from '../testUtils/frameId'
import { beforeEach, describe, expect, it } from 'vitest'
import { withColorsInPalette } from './paletteEdits'
import { beadCopy, colorCatalogOf, findBead } from './beads'
import { BUILT_IN_COLORS, addedColorId, codesInPalette, codesOfColors, defaultPalette, defaultPaletteIds, paletteColors } from './palette'
import { lettersFor } from './swatchLetters'
import { framedGrid } from './layerBeads'
import { canvasWeave, frameWeave, weaveOf } from './layerWeave'
import { beadCell, columnCycle } from './weave'
import type { FrameSheet } from './canvas'
import type { FlatProject } from './flatWeave'
import type { Grid, Project } from './project'
import { nearestQuarterTurn } from './canvasOrientation'
import { parseProjectsFile, serializeProject } from './projectFile'
import { readProjectsFile } from '../services/projectFileCodec'
import { gzipJson } from '../testUtils/gzipJson'
import { loadProjects, saveProjects } from '../services/libraryStore'
import libraryV1 from './fixtures/library-v1.json?raw'
import libraryV2 from './fixtures/library-v2.json?raw'
import libraryV2OverCap from './fixtures/library-v2-over-cap.json?raw'
import libraryFileV3Framed from './fixtures/library-file-v3-framed-covered.json?raw'
import libraryFileV4 from './fixtures/library-file-v4-openbeads.json?raw'
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
import projectFileV14ThreeBackgrounds from './fixtures/project-file-v14-three-backgrounds.json?raw'
import projectFileV14PeyoteTurned from './fixtures/project-file-v14-peyote-turned-progress.json?raw'
import projectFileV15Placement from './fixtures/project-file-v15-placement.json?raw'
import projectFileV16Sections from './fixtures/project-file-v16-palette-sections.json?raw'
import projectFileV17LastEdited from './fixtures/project-file-v17-last-edited-frame.json?raw'
import projectFileV14LettersByLayer from './fixtures/project-file-v14-letters-by-layer.json?raw'
import projectFileV12Twisted from './fixtures/project-file-v12-canvas-twisted.json?raw'
import projectFileV13Drops from './fixtures/project-file-v13-drops.json?raw'
import projectFileV13Mirror from './fixtures/project-file-v13-mirror.json?raw'
import projectFileV13MirrorAxes from './fixtures/project-file-v13-mirror-axes.json?raw'
import projectFileV13MirrorArea from './fixtures/project-file-v13-mirror-area.json?raw'
import projectFileV13MirrorPlace from './fixtures/project-file-v13-mirror-place.json?raw'
import projectFileV14Reference from './fixtures/project-file-v14-reference.json?raw'
import projectFileV14Progress from './fixtures/project-file-v14-warped-square-progress.json?raw'
import projectFileV14OldKite from './fixtures/project-file-v14-old-kite.json?raw'
import projectFileV14OldStar from './fixtures/project-file-v14-old-star.json?raw'
import projectFileV14OldKaleidocycle from './fixtures/project-file-v14-old-kaleidocycle-joins.json?raw'
import { MIRROR_OFF, mirrorSettingOf } from './mirror'
import libraryV5 from './fixtures/library-v5-layers.json?raw'
import projectFileV5Delica from './fixtures/project-file-v5-delica-palette.json?raw'
import { backgroundOf, beadsOfLayer, canvasOf, frameOf, lastEditedFrameId, lettersOn } from './layerRecord'
import { currentPass, frameRowOrder, moveToRow, ownRowWayOf, rowProgressOf, seenProgressOf, seenWayOf, type OwnRowProgress } from './rowProgress'
import { rowOrderOf } from './frameShape'
import { lieAlike } from './table'
import { changeFrame } from './changeFrame'
import { createProject } from './createProject'
import { rotateFrame } from './rotate'
import { customFrameSize } from './frameShape'
import { frameSheetOf, layersView, withPictureTurned } from '../testUtils/layerFields'
import { frameGeometryOf } from './layers'
import { computeColorQuantities } from './beadQuantities'
import { projectPalette } from './palette'
import { wordChartOf } from './wordChart'

// Stored-data compatibility (ticket 103, ADR 0018): every library and file format the app has written keeps opening as
// exactly the Projects it held, but for those only test devices held before the release, refused (ticket 0391).
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
const noProgress: OwnRowProgress = { direction: 'rows', currentRow: 0, currentColumn: 0 }

/** The Palette a Project saved before it held one opens with (ticket 0528): its Bead's built-in colors, TOHO's set. */
const defaultIds = defaultPaletteIds(defaultPalette(CUBE_COPY.id))
/** The Swatch letters a Project saved before letters opens with (ticket 0573): A, B, C… in Palette order. */
const defaultLetters = lettersFor(defaultPalette(CUBE_COPY.id).map((color) => color.hex), undefined)

/** A Project saved before it held its layers as it reads today (ticket 0664, ADR 0079): its Canvas from its own fields
 * (its rotation the Canvas's orientation) and its Frame with its Row progress, both with its Bead and
 * Letters, each layer named by the Project's id. */
/** A stored Project's layers as this build writes them back (ticket 1092): the Canvas without the Letters it only
 * copied from the Frame, unless the Project is marked as holding each layer's own. */
function ownLetters(project: { layers: Record<string, unknown>[]; lettersByLayer?: boolean }): unknown[] {
  const [{ letters: _shared, ...canvas }, ...frames] = project.layers as [Record<string, unknown>, ...Record<string, unknown>[]]
  return project.lettersByLayer === true ? project.layers : [canvas, ...frames]
}

/** A stored value as this build writes it back: no Bead shape (ticket 0724), a Delica 11/0 copy with its sizes the
 * right way round (ticket 0722), each Project marked as holding its Background positions in the list of three (ticket
 * 1000) and each layer's own Letters, the Canvas's off where it was the Frame's copy (ticket 1092). */
function writtenBack(stored: string): unknown {
  return JSON.parse(stored, (key, value) => {
    // Written back as this build writes: file version 16 (ticket 1225).
    if (key === '' && typeof value?.version === 'number' && value.version >= 13) return { ...value, version: FILE_VERSION }
    if (key === 'beadShape') return undefined
    if (Array.isArray(value?.layers)) {
      const generic = { ...value, ...genericAsAdded(value) }
      const { removedDefaults: _removed, ...painted } = { ...generic, ...paintedAsAdded(generic) }
      return { ...painted, ...inSections(painted), backgroundPositions: 3, lettersByLayer: true, layers: placedFrames(ownLetters(value) as Record<string, unknown>[]) }
    }
    const oldDelica = value?.id === 'miyuki/delica/11-0' && value.widthMm === 1.6 && value.heightMm === 1.3
    return oldDelica ? { ...value, widthMm: 1.3, heightMm: 1.6 } : value
  })
}

/** The current file version, which every Project file is written back as. */
const FILE_VERSION = 17

/** A stored layer list's Frames as file version 15 writes them back (ticket 1185): the Frame's own angle on the table
 * (the Canvas's orientation plus its turn on it) and its centre there in place of its Canvas position and turn, and its
 * Row progress the way it showed. The centre is checked by reading the file back, which lands on the same position. */
function placedFrames([canvas, ...frames]: Record<string, unknown>[]): Record<string, unknown>[] {
  const orientation = (canvas!.orientation as number | undefined) ?? 0
  return [
    canvas!,
    ...frames.map(({ row: _row, column: _column, orientation: turn = 0, rowProgress, ...frame }) => {
      const turns = frame.kind ? 0 : nearestQuarterTurn(orientation) / 90 + (turn as number) / 90
      const own = (rowProgress ?? { currentRow: 0 }) as OwnRowProgress
      const seen = seenProgressOf(frame.kind ? { currentRow: own.currentRow } : own, turns)
      return { ...frame, angle: (orientation + (turn as number)) % 360, centre: { x: expect.any(Number), y: expect.any(Number) }, rowProgress: seen }
    }),
  ]
}

/** A stored Palette as this build writes it back (ticket 1070): a generic color its woven Bead's default colors no
 * longer are is kept as the added color of its hex, the same swatch. */
function genericAsAdded(project: { layers: { beadId: string }[]; palette?: unknown }): { palette?: string[] } {
  if (!Array.isArray(project.palette)) return {}
  const beadId = project.layers.at(-1)!.beadId
  const builtIns = defaultPalette(beadId)
  const generic = [...BUILT_IN_COLORS, ...(findBead(beadId)?.brand.colorFamilies ?? [])]
  return {
    palette: project.palette.map((id: string) => {
      const earlier = builtIns.some((color) => color.id === id) ? undefined : generic.find((color) => color.id === id)
      return earlier ? addedColorId(earlier.hex) : id
    }),
  }
}

/** A stored Palette as this build writes it back (ticket 1124): each color a layer's beads are painted in and the
 * Palette lacks joined last, layer by layer, with the next free Swatch letter, so every bead has a letter. */
function paintedAsAdded(project: { layers: { beadId: string; encodedBeads?: { colors: string[] } }[]; palette?: string[]; paletteLetters?: Record<string, string> }) {
  if (!project.palette) return {}
  const ids = [...project.palette]
  for (const hex of project.layers.flatMap((layer) => layer.encodedBeads?.colors ?? [])) {
    if (!paletteColors(ids).some((color) => color.hex === hex)) ids.push(addedColorId(hex))
  }
  if (ids.length === project.palette.length) return {}
  return { palette: ids, paletteLetters: lettersFor(paletteColors(ids).map((color) => color.hex), project.paletteLetters) }
}

/** A stored Palette as this build writes it back (ADR 0103): in sections, each code, the default colors' too, in the
 * catalog of the Bead it was woven in, every other color in Custom colors, and each code beside by hex. */
function inSections(project: { layers: { beadId: string }[]; palette?: string[]; paletteCodes?: Record<string, string> }) {
  if (!Array.isArray(project.palette)) return {}
  const beadId = project.layers.at(-1)!.beadId
  const catalog = colorCatalogOf(beadId)
  const defaults = Object.fromEntries(defaultPalette(beadId).flatMap((color) => (color.code ? [[color.hex, color.code]] : [])))
  const codes: Record<string, string> = catalog ? { ...defaults, ...project.paletteCodes } : {}
  const sections = new Map<string | undefined, string[]>()
  const held: Record<string, string> = {}
  for (const id of project.palette) {
    const hex = paletteColors([id])[0]!.hex
    const code = codes[hex]
    if (code) held[hex] = code
    const section = code ? catalog : undefined
    sections.set(section, [...(sections.get(section) ?? []), id])
  }
  return { palette: [...sections].map(([section, colors]) => ({ ...(section ? { catalog: section } : {}), colors })), paletteCodes: Object.keys(held).length > 0 ? held : undefined }
}

/** A stored value of file version 12 or library version 5 as this build writes it back (tickets 0691, 0724): the next
 * version, with brick stitch's Drop under its new id where the value held its Brick block, and no Bead shape. */
function withDrops(stored: string, version: number): unknown {
  return { ...(writtenBack(stored.replaceAll('"brickBlock"', '"brickDrop"')) as object), version }
}

function layered(flat: Omit<FlatProject, 'frame'> & { frame?: FrameSheet }): Project {
  const { name, technique, techniqueSettings, beadId, bead, beads, frame, rowProgress, letters, pieceNames, rotation, ...rest } = flat
  const shared = { beadId, ...(bead ? { bead } : {}), ...(letters ? { letters } : {}) }
  const canvas = { id: `${flat.id}:canvas`, name, ...weaveOf({ technique, techniqueSettings }), ...shared, beads, ...(pieceNames ? { pieceNames } : {}), orientation: rotation }
  // Opening adds the colors its beads are painted in to its Palette, so each has a Swatch letter (ticket 1124).
  // Its Frame lies as the Canvas does, its Row progress the way it showed (ticket 1185).
  const seen = seenProgressOf(rowProgress, nearestQuarterTurn(rotation) / 90)
  // Its default colors keep their codes, in its Bead's catalog's section (ADR 0103).
  const codes = rest.paletteCodes ?? codesInPalette(codesOfColors(defaultPalette(beadId)), rest.palette)
  const coded = Object.keys(codes).length > 0 ? { paletteCodes: codes } : {}
  return withColorsInPalette({ ...rest, ...coded, layers: frame ? [canvas, { id: `${flat.id}:frame`, ...shared, ...frame, angle: rotation, rowProgress: seen }] : [canvas] } as Project)
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

/** A Frame over a sketch as library version 4 stored it and the Frame sheet reads it (ADR 0066): the Frame's own beads,
 * counted from its first bead, the Canvas's beside them, the Frame's name its own and the one outside on the Canvas. */
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

    it('keeps a version 3 library aside as one it cannot read, from before the Frame held its beads (ticket 0391)', () => {
      localStorage.setItem(STORAGE_KEY, libraryV3)

      expect(loadProjects()).toEqual([])
      expect(localStorage.getItem('openbeads:patterns:unreadable')).toBe(libraryV3)
    })

    it('opens a version 4 library as it is, and saves it back with the Palette each Project now holds (ticket 0525)', () => {
      localStorage.setItem(STORAGE_KEY, libraryV4Weave)

      const opened = loadProjects()
      expect(opened).toEqual([framedOverSketch, unframedSketch])
      saveProjects(opened)

      const sections = (project: Project) => inSections({ layers: [{ beadId: BEAD }], palette: [...project.palette] }).palette
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).patterns.map((stored: { palette: unknown }) => stored.palette)).toEqual([sections(framedOverSketch), sections(unframedSketch)])
      expect(loadProjects()).toEqual(opened)
    })

    it('opens a version 4 library holding a flat Brick block with it in each layer\'s settings, and saves it back as a map (ticket 0636)', () => {
      localStorage.setItem(STORAGE_KEY, libraryV4BrickBlock)

      const opened = loadProjects()
      expect(layersView(opened[0]!)).toMatchObject({ technique: 'brick', techniqueSettings: { brickDrop: 2 }, frame: { technique: 'brick', techniqueSettings: { brickDrop: 3 }, beads: { 0: { 0: '#e63746' } } } })
      saveProjects(opened)

      const [saved] = JSON.parse(localStorage.getItem(STORAGE_KEY)!).patterns
      expect(saved).toMatchObject({ layers: [{ techniqueSettings: { brickDrop: 2 } }, { techniqueSettings: { brickDrop: 3 } }] })
      expect(saved.layers[0]).not.toHaveProperty('brickBlock')
      expect(loadProjects()).toEqual(opened)
    })

    it('opens a version 5 library as the layers each Project holds, and saves it back the same as version 6, its Brick block as brick stitch\'s Drop (tickets 0664, 0691)', () => {
      localStorage.setItem(STORAGE_KEY, libraryV5)

      const [framed, open] = loadProjects()
      expect(framed!.layers.map((layer) => layer.id)).toEqual(['layer-canvas', 'layer-frame'])
      expect(canvasOf(framed!)).toMatchObject({ name: 'Layered fox', technique: 'brick', techniqueSettings: { brickDrop: 3 }, orientation: 90 })
      // Letters was the Frame's, copied onto the Canvas: the Frame keeps it, the Canvas's own is off (ticket 1092).
      expect([lettersOn(framed!, 'canvas'), lettersOn(framed!, frameIdIn(framed!))]).toEqual([false, true])
      expect(frameOf(framed!)).toMatchObject({ technique: 'peyote', quarterTurns: 1, angle: 180, name: 'Fox', rowProgress: { way: 'up', up: 1 } })
      expect(open!.layers).toEqual([expect.objectContaining({ id: 'open-canvas', name: 'Open sketch', beads: { [-2]: { 4: '#1a1a1a' } }, orientation: 0 })])
      saveProjects(loadProjects())
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(withDrops(libraryV5, 9))
    })

    it('keeps an unreadable value aside only for a value it cannot read, never for these', () => {
      for (const stored of [libraryV1, libraryV2, libraryV2OverCap, libraryV4, libraryV4BrickBlock, libraryV5]) {
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

      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toMatchObject({ version: 9 })
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
    it('opens a gzipped .openbeads Project file (ADR 0048)', async () => {
      const one = new File([await gzipJson(projectFileV12)], 'a.openbeads')
      expect((await readProjectsFile(one)).projects).toEqual(parseProjectsFile(projectFileV12).projects)
    })

    it('refuses a version 3 or 4 file, Project or library, as any version this build does not know (ticket 0391)', async () => {
      for (const [stored, version] of [[projectFileV3Framed, 3], [libraryFileV3Framed, 3], [projectFileV4, 4], [libraryFileV4, 4]] as const) {
        await expect(readProjectsFile(new File([await gzipJson(stored)], 'old.openbeads'))).rejects.toThrow(`Unsupported openbeads file version: ${version}`)
      }
    })

    it('opens a version 7 file with the Bead copy of a Bead the catalog does not have, and writes it back the same (ticket 534)', () => {
      const [opened] = parseProjectsFile(projectFileV7).projects
      expect(layersView(opened!)).toMatchObject({ beadId: 'old-maker/cube/2mm', bead: { id: 'old-maker/cube/2mm', widthMm: 2, beadsPerKg: 50000 } })

      expect(parseProjectsFile(serializeProject(opened!)).projects).toEqual([opened])
    })

    it('opens a version 9 file with a Custom frame as its Frame shape, Rounds and beads by layout position, and writes it back the same (ticket 0592)', () => {
      const [opened] = parseProjectsFile(projectFileV9Custom).projects
      expect(frameSheetOf(opened)).toEqual({ row: 7, column: 7, rows: 12, columns: 10, technique: 'peyote', techniqueSettings: { peyoteDrop: 1 }, shape: 'triangle', settings: { rounds: 4 }, beads: { 0: { 1: '#e63746' }, 3: { 11: '#e63746' } } })
      expect(beadsOfLayer(opened, 'canvas')).toEqual({ 0: { 0: '#2fb6ae' } })
      expect(parseProjectsFile(serializeProject(opened!)).projects).toEqual([opened])
    })

    it('opens a version 9 Custom frame turned by Rotate Frame with its turn, and writes it back the same (ticket 0594)', () => {
      const [opened] = parseProjectsFile(projectFileV9Turned).projects
      expect(frameOf(opened)).toMatchObject({ rows: 10, columns: 12, shape: 'triangle', settings: { rounds: 4 }, quarterTurns: 1 })
      expect(parseProjectsFile(serializeProject(opened!)).projects).toEqual([opened])
    })

    it('keeps a Kaleidocycle\'s Row progress on the join it was on, its old "Close 4–5" now the ring join of pairs 3–4 and 5–6 (ticket 0877)', () => {
      const [opened] = parseProjectsFile(projectFileV14OldKaleidocycle).projects
      expect(frameOf(opened!)).toMatchObject({ shape: 'kaleidocycle', settings: { partSize: 3 } })
      // Saved on the second of the three joins that closed the ring: the Tetras of triangles 4 and 5, one of each pair.
      expect(currentPass(rowProgressOf(opened!, frameIdIn(opened)))).toBe(28)
      const order = frameRowOrder(opened!, frameIdIn(opened))
      expect(order.count).toBe(30)
      expect(order.stepOf?.(28)).toEqual({ kind: 'join', step: 'ring', parts: [3, 4, 5, 6] })
      expect(parseProjectsFile(serializeProject(opened!)).projects).toEqual([opened])
    })

    it('keeps a Warped Square\'s Row progress on the round it was on, now read from its corner pair (ticket 0873)', () => {
      const [opened] = parseProjectsFile(projectFileV14Progress).projects
      expect(currentPass(rowProgressOf(opened!, frameIdIn(opened)))).toBe(2)
      const order = frameRowOrder(opened!, frameIdIn(opened))
      expect(order.stepOf?.(2)).toEqual({ kind: 'round', number: 3 })
      // Saved when round 3 read from its first side's first bead: the same 12 beads, the corner pair first.
      expect(order.positionsOf(2).map(({ column }) => column)).toEqual([11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
      expect(order.positionsOf(2).every(({ row }) => row === 2)).toBe(true)
      expect(parseProjectsFile(serializeProject(opened!)).projects).toEqual([opened])
    })

    it('opens a Frame without a shape turned by Rotate Frame, its beads in its own rows, and writes it back the same (ticket 0667)', () => {
      const [opened] = parseProjectsFile(projectFileV11Turned).projects
      expect(frameSheetOf(opened)).toEqual({ row: 8, column: 6, rows: 5, columns: 4, technique: 'peyote', techniqueSettings: { peyoteDrop: 1 }, quarterTurns: 3, beads: { 0: { 0: '#e63746' }, 4: { 3: '#e63746' } } })
      // Down its own rows, turned three quarters: left to right as it showed (ticket 1185).
      expect(rowProgressOf(opened, frameIdIn(opened))).toEqual({ way: 'right', right: 2 })
      expect(JSON.parse(serializeProject(opened!))).toMatchObject({ version: FILE_VERSION, projects: [{ layers: [{}, { angle: 270 }] }] })
      expect(parseProjectsFile(serializeProject(opened!)).projects).toEqual([opened])
    })

    it('opens a version 10 file with the Frame\'s Folded beads beyond its edge, and writes it back the same (ticket 0638)', () => {
      const [opened] = parseProjectsFile(projectFileV10Folded).projects
      expect(frameSheetOf(opened)).toEqual({ row: 7, column: 7, rows: 6, columns: 2, technique: 'peyote', techniqueSettings: { peyoteDrop: 1 }, beads: { 0: { 0: '#e63746' } }, folded: { 1: { 3: '#2f6fed' }, 4: { [-2]: '#27ae60', [-1]: '#27ae60' } } })
      expect(JSON.parse(serializeProject(opened!))).toMatchObject({ version: FILE_VERSION })
      expect(parseProjectsFile(serializeProject(opened!)).projects).toEqual([opened])
    })

    it('opens a version 6 file with a removed default and a flat Brick block on both layers, the Brick block in each layer\'s settings (ticket 0636)', () => {
      const [opened] = parseProjectsFile(projectFileV6BrickBlock).projects
      expect(layersView(opened!)).toMatchObject({ technique: 'brick', techniqueSettings: { brickDrop: 2 }, beads: { [-3]: { [-1]: '#e63746' } } })
      // The removed defaults only kept a change of Bead from bringing them back, which it no longer does (ADR 0103).
      expect(opened).not.toHaveProperty('removedDefaults')
      expect(frameSheetOf(opened)).toEqual({ row: 0, column: 0, columns: 3, rows: 2, technique: 'brick', techniqueSettings: { brickDrop: 3 }, beads: { 0: { 0: '#1a1a1a', 1: '#ffffff' }, 1: { 1: '#1a1a1a' } } })
      expect(canvasOf(opened!)).not.toHaveProperty('brickBlock')
      expect(parseProjectsFile(serializeProject(opened!)).projects).toEqual([opened])
    })

    it.each([5, 7, 8, 9, 10])('opens the same file labelled version %i as the same Project: every version 5 to 10 stores the Brick block flat (ticket 0636)', (version) => {
      const [six] = parseProjectsFile(projectFileV6BrickBlock).projects

      const relabelled = { ...JSON.parse(projectFileV6BrickBlock), version }

      expect(parseProjectsFile(JSON.stringify(relabelled)).projects).toEqual([six])
    })

    it('opens a version 8 file with a swatch code, the Canvas\'s flat Brick block kept off brick stitch and the Frame\'s in its settings (ticket 0636)', () => {
      const [opened] = parseProjectsFile(projectFileV8BrickBlock).projects
      expect(layersView(opened!)).toMatchObject({ technique: 'loom', techniqueSettings: { brickDrop: 2 }, paletteCodes: { '#123456': { catalog: 'toho', code: 'DB1' } } })
      expect(frameSheetOf(opened)).toEqual({ row: 4, column: 2, columns: 2, rows: 2, technique: 'brick', techniqueSettings: { brickDrop: 4 }, beads: { 1: { 0: '#123456', 1: '#123456' } } })
      expect(parseProjectsFile(serializeProject(opened!)).projects).toEqual([opened])
    })

    it('opens a version 11 file with each layer\'s settings map as it holds it, and writes it back as layers (tickets 0636, 0664)', () => {
      const [opened] = parseProjectsFile(projectFileV11).projects
      expect(layersView(opened!)).toMatchObject({ technique: 'brick', techniqueSettings: { brickDrop: 3 }, beads: { 0: { 0: '#2fb6ae' } } })
      expect(frameSheetOf(opened!)).toEqual({ row: 7, column: 7, rows: 2, columns: 3, technique: 'peyote', techniqueSettings: { brickDrop: 2, peyoteDrop: 1 }, beads: { 1: { 2: '#e63746' } } })
      const written = JSON.parse(serializeProject(opened!))
      expect(written).toMatchObject({ version: FILE_VERSION, projects: [{ layers: [{ techniqueSettings: { brickDrop: 3 } }, { technique: 'peyote', techniqueSettings: { brickDrop: 2 } }] }] })
      expect(parseProjectsFile(JSON.stringify(written)).projects).toEqual([opened])
    })

    it('opens a version 12 file as the layer list it holds, the Canvas first, and writes it back the same as version 13 (tickets 0664, 0691)', () => {
      const [opened] = parseProjectsFile(projectFileV12).projects
      expect(opened!.id).toBe('v12-layers')
      expect(opened!.makerName).toBe('Maria')
      expect(canvasOf(opened!)).toMatchObject({ id: 'layer-canvas', name: 'Layered fox', technique: 'brick', techniqueSettings: { brickDrop: 3 }, beadId: 'miyuki/delica/11-0', orientation: 90, pieceNames: [{ name: 'Tail', row: 30, column: 30 }] })
      expect(lettersOn(opened!, 'canvas')).toBe(false)
      expect(beadsOfLayer(opened!, 'canvas')).toEqual({ 0: { 0: '#2fb6ae' }, 30: { 30: '#e63746', 31: '#e63746' } })
      expect(frameSheetOf(opened!)).toEqual({ row: 8, column: 6, rows: 3, columns: 4, technique: 'peyote', techniqueSettings: { peyoteDrop: 1 }, quarterTurns: 1, name: 'Fox', beads: { 0: { 0: '#e63746', 1: '#1a1a1a' }, 2: { 3: '#e63746' } }, folded: { 1: { 5: '#2f6fed' } } })
      expect(frameOf(opened!)).toMatchObject({ id: 'layer-frame', beadId: 'miyuki/delica/11-0', letters: true, angle: 180, rowProgress: { way: 'up', up: 1 } })
      expect(JSON.parse(serializeProject(opened!))).toEqual(withDrops(projectFileV12, FILE_VERSION))
    })

    it('opens a file whose layers saved a Bead shape, Real, Symmetric or none, drawn in each Bead\'s real cell, and writes no Bead shape back (ticket 0724)', () => {
      const delica = findBead('miyuki/delica/11-0')
      const asSaved = JSON.parse(projectFileV12)
      for (const beadShape of ['real', 'symmetric', undefined]) {
        const layers = asSaved.projects[0].layers.map(({ beadShape: _saved, ...layer }: Record<string, unknown>) => ({ ...layer, ...(beadShape ? { beadShape } : {}) }))
        const [opened] = parseProjectsFile(JSON.stringify({ ...asSaved, projects: [{ ...asSaved.projects[0], layers }] })).projects
        expect([canvasWeave(opened!).cell, frameWeave(opened!, frameIdIn(opened)).cell]).toEqual([beadCell(delica, canvasWeave(opened!).technique), beadCell(delica, frameWeave(opened!, frameIdIn(opened)).technique)])
        expect(opened!.layers.some((layer) => 'beadShape' in layer)).toBe(false)
        expect(serializeProject(opened!)).not.toContain('beadShape')
      }
    })

    it('opens a version 13 file with peyote\'s Drop and brick stitch\'s each under its own id, and writes it back the same (ticket 0691)', () => {
      const [opened] = parseProjectsFile(projectFileV13Drops).projects
      expect(canvasOf(opened!)).toMatchObject({ technique: 'brick', techniqueSettings: { brickDrop: 3, peyoteDrop: 4 } })
      expect(frameOf(opened!)).toMatchObject({ technique: 'peyote', techniqueSettings: { peyoteDrop: 2 } })
      expect(columnCycle(frameWeave(opened!, frameIdIn(opened)))).toBe(4)
      expect(JSON.parse(serializeProject(opened!))).toEqual(writtenBack(projectFileV13Drops))
    })

    /** A first-form file (tickets 0703–0710) as this build writes it back (ticket 0750): the layers' Areas and Canvas
     * Axes gone, the Mirror one record with its place. */
    function placedBack(stored: string, place: unknown): unknown {
      const back = writtenBack(stored) as { projects: { mirror: object; layers: Record<string, unknown>[] }[] }
      const [project] = back.projects
      for (const layer of project!.layers) {
        delete layer.mirrorAxes
        delete layer.mirrorArea
      }
      project!.mirror = { ...project!.mirror, place }
      return back
    }

    it('opens a version 13 file with the first form\'s Mirror on a Frame as the whole-Frame Mirror, and one from before Mirror with it off (tickets 0703, 0750)', () => {
      const [opened] = parseProjectsFile(projectFileV13Mirror).projects
      expect(mirrorSettingOf(opened!)).toEqual({ mode: 'repeat', axes: { leftRight: true, topBottom: false, radial: false }, fold: 2, counts: { leftRight: 2, topBottom: 1 }, place: { layer: 'frame' } })
      expect(JSON.parse(serializeProject(opened!))).toEqual(placedBack(projectFileV13Mirror, { layer: 'frame' }))

      const [older] = parseProjectsFile(projectFileV13Drops).projects
      expect(older!.mirror).toBeUndefined()
      expect(mirrorSettingOf(older!)).toEqual(MIRROR_OFF)
    })

    it('opens a version 13 file with the Canvas\'s Mirror Axes as the whole-Frame Mirror, the Axes dropped (tickets 0704, 0750)', () => {
      const [opened] = parseProjectsFile(projectFileV13MirrorAxes).projects
      expect(mirrorSettingOf(opened!).place).toEqual({ layer: 'frame' })
      expect(canvasOf(opened!)).not.toHaveProperty('mirrorAxes')
      expect(JSON.parse(serializeProject(opened!))).toEqual(placedBack(projectFileV13MirrorAxes, { layer: 'frame' }))
    })

    it('opens a version 13 file with each layer\'s Mirror Area as the Mirror on its Canvas Area, the Frame\'s dropped (tickets 0710, 0750)', () => {
      const [opened] = parseProjectsFile(projectFileV13MirrorArea).projects
      const place = { layer: 'canvas', area: { row: -2, column: 4, rows: 5, columns: 6 } }
      expect(mirrorSettingOf(opened!).place).toEqual(place)
      expect(frameOf(opened!)).not.toHaveProperty('mirrorArea')
      expect(JSON.parse(serializeProject(opened!))).toEqual(placedBack(projectFileV13MirrorArea, place))
    })

    it('opens a version 13 file with the one Mirror of a Project and its place, its unfit Area grown, and writes it back so (tickets 0750, 1029)', () => {
      const [opened] = parseProjectsFile(projectFileV13MirrorPlace).projects
      expect(mirrorSettingOf(opened!)).toEqual({
        mode: 'mirror',
        axes: { leftRight: false, topBottom: true, radial: false },
        fold: 2,
        counts: { leftRight: 1, topBottom: 2 },
        beforeRadial: { leftRight: false, topBottom: true },
        // 5 rows do not fit 2 Top–bottom Axes in Mirror mode on 3-drop brick: the Area opens grown down (ticket 1029).
        place: { layer: 'canvas', area: { row: -2, column: 4, rows: 7, columns: 6 } },
      })
      // The stored Fold 3 is a grid's now: 2 in this Area, which is not square (ticket 0751), and written back so.
      const back = projectFileV13MirrorPlace.replace('"fold":3', '"fold":2').replace('"rows":5,"columns":6}}}', '"rows":7,"columns":6}}}')
      expect(JSON.parse(serializeProject(opened!))).toEqual(writtenBack(back))
    })

    it('opens a version 14 file with a reference image and its picture, and writes it back the same (ticket 0790, ADR 0089)', () => {
      const { projects: [opened], pictures } = parseProjectsFile(projectFileV14Reference)
      expect(opened!.referenceImage).toEqual({
        picture: { name: 'rose.webp', type: 'image/webp', width: 2048, height: 1536, bytes: 421888 },
        place: { x: 310, y: -40, width: 640, angle: 12 },
        opacity: 25,
        shown: false,
      })
      expect(Object.keys(pictures)).toEqual(['v14-reference'])
      expect(JSON.parse(serializeProject(opened!, pictures))).toEqual(writtenBack(projectFileV14Reference))
    })

    it('opens a version 12 file with each layer\'s own Background, its position moved to the nearest of the three, and writes it back so (tickets 0666, 1000)', () => {
      const [opened] = parseProjectsFile(projectFileV12Backgrounds).projects
      // Stored as 3 in the list of five (Stone or Midnight), it shows as 2 (Stone or Ink); the Custom color is untouched.
      expect(backgroundOf(opened!, 'canvas')).toBe(2)
      expect(backgroundOf(opened!, frameIdIn(opened!))).toBe('#336699')
      expect(JSON.parse(serializeProject(opened!))).toEqual(withDrops(projectFileV12Backgrounds.replace('"background":3', '"background":2'), FILE_VERSION))
    })

    it('opens a version 14 file that marks its Background positions as in the list of three as they are, and writes it back the same (ticket 1000)', () => {
      const [opened] = parseProjectsFile(projectFileV14ThreeBackgrounds).projects
      expect(backgroundOf(opened!, 'canvas')).toBe(3)
      expect(backgroundOf(opened!, frameIdIn(opened!))).toBe('#336699')
      expect(opened).not.toHaveProperty('backgroundPositions')
      expect(JSON.parse(serializeProject(opened!))).toEqual(writtenBack(projectFileV14ThreeBackgrounds))
    })

    it('opens a version 14 file that marks each layer\'s Letters as its own as they are, and writes it back the same (ticket 1092)', () => {
      const [opened] = parseProjectsFile(projectFileV14LettersByLayer).projects
      expect([lettersOn(opened!, 'canvas'), lettersOn(opened!, frameIdIn(opened!))]).toEqual([true, false])
      expect(opened).not.toHaveProperty('lettersByLayer')
      expect(JSON.parse(serializeProject(opened!))).toEqual(writtenBack(projectFileV14LettersByLayer))
    })

    it('opens a version 14 file from before each layer had its own Letters with the Canvas\'s off and the Frame\'s as it was (ticket 1092)', () => {
      const [opened] = parseProjectsFile(projectFileV14ThreeBackgrounds).projects
      expect([lettersOn(opened!, 'canvas'), lettersOn(opened!, frameIdIn(opened!))]).toEqual([false, true])
    })

    it('opens a version 12 file from before Backgrounds with none, so each layer shows the device\'s last pick (ticket 0666)', () => {
      const [opened] = parseProjectsFile(projectFileV12).projects
      expect([backgroundOf(opened!, 'canvas'), backgroundOf(opened!, frameIdIn(opened!))]).toEqual([undefined, undefined])
    })

    it('opens a version 14 peyote Frame turned on a turned Canvas looking as last saved: at the angle and the way it showed, the same beads finished (ticket 1185)', () => {
      const [opened] = parseProjectsFile(projectFileV14PeyoteTurned).projects
      // The Canvas's quarter turn plus the Frame's own on it, at the Canvas position it was saved at.
      expect(frameOf(opened!)).toMatchObject({ row: 2, column: 3, rows: 5, columns: 6, quarterTurns: 1, angle: 180 })
      expect(lieAlike(opened!, frameIdIn(opened))).toBe(false)
      // Its own columns from the far end, shown turned half round: left to right, each pointer on the way it showed.
      expect(ownRowWayOf(opened!, undefined, frameIdIn(opened))).toEqual({ direction: 'columns', reversed: true })
      expect(seenWayOf(opened!, frameIdIn(opened))).toBe('right')
      expect(rowProgressOf(opened!, frameIdIn(opened))).toEqual({ way: 'right', right: 3, up: 2, left: 1 })
      // The same passes, so the same beads finished: worked in its own columns from the far end, three passes done.
      const frame = frameOf(opened!)!
      const saved = rowOrderOf({ ...frameWeave(opened!, frameIdIn(opened)), rows: frame.rows, columns: frame.columns }, { direction: 'columns', reversed: true })
      const order = frameRowOrder(opened!, frameIdIn(opened))
      expect(currentPass(rowProgressOf(opened!, frameIdIn(opened)))).toBe(3)
      for (let row = 0; row < frame.rows; row += 1) {
        for (let column = 0; column < frame.columns; column += 1) expect(order.passAt({ row, column })).toBe(saved.passAt({ row, column }))
      }
      expect(JSON.parse(serializeProject(opened!))).toEqual(writtenBack(projectFileV14PeyoteTurned))
      expect(parseProjectsFile(serializeProject(opened!)).projects).toEqual([opened])
    })

    it('opens a version 15 file with the Frame\'s own angle and centre on the table and its way as seen, and writes it back the same (ticket 1185)', () => {
      const [opened] = parseProjectsFile(projectFileV15Placement).projects
      expect(canvasOf(opened!)).toMatchObject({ name: 'Leaning cuff', technique: 'peyote', orientation: 37.5 })
      // Made as it was saved: moved, turned by Rotate Frame about its centre, the Canvas twisted to 37.5° carrying it.
      const made = createProject({ technique: 'peyote', beadId: 'miyuki/delica/11-0', size: { width: 6, height: 5, unit: 'beads' } })
      const moved = changeFrame(made, { move: { rows: 3, columns: -2 } }, frameIdIn(made))
      const saved = withPictureTurned(rotateFrame(moved.kind === 'changed' ? moved.project : made, undefined, frameIdIn(moved.kind === 'changed' ? moved.project : made))!, 37.5)
      const { row, column } = frameOf(saved)!
      expect(frameOf(opened!)).toMatchObject({ row, column, rows: 5, columns: 6, quarterTurns: 1, angle: 127.5 })
      expect(rowProgressOf(opened!, frameIdIn(opened))).toEqual({ way: 'left', left: 2 })
      // Written back as version 16, its Palette in sections (ADR 0103).
      const [stored] = JSON.parse(projectFileV15Placement).projects
      expect(JSON.parse(serializeProject(opened!))).toEqual({ ...JSON.parse(projectFileV15Placement), version: 17, projects: [{ ...stored, ...inSections(stored) }] })
    })

    it('opens a version 16 file with its Palette in sections, each code in its own catalog, and writes it back the same (ADR 0103)', () => {
      const [opened] = parseProjectsFile(projectFileV16Sections).projects
      const palette = projectPalette(opened!)
      expect(palette.sections.map((section) => [section.id, section.colors.length])).toEqual([['miyuki-delica', 16], ['custom', 2], ['toho', 1]])
      expect(palette.byHex('#f15b55')).toMatchObject({ code: '341', catalog: 'toho' })
      expect(palette.byHex('#0d0d0d')).toMatchObject({ code: 'DB10', catalog: 'miyuki-delica', family: 'black' })
      expect(JSON.parse(serializeProject(opened!))).toEqual({ ...JSON.parse(projectFileV16Sections), version: 17 })
    })

    it('opens a version 17 file with its Last edited Frame, and writes it back the same (ticket 1220)', () => {
      const [opened] = parseProjectsFile(projectFileV17LastEdited).projects
      expect(lastEditedFrameId(opened!)).toBe(frameIdIn(opened))
      expect(JSON.parse(serializeProject(opened!))).toEqual(JSON.parse(projectFileV17LastEdited))
      // A Frame the file names that the Project lacks is dropped.
      const gone = projectFileV17LastEdited.replace('"lastEditedFrame":"60c4e391-d153-4f64-b487-5e298cfd5fc2"', '"lastEditedFrame":"nobody"')
      expect(parseProjectsFile(gone).projects[0]!.lastEditedFrame).toBeUndefined()
    })

    it('opens a version 12 file whose Canvas a twist left at any angle, and writes it back the same (ticket 0672)', () => {
      const [opened] = parseProjectsFile(projectFileV12Twisted).projects
      expect(canvasOf(opened!)).toMatchObject({ name: 'Twisted fox', orientation: 37.5 })
      expect(JSON.parse(serializeProject(opened!))).toEqual(withDrops(projectFileV12Twisted, FILE_VERSION))
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
      // Delica's default colors are its codes since ticket 1070, so each of the twelve is the added color of its hex.
      expect(project!.palette).toEqual([...BUILT_IN_COLORS.map((color) => addedColorId(color.hex)), 'added-123456'])
      expect(project).not.toHaveProperty('removedDefaults')
      expect(parseProjectsFile(serializeProject(project!)).projects).toEqual([project])
    })

    it('opens a Kite saved on its old layout on the new one at the same Rows, each bead whose row and place remain in its colour (ticket 0874)', () => {
      const [opened] = parseProjectsFile(projectFileV14OldKite).projects
      // Its saved rectangle, the new layout laid in it, until a Rows change lays it out again.
      expect(frameSheetOf(opened)).toMatchObject({ rows: 40, columns: 11, shape: 'kite', settings: { rows: 21 } })
      const geometry = frameGeometryOf(opened!, frameIdIn(opened))
      expect(geometry.positions()).toHaveLength(242)
      const RED = '#e63746'
      const BLUE = '#2f6fed'
      const GOLD = '#d9b94f'
      // Row 4 holds two beads a wing now and row 5 three, so the old places past them are not shown or counted.
      const kept = beadsOfLayer(opened, frameIdIn(opened))!
      expect(kept).toEqual({ 0: { 0: RED, 1: RED }, 3: { 0: BLUE, 1: BLUE, 2: BLUE, 3: BLUE, 4: BLUE, 5: BLUE }, 4: { 6: RED, 7: RED }, 20: { 0: GOLD, 1: GOLD } })
      const shown = geometry.positions().filter(({ row, column }) => kept[row]?.[column] !== undefined)
      expect(shown.map(({ row, column }) => `${row}:${column}`)).toEqual(['0:0', '0:1', '3:0', '3:2', '3:1', '3:3', '20:0', '20:1'])
      // Row progress stays on row 4, now read back from the right wing.
      expect(currentPass(rowProgressOf(opened!, frameIdIn(opened)))).toBe(3)
      expect(frameRowOrder(opened!, frameIdIn(opened)).stepOf?.(3)).toEqual({ kind: 'row', number: 4 })
      expect(parseProjectsFile(serializeProject(opened!)).projects).toEqual([opened])

      // Back at the first row, a Rows change lays it out in its own rectangle and folds the beads with no place.
      const regrown = changeFrame(moveToRow(opened!, 0, frameIdIn(opened)), { settings: { rows: 22 } }, frameIdIn(moveToRow(opened!, 0, frameIdIn(opened))))
      if (regrown.kind !== 'changed') throw new Error(regrown.kind)
      expect(frameOf(regrown.project)).toMatchObject({ ...customFrameSize('kite', { rows: 22 }, undefined, {}, frameWeave(opened!, frameIdIn(opened)).cell), folded: { 3: { 4: BLUE, 5: BLUE }, 4: { 6: RED, 7: RED } } })
    })

    it('opens a Star saved on the old layout of whole-square arms on the new one at the same Part size, keeping what colours it can place (ticket 0875)', () => {
      const [opened] = parseProjectsFile(projectFileV14OldStar).projects
      expect(frameOf(opened!)).toMatchObject({ shape: 'star', settings: { partSize: 5 } })
      expect(frameGeometryOf(opened!, frameIdIn(opened)).positions()).toHaveLength(125)
      // A bead keeps its name: a square's round keeps its colours where the new round has that name.
      const beads = beadsOfLayer(opened!, frameIdIn(opened!))!
      expect([0, 9].map((column) => beads[0]![column])).toEqual(['#d9b94f', '#d9b94f'])
      expect(beads[3]![1]).toBe('#f2c94c')
      // The old names the new layout lacks are kept as Folded beads: not counted, and written back the same.
      expect(Object.keys(beads[0]!)).toHaveLength(20)
      expect(computeColorQuantities(opened!, projectPalette(opened!), frameIdIn(opened)).reduce((sum, { count }) => sum + count, 0)).toBe(245)
      expect(wordChartOf(opened!, frameIdIn(opened))!.rows).toHaveLength(5 * 5 + 5)
      expect(parseProjectsFile(serializeProject(opened!)).projects).toEqual([opened])
    })
  })
})

describe('swatch codes in a file (ticket 0538)', () => {
  it('writes them in version 8, reads them back, and opens a version 7 file as it was', () => {
    const [seven] = parseProjectsFile(projectFileV7).projects
    expect(seven!.paletteCodes).toBeUndefined()
    const coded = { ...seven!, palette: [...seven!.palette, 'added-123456'], paletteCodes: { '#123456': { catalog: 'miyuki-delica', code: 'DB1' } } }
    expect(parseProjectsFile(serializeProject(coded)).projects[0]!.paletteCodes).toEqual({ '#123456': { catalog: 'miyuki-delica', code: 'DB1' } })
  })
})
