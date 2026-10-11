import { MB, numberVar, type Env, type NumberVar } from '../env'

/** What the watchdog measures (spec 385, "Warn levels on Free"). Counts are per UTC day; sizes are bytes. */
type Measure = 'api-requests' | 'd1-rows-written' | 'worker-errors' | 'r2-storage' | 'core-db' | 'blobs-db'

/** Today's readings; a measure that couldn't be read is left out. */
export type Usage = Partial<Record<Measure, number>>

interface MeasureSpec {
  /** The variable holding its warn level. */
  level: NumberVar
  unit: 'count' | 'MB'
  /** What it counts, as an alert names it; production counts some measures account-wide, dev its own only. */
  label(worker: Env['WORKER_NAME']): string
}

const scope = (worker: Env['WORKER_NAME']): string => (worker === 'production' ? 'whole account' : 'dev Worker only')

const MEASURES: Record<Measure, MeasureSpec> = {
  'api-requests': { level: 'WARN_API_REQUESTS', unit: 'count', label: (w) => `API requests today (${scope(w)})` },
  'd1-rows-written': { level: 'WARN_D1_ROWS_WRITTEN', unit: 'count', label: (w) => `D1 rows written today (${scope(w)})` },
  'worker-errors': { level: 'WARN_WORKER_ERRORS', unit: 'count', label: () => 'Worker errors today (this Worker)' },
  'r2-storage': { level: 'WARN_R2_STORAGE_MB', unit: 'MB', label: (w) => `R2 storage (${scope(w)})` },
  'core-db': { level: 'WARN_CORE_DB_MB', unit: 'MB', label: () => 'core database size' },
  'blobs-db': { level: 'WARN_BLOBS_DB_MB', unit: 'MB', label: () => 'blobs database size' },
}

function format(value: number, unit: MeasureSpec['unit']): string {
  return unit === 'MB' ? `${(value / MB).toFixed(1)} MB` : value.toLocaleString('en-US')
}

/** One measure checked against its warn level, as a line of the report. */
interface Reading {
  measure: Measure
  over: boolean
  line: string
}

/**
 * Each measure against this Worker's warn level, from its variables: over when the value is past the level. A level
 * that isn't a number counts as over, so a mistyped variable is reported instead of silently never warning.
 */
export function checkLevels(env: Env, usage: Usage): Reading[] {
  return (Object.keys(MEASURES) as Measure[]).map((measure) => {
    const spec = MEASURES[measure]
    const label = spec.label(env.WORKER_NAME)
    const raw = numberVar(env, spec.level)
    if (Number.isNaN(raw)) return { measure, over: true, line: `${label}: its level ${spec.level} is not a number` }
    const level = spec.unit === 'MB' ? raw * MB : raw
    const value = usage[measure]
    if (value === undefined) return { measure, over: false, line: `${label}: not read (warn level ${format(level, spec.unit)})` }
    const over = value > level
    return { measure, over, line: `${label}: ${format(value, spec.unit)} (warn level ${format(level, spec.unit)})` }
  })
}
