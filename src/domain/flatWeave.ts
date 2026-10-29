import type { Bead } from './beads'
import type { BeadMap, FrameSheet } from './canvas'
import type { Rotation } from './grid'
import type { PieceName } from './pieceNames'
import type { Project, RowProgress } from './project'
import { BRICK_BLOCK_SETTING, type BeadShape, type Technique, type TechniqueSettings } from './weave'

// The flat Brick block of earlier stored versions (file v4–v10, library v1–v4; ticket 0636): a layer's Brick block was a
// field beside its Technique. Read only: their readers lift it into the settings map the app holds, and v11 writes that.

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

/** A stored Project of an earlier version with each layer's flat Brick block moved into its settings map, where it wins
 * over the map as it did when both were read. An unreadable one is dropped, so the layer reads as the default. */
export function liftFlatWeave<T extends FlatWeave & { frame?: object }>(stored: T): T {
  const project = lifted(stored)
  return project.frame ? { ...project, frame: lifted(project.frame) } : project
}

function lifted<T extends FlatWeave>(layer: T): T {
  const { brickBlock, ...rest } = layer
  if (!isBrickBlock(brickBlock)) return rest as T
  const settings = isSettingsMap(layer.techniqueSettings) ? layer.techniqueSettings : {}
  return { ...rest, techniqueSettings: { ...settings, [BRICK_BLOCK_SETTING.id]: brickBlock } } as T
}

/** A stored Brick block if it is a whole number within its setting's range. */
function isBrickBlock(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= BRICK_BLOCK_SETTING.min && value <= BRICK_BLOCK_SETTING.max
}

/** Whether a stored settings map is one: an object of named values, not a list or anything else. */
export function isSettingsMap(value: unknown): value is TechniqueSettings {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
