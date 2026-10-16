import { MAX_MAKER_NAME } from './makerName'
import type { Project } from './project'

/**
 * A Project's own name (spec 0440, ticket 443): what Rename and Duplicate ask for. The same 40 characters as the
 * Maker's name, and it may not be empty ("A Project needs a name.").
 */
export const MAX_PROJECT_NAME = MAX_MAKER_NAME

/** A name as it is kept: trimmed and cut to the longest allowed; empty means the name is refused. */
export function normalizeProjectName(name: string): string {
  return name.trim().slice(0, MAX_PROJECT_NAME).trim()
}

/** The Project under a new name; the caller has checked it is not empty. */
export function withProjectName(project: Project, name: string): Project {
  return { ...project, name: normalizeProjectName(name) }
}

/**
 * What Duplicate suggests (ticket 443): the name plus the first unused number from 2 ("Moth 2", then "Moth 3" once that
 * exists). A name that already ends in a number ("Moth 2") suggests the next free one after it ("Moth 3"). The base is
 * trimmed so the suggestion still fits the name length.
 */
export function suggestCopyName(name: string, existingNames: readonly string[]): string {
  const taken = new Set(existingNames.map((existing) => existing.trim().toLowerCase()))
  const trailing = /^(.*\S)\s+(\d+)$/.exec(name.trim())
  const base = trailing ? trailing[1]! : name.trim()
  let number = trailing ? Number(trailing[2]) + 1 : 2
  for (;;) {
    const suffix = ` ${number}`
    const candidate = `${base.slice(0, MAX_PROJECT_NAME - suffix.length).trim()}${suffix}`
    if (!taken.has(candidate.toLowerCase())) return candidate
    number += 1
  }
}

/** A copy of the Project under a new id and name, everything else kept, Row progress included, so it works as a snapshot. */
export function duplicateProject(project: Project, name: string, id: string = crypto.randomUUID(), now = Date.now()): Project {
  return { ...structuredClone(project), id, name: normalizeProjectName(name), createdAt: now, updatedAt: now }
}
