/** Which tab has a Project open first (ticket 0834): the browser's Web Locks, held by a tab while it has the Project
 * open and let go when it opens another one or closes. A tab that finds the lock taken waits in line for it, or takes
 * it over (ticket 0937), and the tab it was taken from then waits in line for it back. */
export interface ProjectLocks {
  /** Asks for `id` for this tab. `onHeld` hears whether this tab has it: false while another tab does, true once that
   * one lets it go or this tab takes it over, false again if another tab takes it over. `onHeld` hears nothing after
   * `letGo`, which lets the Project go or stops waiting for it. */
  claim: (id: string, onHeld: (held: boolean) => void) => ProjectClaim
}

/** One tab's claim of one Project. */
export interface ProjectClaim {
  /** Lets the Project go, or stops waiting for it. */
  letGo: () => void
  /** Takes the Project from the tab that has it (Work here instead, ticket 0937). A no-op once let go. */
  takeOver: () => void
}

/** Locks for a page that is the only one with its Projects (the Homepage's demo) or a browser without Web Locks: every
 * Project is this tab's, as before ticket 0834. */
export const soleProjectLocks: ProjectLocks = {
  claim: (_id, onHeld) => {
    onHeld(true)
    return { letGo: () => undefined, takeOver: () => undefined }
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
      let waiting: AbortController | undefined
      let released = false
      let letGo: () => void = () => undefined
      /** Every request this claim made, settled once the browser has let go of all they held. */
      const requests: Promise<unknown>[] = []
      // The lock is held for as long as the promise its callback returns is pending.
      const hold = () => {
        onHeld(true)
        return new Promise<void>((resolve) => {
          letGo = resolve
        })
      }
      /** Asks for the lock and holds it once given. A lock another tab takes over (its request then fails) is waited
       * for again, so it comes back here once that tab lets it go. */
      const request = (options: LockOptions): Promise<unknown> => {
        let given = false
        return locks
          .request(name, options, (lock) => {
            if (released) return
            if (!lock) {
              onHeld(false)
              // Returned, so this request settles only once the wait and any hold after it are over.
              return wait()
            }
            given = true
            return hold()
          })
          .catch(() => {
            if (!given || released) return
            onHeld(false)
            return wait()
          })
      }
      const wait = () => {
        waiting = new AbortController()
        return request({ signal: waiting.signal })
      }
      requests.push((lettingGo.get(name) ?? Promise.resolve()).then(() => request({ ifAvailable: true })))
      return {
        letGo() {
          released = true
          waiting?.abort()
          letGo()
          const settled = Promise.all(requests)
          lettingGo.set(name, settled)
          void settled.then(() => lettingGo.get(name) === settled && lettingGo.delete(name))
        },
        takeOver() {
          if (released) return
          // The wait in line gives way to the request that takes the lock from the other tab.
          waiting?.abort()
          waiting = undefined
          requests.push(request({ steal: true }))
        },
      }
    },
  }
}

/** This browser's locks, or none to wait for where it has no Web Locks. */
export const browserProjectLocks: ProjectLocks = typeof navigator !== 'undefined' && navigator.locks ? webProjectLocks(navigator.locks) : soleProjectLocks
