import type { ProjectLocks } from '../services/projectLocks'

/** Locks shared by every tab a test makes, as the browser's Web Locks are by a device's tabs (ticket 0834): the first
 * claim of a Project holds it, the later ones wait in line and are told when it comes to them. A take-over (ticket
 * 0937) puts the claim at the head of the line and tells the one it passed that it lost the Project. */
export function sharedProjectLocks(): ProjectLocks {
  const lines = new Map<string, ((held: boolean) => void)[]>()
  return {
    claim(id, onHeld) {
      const line = lines.get(id) ?? []
      lines.set(id, [...line, onHeld])
      onHeld(line.length === 0)
      return {
        letGo() {
          const now = lines.get(id) ?? []
          const rest = now.filter((each) => each !== onHeld)
          lines.set(id, rest)
          if (now[0] === onHeld) rest[0]?.(true)
        },
        takeOver() {
          const now = lines.get(id) ?? []
          if (!now.includes(onHeld) || now[0] === onHeld) return
          const had = now[0]
          lines.set(id, [onHeld, ...now.filter((each) => each !== onHeld)])
          had?.(false)
          onHeld(true)
        },
      }
    },
  }
}
