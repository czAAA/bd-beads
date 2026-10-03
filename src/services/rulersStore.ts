export const RULERS_STORAGE_KEY = 'bd-beads:rulers'

/** Whether the Rulers toggle is on, kept on this device like the theme (Rulers card: on by default). */
export interface RulersStore {
  load: () => boolean
  save: (on: boolean) => void
}

export function createRulersStore(storage: Pick<Storage, 'getItem' | 'setItem'>): RulersStore {
  return {
    load() {
      try {
        return storage.getItem(RULERS_STORAGE_KEY) !== 'off'
      } catch {
        // Storage can be blocked (private mode, site data off): rulers stay on.
        return true
      }
    },
    save(on) {
      try {
        storage.setItem(RULERS_STORAGE_KEY, on ? 'on' : 'off')
      } catch {
        // Storage can be blocked; the choice still holds for this visit.
      }
    },
  }
}

/** The Rulers choice in this browser's localStorage. */
export const browserRulersStore: RulersStore = {
  load: () => createRulersStore(localStorage).load(),
  save: (on) => createRulersStore(localStorage).save(on),
}
