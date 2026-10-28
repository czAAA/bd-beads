import { beadCopy, beadLabel, findBead, type Bead } from './beads'
import { beadsFromColors } from './canvas'
import type { GridDimensions } from './grid'
import { clampBrickBlock, frameWeave, weaveOf } from './layerWeave'
import { normalizeMakerName } from './makerName'
import { defaultPalette, defaultPaletteIds } from './palette'
import { lettersOfPalette } from './paletteEdits'
import type { Grid, Project } from './project'
import { gridFromSize, type StatedSize } from './projectSize'
import { INITIAL_ROW_PROGRESS } from './rowProgress'
import { clampNetSize, DEFAULT_BEAD_SHAPE, describeWeave, type BeadShape, type Technique } from './weave'

// Creating a Project (CONTEXT.md's New Project and Convert image): from a stated size, or from a picture.

export interface CreateProjectInput {
  /** User-chosen name; blank or omitted defaults to the bead's label. */
  name?: string
  technique: Technique
  /** The Brick block of a new brick stitch Project (ticket 477); left out or 1 shifts every other row. */
  brickBlock?: number
  /** The Net size of a new Netting Project (ticket 485); left out is the default. */
  netSize?: number
  /** The Bead shape of a new Project; left out is Symmetric. */
  beadShape?: BeadShape
  beadId: string
  /** How big the Frame is, in beads or mm/cm (converted once to a grid, not remembered; ADR 0026). Left out: a Canvas
   * with no Frame. */
  size?: StatedSize
  /** This Project's own maker's name (ticket 182); blank or omitted keeps the device-wide one instead. */
  makerName?: string
}

/** What a new Project's stated size and Bead work out to: the Bead, and the grid that implies. */
export interface ProjectGeometry extends GridDimensions {
  bead: Bead
}

/** The grid a New Project form state implies, or undefined when the Bead isn't in the catalog. Shared with Convert
 * image (ticket 58) so its frame is exactly the grid the Project will be created at. */
export function projectGeometry(input: CreateProjectInput & { size: StatedSize }): ProjectGeometry | undefined {
  // findBead looks the id up in the fixed built-in catalog (ADR 0007 / ticket 38).
  const bead = findBead(input.beadId)
  if (!bead) {
    return undefined
  }

  return { bead, ...gridFromSize(input.size, bead, { technique: input.technique, brickBlock: input.brickBlock, netSize: input.netSize }) }
}

export function createProject(input: CreateProjectInput): Project {
  const bead = findBead(input.beadId)
  if (!bead) {
    throw new Error(`Unknown bead id: ${input.beadId}`)
  }

  const dimensions = input.size ? gridFromSize(input.size, bead, { technique: input.technique, brickBlock: input.brickBlock, netSize: input.netSize }) : undefined
  const now = Date.now()
  const name = input.name?.trim() || beadLabel(bead)
  const makerName = normalizeMakerName(input.makerName ?? '')

  const created = weaveOf({
    technique: input.technique,
    ...(input.brickBlock && input.brickBlock > 1 ? { brickBlock: clampBrickBlock(input.brickBlock) } : {}),
    ...(describeWeave({ technique: input.technique }).hasNetSize ? { netSize: clampNetSize(input.netSize) } : {}),
  })

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
}

/** Creates a Project from a picture (ticket 58): an ordinary new Project with its cells painted. Conversion only
 * creates, never edits an open Project (ADR 0010). The grid is fitted to the stated dimensions (missing cells empty,
 * surplus dropped), so they never disagree. */
export function createProjectFromImage(input: CreateProjectFromImageInput): Project {
  const project = createProject(input)
  const frame = project.frame!
  const weave = describeWeave(frameWeave(project))

  return {
    ...project,
    frame: {
      ...frame,
      beads: beadsFromColors(
        Array.from({ length: frame.rows }, (_row, rowIndex) =>
          Array.from({ length: frame.columns }, (_cell, columnIndex) =>
            weave.hasPosition({ row: rowIndex, column: columnIndex }, { ...frame, row: 0, column: 0 }) ? input.grid[rowIndex]?.[columnIndex]?.color ?? null : null,
          ),
        ),
      ),
    },
  }
}
