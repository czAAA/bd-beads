/**
 * Where the Tour's status is kept on this device (ticket 77 reads it, ticket 80 builds the Tour on it). `untouched` is
 * a device that has never started it; `running` one that started it and hasn't finished or turned it off.
 */
export type TourStatus = 'untouched' | 'running' | 'finished' | 'off'

const STORAGE_KEY = 'bd-beads:tour'

export function loadTourStatus(): TourStatus {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === 'running' || raw === 'finished' || raw === 'off' ? raw : 'untouched'
  } catch {
    return 'untouched'
  }
}

export function saveTourStatus(status: TourStatus): void {
  try {
    localStorage.setItem(STORAGE_KEY, status)
  } catch {
    // A device that refuses the write just offers the Tour again next time.
  }
}
