import { MAX_MAKER_NAME } from './makerName'
import { projectNameOf, withLayer } from './layerRecord'
import type { Project } from './project'

/** A Project's own name (spec 0440, ticket 443): up to 40 characters, never empty. New Project, Rename and Duplicate
 * all take this one limit (ticket 0854). */
export const MAX_PROJECT_NAME = MAX_MAKER_NAME

/** A name as it is kept: trimmed and cut to the longest allowed; empty means the name is refused. */
export function normalizeProjectName(name: string): string {
  return name.trim().slice(0, MAX_PROJECT_NAME).trim()
}

/** The Project under a new name; the caller has checked it is not empty. */
export function withProjectName(project: Project, name: string): Project {
  return withLayer(project, 'canvas', { name: normalizeProjectName(name) })
}

/** A name cut to `room` characters at the last word that fits whole (ticket 0854); a single word longer than that is
 * cut where it ends. */
function shortenAtWord(name: string, room: number): string {
  if (name.length <= room) return name
  const cut = name.slice(0, room)
  const lastSpace = /\s(?=\S*$)/.exec(cut)
  return (/\s/.test(name[room]!) || !lastSpace ? cut : cut.slice(0, lastSpace.index)).trim()
}

/** What Duplicate suggests (ticket 443): the name plus the first unused number from 2 ("Moth 2", "Moth 3"), shortened
 * at a word to fit (ticket 0854). */
export function suggestCopyName(name: string, existingNames: readonly string[]): string {
  const taken = new Set(existingNames.map((existing) => existing.trim().toLowerCase()))
  const trailing = /^(.*\S)\s+(\d+)$/.exec(name.trim())
  const base = trailing ? trailing[1]! : name.trim()
  let number = trailing ? Number(trailing[2]) + 1 : 2
  for (;;) {
    const suffix = ` ${number}`
    const candidate = `${shortenAtWord(base, MAX_PROJECT_NAME - suffix.length)}${suffix}`
    if (!taken.has(candidate.toLowerCase())) return candidate
    number += 1
  }
}

/** Projects joining a library under names it doesn't hold yet (ticket 0860): a taken one, by the library or by one
 * arriving before it, gets Duplicate's next free number, so no two rows share a name. A free one comes as it is. */
export function withFreeNames(arriving: readonly Project[], existingNames: readonly string[]): Project[] {
  const names = [...existingNames]
  return arriving.map((project) => {
    const name = projectNameOf(project)
    const key = name.trim().toLowerCase()
    const free = names.some((existing) => existing.trim().toLowerCase() === key) ? suggestCopyName(name, names) : name
    names.push(free)
    return free === name ? project : withProjectName(project, free)
  })
}

/** A copy of the Project under a new id and name, everything else kept, Row progress included; the copy is what
 * opens, the original stays as it was (ticket 0860). */
export function duplicateProject(project: Project, name: string, id: string = crypto.randomUUID(), now = Date.now()): Project {
  return { ...withProjectName(structuredClone(project), name), id, createdAt: now, updatedAt: now }
}
