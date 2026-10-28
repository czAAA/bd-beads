import { beadCopy, beadLabel, findBead } from './beads'
import { beadsFromColors } from './canvas'
import { weaveOf } from './layerWeave'
import { normalizeMakerName } from './makerName'
import { defaultPalette, defaultPaletteIds, type PaletteCodes, type PaletteIds } from './palette'
import { lettersOfPalette } from './paletteEdits'
import type { Grid, Project } from './project'
import { gridFromSize, type StatedSize } from './projectSize'
import { INITIAL_ROW_PROGRESS } from './rowProgress'
import { DEFAULT_BEAD_SHAPE, type BeadShape, type Technique, type TechniqueSettings } from './weave'

// Creating a Project (CONTEXT.md's New Project and Convert image): from a stated size, or from a picture.

export interface CreateProjectInput {
  /** User-chosen name; blank or omitted defaults to the bead's label. */
  name?: string
  technique: Technique
  /** Its Technique's settings (ticket 0625), such as brick stitch's Brick block (ticket 477); one left out is its
   * default. */
  techniqueSettings?: TechniqueSettings
  /** The Bead shape of a new Project; left out is Symmetric. */
  beadShape?: BeadShape
  beadId: string
  /** How big the Frame is, in beads or mm/cm (converted once to a grid, not remembered; ADR 0026). Left out: a Canvas
   * with no Frame. */
  size?: StatedSize
  /** This Project's own maker's name (ticket 182); blank or omitted keeps the device-wide one instead. */
  makerName?: string
}

export function createProject(input: CreateProjectInput): Project {
  const bead = findBead(input.beadId)
  if (!bead) {
    throw new Error(`Unknown bead id: ${input.beadId}`)
  }

  const created = weaveOf(input)
  const dimensions = input.size ? gridFromSize(input.size, bead) : undefined
  const now = Date.now()
  const name = input.name?.trim() || beadLabel(bead)
  const makerName = normalizeMakerName(input.makerName ?? '')

  const palette = defaultPaletteIds(defaultPalette(bead.id))
  return {
    id: crypto.randomUUID(),
    name,
    ...created,
    beadId: bead.id,
    bead: beadCopy(bead),
    ...(input.beadShape && input.beadShape !== DEFAULT_BEAD_SHAPE ? { beadShape: input.beadShape } : {}),
    beads: {},
    ...(dimensions ? { frame: { row: 0, column: 0, columns: dimensions.columns, rows: dimensions.rows, beads: {}, ...weaveOf(created) } } : {}),
    rowProgress: { ...INITIAL_ROW_PROGRESS },
    palette,
    paletteLetters: lettersOfPalette(palette, bead.id, undefined),
    rotation: 0,
    ...(makerName ? { makerName } : {}),
    createdAt: now,
    updatedAt: now,
  }
}

/** A new Project made from a picture (CONTEXT.md's Convert image): the same fields as any other, plus what the
 * conversion produced. */
export interface CreateProjectFromImageInput extends CreateProjectInput {
  /** A picture needs a Frame to land in: the Frame's size, which is also the grid it was sampled at. */
  size: StatedSize
  /** The converted cells, sampled at the Project's own Frame size (see domain/imageConversion.ts). */
  grid: Grid
  /** The Palette the conversion made (spec 0645, convertColors.ts): the built-in colors and every color the beads use,
   * with the Bead colors' codes. Left out, the built-in colors. */
  palette?: { ids: PaletteIds; codes: PaletteCodes }
}

/** Creates a Project from a picture (ticket 58): an ordinary new Project with its cells painted. Conversion only
 * creates, never edits an open Project (ADR 0010). The grid is fitted to the stated dimensions (missing cells empty,
 * surplus dropped), so they never disagree. */
export function createProjectFromImage(input: CreateProjectFromImageInput): Project {
  const project = createProject(input)
  const frame = project.frame!
  const palette = input.palette

  return {
    ...project,
    ...(palette
      ? {
          palette: [...palette.ids],
          paletteLetters: lettersOfPalette(palette.ids, project.beadId, undefined),
          ...(Object.keys(palette.codes).length > 0 ? { paletteCodes: { ...palette.codes } } : {}),
        }
      : {}),
    frame: {
      ...frame,
      beads: beadsFromColors(
        Array.from({ length: frame.rows }, (_row, rowIndex) =>
          Array.from({ length: frame.columns }, (_cell, columnIndex) =>
            input.grid[rowIndex]?.[columnIndex]?.color ?? null,
          ),
        ),
      ),
    },
  }
}
