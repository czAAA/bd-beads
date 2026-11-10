// The browser's persistent storage (ticket 399): whether it's granted, and asking for it. Unknown answers where
// unsupported; never throws.
export interface PersistentStorage {
  /** Whether the browser already keeps the library; undefined where it can't say. */
  persisted(): Promise<boolean | undefined>
  /** Asks the browser to keep the library; it may show its own prompt or decide silently. Its answer (ticket 0839):
   * false when it declined or failed to answer, undefined where it can't be asked. */
  persist(): Promise<boolean | undefined>
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
    const persist = navigator.storage?.persist
    if (!persist) return undefined
    try {
      return await persist.call(navigator.storage)
    } catch {
      // The library is saved either way; the browser just won't promise to keep it.
      return false
    }
  },
}
