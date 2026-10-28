import { beadCopy, findBead, readBeadCopy, type Bead } from './beads'
import { beadsFromColors, type FrameSheet } from './canvas'
import { normalizeHex } from './color'
import { DEFAULT_FRAME_KIND, isFrameKind, settingsOf, type KindedSheet } from './frameKind'
import type { Rotation } from './grid'
import { frameWeave, unwoven, weaveOf } from './layerWeave'
import { codesInPalette, defaultPalette, normalizePaletteCodes, normalizePaletteIds } from './palette'
import { lettersOfPalette } from './paletteEdits'
import { readPieceNames } from './pieceNames'
import type { Grid, Project } from './project'
import { projectFrame } from './projectExtent'
import { laidOf, readRowProgress } from './rowProgress'
import { isVersionThree, liftVersionThree, type VersionThreeProject } from './versionThree'
import { isTechnique, MAX_BRICK_BLOCK, type Technique, type Weave } from './weave'

// Reading a Project from storage or a file (CONTEXT.md, docs/testing.md's Stored-data compatibility): every shape an
// older app saved becomes today's Project, so nothing else has to know the old ones.

/** A Project as saved before the Canvas (ADR 0026): a fixed `columns` x `rows` grid instead of beads by position and
 * a Frame. Read by normalizeProject only, which gives it a Frame the size of the grid. */
export type GridProject = Omit<Project, 'beads' | 'frame'> & { columns: number; rows: number; grid: Grid }

/** A Project in any shape a store or file has held it in, for normalizeProject to read. */
export type StoredProject = Project | GridProject | VersionThreeProject

function isGridProject(project: StoredProject): project is GridProject {
  return Array.isArray((project as GridProject).grid)
}

/** A Project as an older app may have saved it: with the color-to-bead override (ADR 0007/ticket 36), the stored
 * `widthMm`/`heightMm` (ADR 0026) and ticket 28's `rotated` boolean instead of ticket 171's `rotation`. */
type ProjectWithLegacyFields = Project & {
  columns?: unknown
  rows?: unknown
  grid?: unknown
  colorBeadOverrides?: unknown
  widthMm?: unknown
  heightMm?: unknown
  rotated?: unknown
}

const ROTATIONS: readonly Rotation[] = [0, 90, 180, 270]

/** `rotation` as ticket 171 shipped it, or ticket 28's `rotated` boolean read as its nearest quarter turn, or
 * upright for a Project from before either existed. */
function normalizeRotation(project: ProjectWithLegacyFields): Rotation {
  if (typeof project.rotation === 'number' && (ROTATIONS as readonly number[]).includes(project.rotation)) {
    return project.rotation
  }
  return project.rotated ? 90 : 0
}

/** Fills in fields added after a Project was saved, re-clamps the row pointer and drops dead fields (the color-to-bead
 * override, ADR 0007; the millimetre size, ADR 0026), so a Project from storage or a file is safe whatever version
 * wrote it, and never re-saves them. */
export function normalizeProject(stored: StoredProject): Project {
  // A Project from before the Canvas becomes beads by position with a Frame the size of its old grid; a Project from
  // before the Frame was a sheet of its own has its Frame's beads lifted into it (versionThree.ts, temporary).
  const upright: Project | VersionThreeProject = isGridProject(stored)
    ? {
        ...stored,
        beads: beadsFromColors(stored.grid.map((row) => row.map((cell) => cell.color))),
        frame: { row: 0, column: 0, columns: stored.columns, rows: stored.rows },
      }
    : stored
  const project: Project = isVersionThree(upright) ? liftVersionThree(upright) : upright
  const legacy = project as ProjectWithLegacyFields
  const {
    colorBeadOverrides: _legacyOverrides,
    widthMm: _legacyWidthMm,
    heightMm: _legacyHeightMm,
    rotated: _legacyRotated,
    columns: _legacyColumns,
    rows: _legacyRows,
    grid: _legacyGrid,
    ...rest
  } = legacy

  const technique = project.technique
  // Its own copy when it holds a readable one, otherwise the catalog's Bead of that id, through the alias map (ticket 534).
  const bead = readBeadCopy(legacy.bead) ?? catalogCopy(project.beadId)
  const removedDefaults = readRemovedDefaults(legacy.removedDefaults)
  const palette = normalizePaletteIds(legacy.palette, defaultPalette(project.beadId))
  const paletteCodes = codesInPalette(normalizePaletteCodes(legacy.paletteCodes), palette, defaultPalette(project.beadId))

  const paletteLetters = lettersOfPalette(palette, project.beadId, legacy.paletteLetters)

  const { removedDefaults: _removed, paletteCodes: _codes, paletteLetters: _letters, letters: storedLetters, bead: _storedBead, pieceNames: _stored, beadShape: storedShape, ...withoutNames } = unwoven(rest)
  const pieceNames = readPieceNames(legacy.pieceNames)
  const canvas = readWeave(technique, rest)
  // A Frame stored before it had a Weave of its own (ticket 492) takes the Project's.
  const placed = { beads: project.beads ?? {}, ...(project.frame ? { frame: { ...unwoven(readFrameKind(project.frame)), beads: project.frame.beads ?? {}, ...readFrameWeave(project.frame, canvas) } } : {}) }
  const { rows, columns } = projectFrame(placed)
  const sheet: KindedSheet = { ...frameWeave({ ...canvas, ...placed }), ...laidOf(placed.frame), rows, columns }

  return {
    ...withoutNames,
    ...placed,
    ...canvas,
    // An unreadable or missing Bead shape reads as Symmetric, which is left unsaved.
    ...(storedShape === 'real' ? { beadShape: storedShape } : {}),
    ...(pieceNames.length > 0 ? { pieceNames } : {}),
    rowProgress: readRowProgress(project.rowProgress, sheet),
    // A Project saved before the Palette belonged to it (or with an unreadable one) starts from its Bead's built-in colors.
    palette,
    ...(removedDefaults.length > 0 ? { removedDefaults } : {}),
    ...(Object.keys(paletteCodes).length > 0 ? { paletteCodes } : {}),
    paletteLetters,
    ...(storedLetters === true ? { letters: true } : {}),
    rotation: normalizeRotation(legacy),
    ...(bead ? { beadId: bead.id, bead } : {}),
  }
}

/** The copy a file without one gets: the catalog's Bead of that id, if it knows it. */
function catalogCopy(beadId: string): Bead | undefined {
  const bead = findBead(beadId)
  return bead && beadCopy(bead)
}

/** The removed default colors a stored Project holds: the valid hexes, each once; none for anything else. */
function readRemovedDefaults(stored: unknown): string[] {
  if (!Array.isArray(stored)) return []
  const hexes = stored.flatMap((hex) => (typeof hex === 'string' ? (normalizeHex(hex) ?? []) : []))
  return [...new Set(hexes)]
}

/** A stored Frame's Weave, or the Project's where it has none or an unreadable one. */
function readFrameWeave(stored: Partial<Weave>, fallback: Weave): Weave {
  return isTechnique(stored.technique) ? readWeave(stored.technique, stored) : fallback
}

/** A layer's Weave from the flat fields a file stores (until ticket 0636) as its settings map (ticket 0625), over any
 * map it holds: an unreadable Brick block reads as the default and a valid one is kept even off brick stitch; a Net
 * size is read within its range, on Netting alone. */
function readWeave(technique: Technique, stored: Partial<Weave>): Weave {
  const netSize = typeof stored.netSize === 'number' ? stored.netSize : undefined
  return weaveOf({ technique, techniqueSettings: { ...stored.techniqueSettings, ...flatSetting('brickBlock', readBrickBlock(stored.brickBlock)), ...flatSetting('netSize', netSize) } })
}

/** One flat field as a setting, where it holds a value. */
function flatSetting(id: string, value: number | undefined): Record<string, number> {
  return value === undefined ? {} : { [id]: value }
}

/** A stored Frame with its kind kept only where it is one this build knows and not Rectangular, the default left
 * unsaved (ticket 0591): one without, or with one it does not know, reads as Rectangular. A Custom frame keeps its
 * settings, read within its kind's range (ticket 0592); a Rectangular one has none. */
function readFrameKind({ kind, settings: stored, quarterTurns, ...frame }: FrameSheet): FrameSheet {
  if (!isFrameKind(kind) || kind === DEFAULT_FRAME_KIND) {
    return frame
  }
  const settings = settingsOf({ kind, settings: stored })
  // Rotate Frame's turn (ticket 0594): one, two or three quarters; anything else reads as none.
  const turned = quarterTurns === 1 || quarterTurns === 2 || quarterTurns === 3 ? { quarterTurns } : {}
  return { ...frame, kind, ...(settings ? { settings } : {}), ...turned }
}

/** A stored Brick block if it is a whole number from 1 to MAX_BRICK_BLOCK, otherwise nothing (read as 1). */
function readBrickBlock(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_BRICK_BLOCK ? value : undefined
}
