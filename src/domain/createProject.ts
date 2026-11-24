import { DEFAULT_BEAD, beadCopy, beadLabel, findBead } from './beads'
import { beadsFromColors } from './canvas'
import { weaveOf } from './layerWeave'
import { newLayerId, startingRowProgressOf, withCanvas, withFrameFields, withLayer, withStartingRowProgress, firstFrameId, frameById } from './layerRecord'
import { normalizeMakerName } from './makerName'
import { codesOfColors, defaultPalette, defaultPaletteIds, type PaletteCodes, type PaletteIds } from './palette'
import { lettersOfPalette } from './paletteEdits'
import type { Background, Grid, Project } from './project'
import { gridFromSize, type StatedSize } from './projectSize'
import { DEFAULT_TECHNIQUE, startOrientation, type Technique, type TechniqueSettings } from './weave'

// Creating a Project (CONTEXT.md's New Project and Convert image): from a stated size, or from a picture. A new peyote
// Canvas starts turned a quarter, so its staggered columns lie as staggered rows, the way a weaver pictures it; one made
// from a picture starts upright, the way the converter showed it (ticket 0965).

export interface CreateProjectInput {
  /** User-chosen name; blank or omitted defaults to the bead's label. New Project never sends it blank: it names an
   * unnamed Project "Project 1" first (useNewProjectFlow, ticket 0866). */
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

/** What New Project starts on (ticket 0866): the form's presets. The Homepage's first Project starts on the Starters'
 * own instead (FIRST_PROJECT_START, ticket 0945). */
export const NEW_PROJECT_DEFAULTS: Readonly<CreateProjectInput> = { technique: DEFAULT_TECHNIQUE, beadId: DEFAULT_BEAD.id }

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

  // One section to start (ADR 0103): the Bead's default colors with their codes; from then on the Palette is its own.
  const palette = defaultPaletteIds(defaultPalette(bead.id))
  const codes = codesOfColors(defaultPalette(bead.id))
  const layer = {
    ...created,
    beadId: bead.id,
    bead: beadCopy(bead),
    ...(input.background !== undefined ? { background: input.background } : {}),
    beads: {},
  }
  // Both layers take the form's settings (ADR 0079).
  const ids = { canvas: newLayerId(), frame: newLayerId() }
  const canvas = { id: ids.canvas, name, ...layer, orientation: startOrientation(created.technique) }
  return {
    id: crypto.randomUUID(),
    layers: [
      canvas,
      ...(dimensions ? [{ id: ids.frame, ...layer, row: 0, column: 0, columns: dimensions.columns, rows: dimensions.rows, angle: canvas.orientation, rowProgress: startingRowProgressOf(created) }] : []),
    ],
    palette,
    ...(Object.keys(codes).length > 0 ? { paletteCodes: codes } : {}),
    paletteLetters: lettersOfPalette(palette, undefined),
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

/** Creates a Project from a picture (ticket 58): a new Project with its cells painted and its Canvas upright, as the
 * preview showed it (ticket 0965). Conversion never edits an open Project (ADR 0010). The grid is fitted to the stated
 * dimensions (missing cells empty, surplus dropped), so they never disagree. */
export function createProjectFromImage(input: CreateProjectFromImageInput): Project {
  // The Canvas upright and the new Frame lying as it does (ticket 1188), its progress started as it lies then (spec 1182).
  const upright = withCanvas(createProject(input), { orientation: 0 })
  // A new Project's one Frame.
  const ref = firstFrameId(upright)
  const project = withStartingRowProgress(withFrameFields(upright, { angle: 0 }, ref), ref)
  const frame = frameById(project, ref)!
  const palette = input.palette
  const cells = Array.from({ length: frame.rows }, (_row, rowIndex) =>
    Array.from({ length: frame.columns }, (_cell, columnIndex) => input.grid[rowIndex]?.[columnIndex]?.color ?? null),
  )

  return {
    ...withLayer(project, ref, { beads: beadsFromColors(cells) }),
    ...(palette
      ? {
          palette: [...palette.ids],
          paletteLetters: lettersOfPalette(palette.ids, undefined),
          ...(Object.keys(palette.codes).length > 0 ? { paletteCodes: { ...palette.codes } } : {}),
        }
      : {}),
  }
}
