import type { FrameSheet } from './canvas'
import type { Project } from './project'
import { BRICK_BLOCK_SETTING, NET_SIZE_SETTING, type TechniqueSettings, type Weave } from './weave'

// The file boundary's Weave (ticket 0627, until ticket 0636): a file stores a layer's Brick block and Net size as flat
// fields beside its Technique, where the app holds one settings map. Only the Project readers and encoder know them.

/** A layer's Technique settings as a file stores them: the Brick block and Net size flat, any other setting in a map. */
export interface FlatWeave {
  brickBlock?: number
  netSize?: number
  techniqueSettings?: TechniqueSettings
}

/** A Project as a store or file saves it today: the Canvas's settings and the Frame's flat. */
export type SavedProject = Omit<Project, 'frame'> & FlatWeave & { frame?: FrameSheet & FlatWeave }

/** A stored layer's settings map: any map it holds, with its flat fields read into it. An unreadable Brick block is
 * none (the default) and a valid one is kept even off brick stitch; a Net size is any number, read within its range by
 * the Weave. */
export function storedSettings({ brickBlock, netSize, techniqueSettings }: FlatWeave): Record<string, number> {
  return {
    ...techniqueSettings,
    ...(isBrickBlock(brickBlock) ? { [BRICK_BLOCK_SETTING.id]: brickBlock } : {}),
    ...(typeof netSize === 'number' ? { [NET_SIZE_SETTING.id]: netSize } : {}),
  }
}

/** A stored Brick block if it is a whole number within its setting's range. */
function isBrickBlock(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= BRICK_BLOCK_SETTING.min && value <= BRICK_BLOCK_SETTING.max
}

/** A stored record without its Weave's settings, flat or mapped: what a reader builds a layer over. */
export function unflattened<T extends FlatWeave>(record: T): Omit<T, keyof FlatWeave> {
  const { brickBlock: _brickBlock, netSize: _netSize, techniqueSettings: _settings, ...rest } = record
  return rest
}

/** A layer as the file stores it: its Brick block (one of 1, every other row, was never written) and Net size flat, and
 * any other setting in its map, so a Technique's new setting is saved with no change here (ADR 0078). */
export function flattened<T extends Weave>(layer: T): Omit<T, 'techniqueSettings'> & FlatWeave {
  const { techniqueSettings, ...rest } = layer
  const { [BRICK_BLOCK_SETTING.id]: brickBlock, [NET_SIZE_SETTING.id]: netSize, ...others } = techniqueSettings ?? {}
  return {
    ...rest,
    ...(brickBlock !== undefined && brickBlock !== BRICK_BLOCK_SETTING.default ? { brickBlock } : {}),
    ...(netSize !== undefined ? { netSize } : {}),
    ...(Object.keys(others).length > 0 ? { techniqueSettings: others } : {}),
  }
}
