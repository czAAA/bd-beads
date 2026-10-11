import { normalizeMakerName } from '../domain/makerName'

/**
 * The maker's name (CONTEXT.md, ticket 161): who made a Project, printed on its PDF and PNG exports. It belongs to the
 * person using this device, not to a Project, so it is kept on the device like the theme and never sent anywhere
 * (ADR 0001). Empty means the exports leave it out.
 */
export const MAKER_NAME_KEY = 'bd-beads:maker-name'

/** Where the maker's name is kept (ADR 0020). */
export interface MakerNameStore {
  load: () => string
  /** Keeps the name, or forgets it when empty; hands back the name as kept. */
  save: (name: string) => string
}

export function createMakerNameStore(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>): MakerNameStore {
  return {
    load() {
      try {
        return normalizeMakerName(storage.getItem(MAKER_NAME_KEY) ?? '')
      } catch {
        // Storage can be blocked (private mode, site data off): the exports just carry no name.
        return ''
      }
    },
    save(name) {
      const kept = normalizeMakerName(name)
      try {
        if (kept) storage.setItem(MAKER_NAME_KEY, kept)
        else storage.removeItem(MAKER_NAME_KEY)
      } catch {
        // Blocked storage: the name still holds for this visit.
      }
      return kept
    },
  }
}

/** The maker's name in this browser's localStorage. */
export const browserMakerNameStore: MakerNameStore = {
  load: () => createMakerNameStore(localStorage).load(),
  save: (name) => createMakerNameStore(localStorage).save(name),
}
