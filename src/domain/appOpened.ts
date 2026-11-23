// What the app tells the backend once a day it is opened (ticket 1209, ADR 0102): four fields, each one of a fixed
// set, and nothing that says who opened it. The app builds it here and the Worker checks a body against it here, so
// the two can't drift.

/** Days since this device's last ping, as a bucket: never a count, so a ping says no more than "came back soon". */
const SINCE_BUCKETS = ['1', '2-7', '8-30', '31+'] as const
type SinceBucket = (typeof SINCE_BUCKETS)[number]

/** One open, as sent: a first open has no `since`, every later one has. */
export interface OpenPing {
  first: boolean
  since?: SinceBucket
  installed: boolean
  /** The app's Version, `x.y.z`. */
  version: string
}

/** A Version as `x.y.z`, each part at most four digits, so a made-up one can't make a long row. */
const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/

/** The UTC day of `now`, `YYYY-MM-DD`: the day a ping is counted under, on the device and in the Worker. */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10)
}

const DAY_MS = 86_400_000

/** The bucket for the days between two UTC days; a day before the last one (the clock moved back) counts as one.
 * @internal Its test walks each bucket's edges. */
export function sinceBucket(lastDay: string, today: string): SinceBucket {
  const days = Math.round((Date.parse(today) - Date.parse(lastDay)) / DAY_MS)
  if (!(days > 1)) return '1'
  if (days <= 7) return '2-7'
  if (days <= 30) return '8-30'
  return '31+'
}

/** Whether a stored day is one this app wrote: anything else is treated as no day at all. */
export function isUtcDay(raw: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(Date.parse(raw))
}

/** Today's ping, or null when this device already sent one today. `lastDay` is the day it last sent one, if ever. */
export function openPing(lastDay: string | null, today: string, installed: boolean, version: string): OpenPing | null {
  if (lastDay === today) return null
  if (lastDay === null) return { first: true, installed, version }
  return { first: false, since: sinceBucket(lastDay, today), installed, version }
}

/** A body as the Worker takes it, or null for anything else: an unknown field, a value outside its set, `since`
 * given with `first` or missing without it. */
export function parseOpenPing(body: unknown): OpenPing | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null
  const { first, since, installed, version, ...rest } = body as Record<string, unknown>
  if (Object.keys(rest).length > 0) return null
  if (typeof first !== 'boolean' || typeof installed !== 'boolean') return null
  if (typeof version !== 'string' || !VERSION.test(version)) return null
  if (first) return since === undefined ? { first, installed, version } : null
  if (!SINCE_BUCKETS.includes(since as SinceBucket)) return null
  return { first, since: since as SinceBucket, installed, version }
}
