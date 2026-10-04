import { TOUR_STEPS, type TourStepId } from '../domain/tour'

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

const PROGRESS_KEY = 'bd-beads:tour-progress'

/** Which steps of the Tour are done on this device, and which Project the Tour is building (ticket 80). */
export interface TourProgress {
  done: TourStepId[]
  projectId?: string
}

export function loadTourProgress(): TourProgress {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? 'null')
    if (typeof parsed !== 'object' || parsed === null) {
      return { done: [] }
    }
    const { done, projectId } = parsed as { done?: unknown; projectId?: unknown }
    const steps = Array.isArray(done) ? done.filter((step): step is TourStepId => TOUR_STEPS.includes(step as TourStepId)) : []
    return typeof projectId === 'string' ? { done: steps, projectId } : { done: steps }
  } catch {
    return { done: [] }
  }
}

export function saveTourProgress(progress: TourProgress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
  } catch {
    // A device that refuses the write just starts the Tour over next time.
  }
}

/** The Tour's saved state as one bundle, for the app shell to wire in (ADR 0020). */
export interface TourStore {
  loadStatus: () => TourStatus
  saveStatus: (status: TourStatus) => void
  loadProgress: () => TourProgress
  saveProgress: (progress: TourProgress) => void
}

export const browserTourStore: TourStore = {
  loadStatus: loadTourStatus,
  saveStatus: saveTourStatus,
  loadProgress: loadTourProgress,
  saveProgress: saveTourProgress,
}
