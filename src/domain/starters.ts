import { DEFAULT_NET_SIZE, DEFAULT_TECHNIQUE, describeWeave, FLAT_TECHNIQUES, NARROW_STARTER_TECHNIQUES, TECHNIQUES, type Technique } from './weave'
import type { CreateProjectInput } from './project'

/** The Starters New Project offers (ticket 493, spec 0488). The id is also the key of its copy (`starters.<id>` in
 * the translations). */
export type StarterId = 'gerdan' | 'bracelet' | 'earrings' | 'bag' | 'custom'

/** One side of a Starter's Frame, in beads (Units where the Technique counts them). */
export interface StarterAxis {
  default: number
  min: number
  max: number
  /** The usual sizes, offered as chips; each lies inside min..max. */
  presets?: readonly number[]
  /** The side keeps its default: a product that isn't one at another size (earrings keep their width). */
  lock?: boolean
}

/** A named starting point for a Frame (ADR 0066): a product with the Technique it is usually woven in, the ones it can
 * be, and its sizes. Nothing in a Project records the Starter it was made from. */
export interface Starter {
  id: StarterId
  /** The Technique chosen first. */
  technique: Technique
  /** Every Technique it can be woven in, the default among them. */
  techniques: readonly Technique[]
  width: StarterAxis
  height: StarterAxis
}

/** The registry, in the order the gallery shows it. The sizes are starting values, to be tuned against real pieces. */
export const STARTERS: readonly Starter[] = [
  {
    id: 'gerdan',
    technique: DEFAULT_TECHNIQUE,
    techniques: FLAT_TECHNIQUES,
    width: { default: 24, min: 8, max: 60, presets: [16, 24, 32] },
    height: { default: 80, min: 20, max: 200, presets: [60, 80, 100] },
  },
  {
    id: 'bracelet',
    technique: DEFAULT_TECHNIQUE,
    techniques: FLAT_TECHNIQUES,
    width: { default: 12, min: 4, max: 40, presets: [8, 12, 16] },
    height: { default: 90, min: 40, max: 200, presets: [70, 80, 90, 100, 110] },
  },
  {
    id: 'earrings',
    technique: NARROW_STARTER_TECHNIQUES[0],
    techniques: NARROW_STARTER_TECHNIQUES,
    width: { default: 10, min: 10, max: 10, lock: true },
    height: { default: 48, min: 12, max: 120, presets: [32, 48, 64] },
  },
  {
    id: 'bag',
    technique: DEFAULT_TECHNIQUE,
    techniques: FLAT_TECHNIQUES,
    width: { default: 20, min: 8, max: 80, presets: [20, 30, 40] },
    height: { default: 40, min: 12, max: 120, presets: [30, 40, 60] },
  },
  {
    id: 'custom',
    technique: DEFAULT_TECHNIQUE,
    techniques: TECHNIQUES,
    width: { default: 24, min: 1, max: 200 },
    height: { default: 80, min: 1, max: 200 },
  },
]

/** The Starter with this id. */
export function starterById(id: StarterId): Starter {
  return STARTERS.find((starter) => starter.id === id)!
}

/** A side's value held to its limits: a locked side is its default, whatever was asked. */
export function clampAxis(axis: StarterAxis, value: number): number {
  if (axis.lock) {
    return axis.default
  }
  return Math.min(axis.max, Math.max(axis.min, Math.round(value) || axis.default))
}

/** What the setup subpanel asks for: the choices on top of the Starter. */
export interface StarterChoices {
  /** Defaults to the Starter's own; one it doesn't allow falls back to it. */
  technique?: Technique
  brickBlock?: number
  beadId: string
  /** Typed in the Name field; blank takes the Starter's name, which only the UI can say. */
  name: string
  columns: number
  rows: number
}

/** The input that makes the Project: Frame in place at the origin and empty, in the chosen Technique, and so the
 * Canvas too (createProject). */
export function starterProjectInput(starter: Starter, choices: StarterChoices): CreateProjectInput {
  const technique = choices.technique && starter.techniques.includes(choices.technique) ? choices.technique : starter.technique
  return {
    name: choices.name,
    technique,
    ...(describeWeave({ technique }).hasBrickBlock && choices.brickBlock && choices.brickBlock > 1 ? { brickBlock: choices.brickBlock } : {}),
    ...(describeWeave({ technique }).hasNetSize ? { netSize: DEFAULT_NET_SIZE } : {}),
    beadId: choices.beadId,
    size: { width: clampAxis(starter.width, choices.columns), height: clampAxis(starter.height, choices.rows), unit: 'beads' },
  }
}
