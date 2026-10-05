export const PROGRESS_BAR_STORAGE_KEY = 'bd-beads:progress-bar'

/** Whether the Zoom pill's Row progress toggle shows the Progress bar, kept on this device like the Rulers (ticket 296: on by default). */
export interface ProgressBarStore {
  load: () => boolean
  save: (on: boolean) => void
}

export function createProgressBarStore(storage: Pick<Storage, 'getItem' | 'setItem'>): ProgressBarStore {
  return {
    load() {
      try {
        return storage.getItem(PROGRESS_BAR_STORAGE_KEY) !== 'off'
      } catch {
        // Storage can be blocked (private mode, site data off): the bar stays shown.
        return true
      }
    },
    save(on) {
      try {
        storage.setItem(PROGRESS_BAR_STORAGE_KEY, on ? 'on' : 'off')
      } catch {
        // Storage can be blocked; the choice still holds for this visit.
      }
    },
  }
}

/** The Progress bar choice in this browser's localStorage. */
export const browserProgressBarStore: ProgressBarStore = {
  load: () => createProgressBarStore(localStorage).load(),
  save: (on) => createProgressBarStore(localStorage).save(on),
}
