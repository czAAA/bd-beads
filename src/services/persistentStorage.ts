/**
 * The browser's persistent storage (ticket 399): whether it has already agreed to keep this device's library when space
 * runs short, and asking it to. Every answer is "unknown" where the browser has no such API or refuses, so nothing
 * here ever throws and saving never depends on it.
 */
export interface PersistentStorage {
  /** Whether the browser already keeps the library; undefined where it can't say. */
  persisted(): Promise<boolean | undefined>
  /** Asks the browser to keep the library; it may show its own prompt, decide silently or not answer. */
  persist(): Promise<void>
}

export const browserPersistentStorage: PersistentStorage = {
  async persisted() {
    try {
      return await navigator.storage?.persisted?.()
    } catch {
      return undefined
    }
  },
  async persist() {
    try {
      await navigator.storage?.persist?.()
    } catch {
      // The library is saved either way; the browser just won't promise to keep it.
    }
  },
}
