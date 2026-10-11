import type { FeatureName } from '../features'
import type { Measure } from '../usageCounters'

/** One measure's warn level and, where there is one, its stop level and what the watchdog switches off there. */
export interface MeasureLevels {
  measure: Measure
  /** Telegram message at or above this value. */
  warn: number
  /** At or above this value the watchdog switches off the first of `stops` that is still on, once per run. */
  stop?: number
  /** Most exposed first (spec 385: new View links, then new sign-ups, so signed-in people keep syncing). */
  stops: FeatureName[]
  unit: 'count' | 'bytes'
}

const MB = 1024 * 1024
const GB = 1024 * MB

/**
 * The levels on Workers Free, per account and UTC day (spec 385). R2 storage has no stop: a paying customer's data
 * is never refused; passing the warn level is the signal to price Pro or move to Paid.
 */
export const FREE_LEVELS: MeasureLevels[] = [
  { measure: 'requests', warn: 55_000, stop: 80_000, stops: ['view-links', 'sign-up'], unit: 'count' },
  { measure: 'd1-rows-written', warn: 55_000, stop: 80_000, stops: ['view-links', 'sign-up'], unit: 'count' },
  { measure: 'd1-storage', warn: 350 * MB, stop: 450 * MB, stops: ['view-links'], unit: 'bytes' },
  { measure: 'magic-link-emails', warn: 60, stop: 90, stops: ['magic-link'], unit: 'count' },
  { measure: 'r2-storage', warn: 5 * GB, stops: [], unit: 'bytes' },
]

/**
 * The same levels, with those of `measures` (all, when none are named) multiplied by `factor`: halved for the
 * counters the D1 reader keeps, lowered on dev to try the alerts.
 */
export function scaleLevels(levels: MeasureLevels[], factor: number, measures?: Measure[]): MeasureLevels[] {
  return levels.map((level) => {
    if (measures && !measures.includes(level.measure)) return level
    return { ...level, warn: level.warn * factor, stop: level.stop === undefined ? undefined : level.stop * factor }
  })
}

export type LevelState = 'ok' | 'warn' | 'stop'

/** Where a value stands against a measure's levels. */
export function stateOf(level: MeasureLevels, value: number): LevelState {
  if (level.stop !== undefined && value >= level.stop) return 'stop'
  return value >= level.warn ? 'warn' : 'ok'
}

/** A number for a message: `55,000`, or `350 MB` for bytes. */
export function formatValue(value: number, unit: MeasureLevels['unit']): string {
  if (unit === 'count') return Math.round(value).toLocaleString('en-US')
  if (value >= GB) return `${(value / GB).toFixed(1)} GB`
  return `${(value / MB).toFixed(value >= 10 * MB ? 0 : 1)} MB`
}
