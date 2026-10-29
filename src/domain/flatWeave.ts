import type { Bead } from './beads'
import type { BeadMap, FrameSheet } from './canvas'
import type { Rotation } from './grid'
import type { PieceName } from './pieceNames'
import type { Project, RowProgress } from './project'
import { BRICK_DROP_SETTING, type BeadShape, type Technique, type TechniqueSettings } from './weave'

// The Brick block of earlier stored versions: brick stitch's Drop under its old name (ticket 0691), flat beside a
// layer's Technique (file v4–v10, library v1–v4; ticket 0636) or in its settings map (file v11–v12, library v4–v5).
// Read only: their readers lift it into the settings map the app holds as brick stitch's Drop, and v13 writes that.

/** The id brick stitch's Drop was stored under before ticket 0691. */
const BRICK_BLOCK_ID = 'brickBlock'

/** A layer's Technique settings as a stored record may hold them: the map, and an earlier version's flat Brick block. */
export interface FlatWeave {
  brickBlock?: number
  techniqueSettings?: TechniqueSettings
}

/** A Project as stores and files held it before it held its layers (file versions 3 to 11, library 1 to 4; ticket
 * 0664): the Canvas's Weave, Bead, Bead shape, beads, Letters, Piece names and name were the Project's own fields, its
 * rotation the view's turn, and the Frame a sheet beside them with the Project's Row progress. Read only. */
export interface FlatProject extends Omit<Project, 'layers'> {
  name: string
  technique: Technique
  techniqueSettings?: TechniqueSettings
  beadId: string
  bead?: Bead
  beadShape?: BeadShape
  beads: BeadMap
  frame?: FrameSheet
  rowProgress: RowProgress
  letters?: boolean
  pieceNames?: PieceName[]
  rotation: Rotation
}

/** A Project as a store or file has saved it since the Frame had its own beads and before its layers, before
 * normalizeProject reads it. */
export type SavedProject = Omit<FlatProject, 'frame'> & FlatWeave & { frame?: FrameSheet & FlatWeave }

/** A stored Project of an earlier version with each layer's Brick block in its settings map as brick stitch's Drop: a
 * flat one wins over the map's, as it did when both were read; an unreadable flat one is dropped, so the layer reads as
 * the default. */
export function liftFlatWeave<T extends FlatWeave & { frame?: object }>(stored: T): T {
  return withEachLayer(stored, lifted)
}

/** A stored Project of file version 11, whose layers' settings were maps already, with each map's Brick block renamed
 * brick stitch's Drop; a flat field beside the map is not read, as it never was. */
export function renamedBrickBlocks<T extends FlatWeave & { frame?: object }>(stored: T): T {
  return withEachLayer(stored, renamedBrickBlock)
}

/** A flat stored Project with `read` applied to the Canvas's own fields and to its Frame sheet, where it has one. */
function withEachLayer<T extends FlatWeave & { frame?: object }>(stored: T, read: <L extends FlatWeave>(layer: L) => L): T {
  const project = read(stored)
  return project.frame ? { ...project, frame: read(project.frame) } : project
}

function lifted<T extends FlatWeave>(layer: T): T {
  const { brickBlock, ...rest } = renamedBrickBlock(layer)
  if (!isBrickBlock(brickBlock)) return rest as T
  const settings = isSettingsMap(rest.techniqueSettings) ? rest.techniqueSettings : {}
  const techniqueSettings: TechniqueSettings = { ...settings, [BRICK_DROP_SETTING.id]: brickBlock }
  return { ...rest, techniqueSettings } as T
}

/** A layer whose settings map holds a Brick block (file v11–v12, library v4–v5) with it renamed brick stitch's Drop;
 * one without is returned as it is. */
export function renamedBrickBlock<T extends Pick<FlatWeave, 'techniqueSettings'>>(layer: T): T {
  const settings = layer.techniqueSettings
  if (!isSettingsMap(settings) || !(BRICK_BLOCK_ID in settings)) return layer
  const { [BRICK_BLOCK_ID]: brickBlock, ...rest } = settings
  return { ...layer, techniqueSettings: { ...rest, [BRICK_DROP_SETTING.id]: brickBlock } }
}

/** A stored Brick block if it is a whole number within its setting's range. */
function isBrickBlock(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= BRICK_DROP_SETTING.min && value <= BRICK_DROP_SETTING.max
}

/** Whether a stored settings map is one: an object of named values, not a list or anything else. */
export function isSettingsMap(value: unknown): value is TechniqueSettings {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
