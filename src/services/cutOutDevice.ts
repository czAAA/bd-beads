import type { CutOutDevice, CutOutRecord } from '../domain/cutOutModel'

// The device record of Cut out with AI (ticket 0768, ADR 0087), kept in localStorage, not sessionStorage: the point is
// to outlive a tab Safari closed.

const RECORD_KEY = 'openbeads:cut-out-record'

const EMPTY: CutOutRecord = { running: false, stopped: false }

/** The record as kept: anything unreadable reads as nothing known yet. */
function parsed(raw: string | null): CutOutRecord {
  if (raw === null) return EMPTY
  try {
    const kept = JSON.parse(raw) as Partial<CutOutRecord> | null
    const firstRunMs = typeof kept?.firstRunMs === 'number' && kept.firstRunMs >= 0 ? kept.firstRunMs : undefined
    return { running: kept?.running === true, stopped: kept?.stopped === true, ...(firstRunMs === undefined ? {} : { firstRunMs }) }
  } catch {
    return EMPTY
  }
}

function read(): CutOutRecord {
  try {
    return parsed(localStorage.getItem(RECORD_KEY))
  } catch {
    return EMPTY
  }
}

function write(record: CutOutRecord) {
  try {
    localStorage.setItem(RECORD_KEY, JSON.stringify(record))
  } catch {
    // No room or no storage: nothing is kept, nothing else changes.
  }
}

/** A page the maker closes or leaves fires `pagehide`, so its run isn't taken for one the browser stopped; a tab Safari
 * closes for lack of memory fires nothing, and a page kept to come back to (`persisted`) may still be closed later. */
function left(event: PageTransitionEvent) {
  if (event.persisted) return
  const record = read()
  if (record.running) write({ ...record, running: false })
}
let watching = false

/** The device record and checks on this browser. Blocked storage reads as nothing known and keeps nothing: the AI choice
 * still works, it just can't be warned. */
export const browserCutOutDevice: CutOutDevice = {
  read,
  write(record) {
    write(record)
    if (record.running && !watching) {
      watching = true
      window.addEventListener('pagehide', left)
    }
  },
  memoryGb() {
    // Chrome's Device Memory API, rounded and capped by the browser; Safari and Firefox don't have it.
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
    return typeof memory === 'number' && memory > 0 ? memory : undefined
  },
  async freeBytes() {
    try {
      const estimate = await navigator.storage?.estimate?.()
      if (typeof estimate?.quota !== 'number') return undefined
      return Math.max(0, estimate.quota - (estimate.usage ?? 0))
    } catch {
      return undefined
    }
  },
}
