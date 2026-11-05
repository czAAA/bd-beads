import type { SinceFile } from '../domain/beadsSinceFile'

// Each Project's Beads since last file and last-file time (ticket 0796), kept in localStorage beside the library under a
// key of their own, so a reload keeps them and older builds never read them. Blocked storage reads as none and writes
// nothing.

const SINCE_FILE_KEY = 'openbeads:since-file'

/** The records by Project id. */
export type SinceFiles = Readonly<Record<string, SinceFile>>

/** Where the records are kept; a test fakes it. */
export interface SinceFileStore {
  read: () => SinceFiles
  write: (records: SinceFiles) => void
}

/** A stored record as far as it reads as one; a count that isn't a number is no record. */
function recordOf(value: unknown): SinceFile | undefined {
  const { beads, lastFileAt } = (value ?? {}) as Partial<SinceFile>
  if (typeof beads !== 'number' || !Number.isFinite(beads)) return undefined
  return { beads: Math.max(0, beads), ...(typeof lastFileAt === 'number' ? { lastFileAt } : {}) }
}

export const browserSinceFileStore: SinceFileStore = {
  read() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SINCE_FILE_KEY) ?? '{}') as Record<string, unknown>
      return Object.fromEntries(Object.entries(parsed ?? {}).flatMap(([id, value]) => {
        const record = recordOf(value)
        return record ? [[id, record]] : []
      }))
    } catch {
      return {}
    }
  },
  write(records) {
    try {
      localStorage.setItem(SINCE_FILE_KEY, JSON.stringify(records))
    } catch {
      // No room or no storage: the count lives on for this visit only.
    }
  },
}
