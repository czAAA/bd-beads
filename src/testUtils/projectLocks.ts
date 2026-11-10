import type { ProjectLocks } from '../services/projectLocks'

/** Locks shared by every tab a test makes, as the browser's Web Locks are by a device's tabs (ticket 0834): the first
 * claim of a Project holds it, the later ones wait in line and are told when it comes to them. */
export function sharedProjectLocks(): ProjectLocks {
  const lines = new Map<string, ((held: boolean) => void)[]>()
  return {
    claim(id, onHeld) {
      const line = lines.get(id) ?? []
      lines.set(id, [...line, onHeld])
      onHeld(line.length === 0)
      return () => {
        const now = lines.get(id) ?? []
        const rest = now.filter((each) => each !== onHeld)
        lines.set(id, rest)
        if (now[0] === onHeld) rest[0]?.(true)
      }
    },
  }
}
