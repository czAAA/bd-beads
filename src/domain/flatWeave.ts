import type { FrameSheet } from './canvas'
import type { Project } from './project'
import { BRICK_BLOCK_SETTING, type TechniqueSettings } from './weave'

// The flat Brick block of earlier stored versions (file v4–v10, library v1–v4; ticket 0636): a layer's Brick block was a
// field beside its Technique. Read only: their readers lift it into the settings map the app holds, and v11 writes that.

/** A layer's Technique settings as a stored record may hold them: the map, and an earlier version's flat Brick block. */
export interface FlatWeave {
  brickBlock?: number
  techniqueSettings?: TechniqueSettings
}

/** A Project as a store or file has saved it since the Frame had its own beads, before normalizeProject reads it. */
export type SavedProject = Omit<Project, 'frame'> & FlatWeave & { frame?: FrameSheet & FlatWeave }

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

/** A stored record without its Weave's settings, mapped or flat (a stray flat Brick block in a v11 file is dropped):
 * what a reader builds a layer over. */
export function unflattened<T extends FlatWeave>(record: T): Omit<T, keyof FlatWeave> {
  const { brickBlock: _brickBlock, techniqueSettings: _settings, ...rest } = record
  return rest
}
