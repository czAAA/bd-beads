import { beadCopy, beadLabel, findBead } from './beads'
import { beadsFromColors } from './canvas'
import { weaveOf } from './layerWeave'
import { beadIdOfLayer, frameOf, newLayerId, withLayer } from './layerRecord'
import { normalizeMakerName } from './makerName'
import { defaultPalette, defaultPaletteIds, type PaletteCodes, type PaletteIds } from './palette'
import { lettersOfPalette } from './paletteEdits'
import type { Background, Grid, Project } from './project'
import { gridFromSize, type StatedSize } from './projectSize'
import { INITIAL_ROW_PROGRESS } from './rowProgress'
import type { Technique, TechniqueSettings } from './weave'

// Creating a Project (CONTEXT.md's New Project and Convert image): from a stated size, or from a picture.

export interface CreateProjectInput {
  /** User-chosen name; blank or omitted defaults to the bead's label. */
  name?: string
  technique: Technique
  /** Its Technique's settings (ticket 0625), such as peyote's or brick stitch's Drop (tickets 477, 0691); one left out is its
   * default. */
  techniqueSettings?: TechniqueSettings
  /** The Background both layers start on (ticket 0670); left out, they show the device's last pick. */
  background?: Background
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
  const dimensions = input.size ? gridFromSize(input.size, bead, created.technique) : undefined
  const now = Date.now()
  const name = input.name?.trim() || beadLabel(bead)
  const makerName = normalizeMakerName(input.makerName ?? '')

  const palette = defaultPaletteIds(defaultPalette(bead.id))
  const layer = {
    ...created,
    beadId: bead.id,
    bead: beadCopy(bead),
    ...(input.background !== undefined ? { background: input.background } : {}),
    beads: {},
  }
  return {
    id: crypto.randomUUID(),
    // Both layers take the form's settings (ADR 0079).
    layers: [
      { id: newLayerId(), name, ...layer, orientation: 0 },
      ...(dimensions ? [{ id: newLayerId(), ...layer, row: 0, column: 0, columns: dimensions.columns, rows: dimensions.rows, rowProgress: { ...INITIAL_ROW_PROGRESS } }] : []),
    ],
    palette,
    paletteLetters: lettersOfPalette(palette, bead.id, undefined),
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
  const frame = frameOf(project)!
  const palette = input.palette
  const cells = Array.from({ length: frame.rows }, (_row, rowIndex) =>
    Array.from({ length: frame.columns }, (_cell, columnIndex) => input.grid[rowIndex]?.[columnIndex]?.color ?? null),
  )

  return {
    ...withLayer(project, 'frame', { beads: beadsFromColors(cells) }),
    ...(palette
      ? {
          palette: [...palette.ids],
          paletteLetters: lettersOfPalette(palette.ids, beadIdOfLayer(project, 'frame'), undefined),
          ...(Object.keys(palette.codes).length > 0 ? { paletteCodes: { ...palette.codes } } : {}),
        }
      : {}),
  }
}
