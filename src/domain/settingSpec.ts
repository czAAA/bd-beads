import { clamp } from './clamp'

// The one shape of a setting a kind describes (ADR 0078, ticket 0624): a Technique's (Brick block, Net size) and a Frame
// kind's (Rounds, Part size, ...) alike, so one generic control edits any of them and a new one is an entry, not wiring.

/** One numbered setting of a Technique or a Frame kind: values only, never an expression (ADR 0078). */
export interface SettingSpec<Id extends string = string> {
  id: Id
  /** Its words' key: in the `weaveSettings` translations for a Technique's, in `frame.sizeSettings` for a Frame kind's. */
  labelKey: string
  min: number
  max: number
  /** How far one press moves it; the values it takes are its minimum and every step up from it. */
  step: number
  default: number
  /** The sizes offered at one press, where it offers any. */
  presets?: readonly number[]
  /** Whether a change of it can drop painted beads, so the weaver is asked first (Net size, a smaller Custom frame). */
  lossOnChange?: boolean
  /** Another setting of the same kind it stays below (a Fringe earring's Top rows, under its Top width). */
  below?: Id
  /** Whether a layer switched to a Technique that does not describe it keeps its value, for a switch back (the Brick
   * block, ticket 477); otherwise it is dropped (the Net size, ticket 568). */
  keptOffTechnique?: boolean
}

/** The setting's value as it is kept: a whole number within its range on one of its steps, a value between two steps
 * the one below it (an even Net size the odd one under it); its default where there is none or it is no number. */
export function settingValue(setting: SettingSpec, value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return setting.default
  }
  const within = clamp(Math.round(value), setting.min, setting.max)
  return setting.min + Math.floor((within - setting.min) / setting.step) * setting.step
}
