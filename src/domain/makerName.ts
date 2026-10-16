import type { Project } from './project'

/**
 * The maker's name (CONTEXT.md, ADR 0060): who made a Project, printed on its PDF and PNG exports. It belongs to the
 * Project; what a name may be is here.
 */

/** The longest name the field takes (NameOnExports card). */
export const MAX_MAKER_NAME = 40

/** A name as it is kept: trimmed, and no longer than the field allows. */
export function normalizeMakerName(name: string): string {
  return name.trim().slice(0, MAX_MAKER_NAME).trim()
}

/** The Project with this maker's name (ADR 0060); an empty name takes it off, and the exports then print none. */
export function withMakerName(project: Project, name: string): Project {
  const { makerName: _old, ...rest } = project
  const makerName = normalizeMakerName(name)
  return makerName ? { ...rest, makerName } : rest
}
