/** Which tab has a Project open first (ticket 0834): the browser's Web Locks, held by a tab while it has the Project
 * open and let go when it opens another one or closes. A tab that finds the lock taken waits in line for it. */
export interface ProjectLocks {
  /** Asks for `id` for this tab. `onHeld` hears whether this tab has it, false while another tab does, and true once
   * that one lets it go. Gives back the way to let it go, or stop waiting; `onHeld` hears nothing after. */
  claim: (id: string, onHeld: (held: boolean) => void) => () => void
}

/** Locks for a page that is the only one with its Projects (the Homepage's demo) or a browser without Web Locks: every
 * Project is this tab's, as before ticket 0834. */
export const soleProjectLocks: ProjectLocks = {
  claim: (_id, onHeld) => {
    onHeld(true)
    return () => undefined
  },
}

/** The Web Locks of `locks`, one lock per Project, named after its id. @internal Its browser test hands it the page's. */
export function webProjectLocks(locks: LockManager): ProjectLocks {
  /** Each lock this tab is letting go of, until the browser has it back: a claim of it again waits, not to find it
   * taken by this very tab. */
  const lettingGo = new Map<string, Promise<unknown>>()
  return {
    claim(id, onHeld) {
      const name = `openbeads:project:${id}`
      const waiting = new AbortController()
      let released = false
      let letGo: () => void = () => undefined
      // The lock is held for as long as the promise its callback returns is pending.
      const hold = () => {
        onHeld(true)
        return new Promise<void>((resolve) => {
          letGo = resolve
        })
      }
      const ask = () =>
        locks.request(name, { ifAvailable: true }, (lock) => {
          if (released) return
          if (lock) return hold()
          onHeld(false)
          // Returned, so this request settles only once the wait and any hold after it are over.
          return locks.request(name, { signal: waiting.signal }, () => (released ? undefined : hold())).catch(() => undefined)
        })
      const asked = (lettingGo.get(name) ?? Promise.resolve()).then(ask).catch(() => undefined)
      return () => {
        released = true
        waiting.abort()
        letGo()
        lettingGo.set(name, asked)
        void asked.then(() => lettingGo.get(name) === asked && lettingGo.delete(name))
      }
    },
  }
}

/** This browser's locks, or none to wait for where it has no Web Locks. */
export const browserProjectLocks: ProjectLocks = typeof navigator !== 'undefined' && navigator.locks ? webProjectLocks(navigator.locks) : soleProjectLocks
