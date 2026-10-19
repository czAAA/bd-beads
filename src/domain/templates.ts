import { DEFAULT_NET_SIZE, DEFAULT_TECHNIQUE, describeWeave, FLAT_TECHNIQUES, NARROW_TEMPLATE_TECHNIQUES, TECHNIQUES, type Technique } from './weave'
import type { CreateProjectInput } from './project'

/** The Templates New Project offers (ticket 493, spec 0488). The id is also the key of its copy (`templates.<id>` in
 * the translations). */
export type TemplateId = 'gerdan' | 'bracelet' | 'earrings' | 'bag' | 'custom'

/** One side of a Template's Frame, in beads (Units where the Technique counts them). */
export interface TemplateAxis {
  default: number
  min: number
  max: number
  /** The usual sizes, offered as chips; each lies inside min..max. */
  presets?: readonly number[]
  /** The side keeps its default: a product that isn't one at another size (earrings keep their width). */
  lock?: boolean
}

/** A named starting point for a Frame (ADR 0066): a product with the Technique it is usually woven in, the ones it can
 * be, and its sizes. Nothing in a Project records the Template it was made from. */
export interface Template {
  id: TemplateId
  /** The Technique chosen first. */
  technique: Technique
  /** Every Technique it can be woven in, the default among them. */
  techniques: readonly Technique[]
  width: TemplateAxis
  height: TemplateAxis
}

/** The registry, in the order the gallery shows it. The sizes are starting values, to be tuned against real pieces. */
export const TEMPLATES: readonly Template[] = [
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
    technique: NARROW_TEMPLATE_TECHNIQUES[0],
    techniques: NARROW_TEMPLATE_TECHNIQUES,
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

/** The Template with this id. */
export function templateById(id: TemplateId): Template {
  return TEMPLATES.find((template) => template.id === id)!
}

/** A side's value held to its limits: a locked side is its default, whatever was asked. */
export function clampAxis(axis: TemplateAxis, value: number): number {
  if (axis.lock) {
    return axis.default
  }
  return Math.min(axis.max, Math.max(axis.min, Math.round(value) || axis.default))
}

/** What the setup sub-view asks for: the choices on top of the Template. */
export interface TemplateChoices {
  /** Defaults to the Template's own; one it doesn't allow falls back to it. */
  technique?: Technique
  brickBlock?: number
  beadId: string
  /** Typed in the Name field; blank takes the Template's name, which only the UI can say. */
  name: string
  columns: number
  rows: number
}

/** The input that makes the Project: Frame in place at the origin and empty, in the chosen Technique, and so the
 * Canvas too (createProject). */
export function templateProjectInput(template: Template, choices: TemplateChoices): CreateProjectInput {
  const technique = choices.technique && template.techniques.includes(choices.technique) ? choices.technique : template.technique
  return {
    name: choices.name,
    technique,
    ...(describeWeave({ technique }).hasBrickBlock && choices.brickBlock && choices.brickBlock > 1 ? { brickBlock: choices.brickBlock } : {}),
    ...(describeWeave({ technique }).hasNetSize ? { netSize: DEFAULT_NET_SIZE } : {}),
    beadId: choices.beadId,
    size: { width: clampAxis(template.width, choices.columns), height: clampAxis(template.height, choices.rows), unit: 'beads' },
  }
}
