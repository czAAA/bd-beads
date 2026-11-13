import type { TargetColor } from './convertColors'

/** My beads (ADR 0010 D-3, ticket 0902): the codes a person owns, one list per Color catalog by its id (all Delica sizes
 * share one), yes or no, with no amounts. Kept on the device as Export quality is, never sent. */
export type MyBeads = Readonly<Record<string, readonly string[]>>

/** The list's codes for a Color catalog, in the order they were ticked; none for a Bead with no catalog. */
export function myBeadsCodes(list: MyBeads, catalogId: string | undefined): readonly string[] {
  return (catalogId && list[catalogId]) || []
}

/** The list with a code ticked, or unticked when it holds it already; a catalog left with no code is dropped. */
export function withCodeToggled(list: MyBeads, catalogId: string, code: string): MyBeads {
  const codes = myBeadsCodes(list, catalogId)
  const next = codes.includes(code) ? codes.filter((held) => held !== code) : [...codes, code]
  const { [catalogId]: _left, ...others } = list
  return next.length > 0 ? { ...others, [catalogId]: next } : others
}

/** The list a saved string stands for, or undefined when it is not one. Each catalog's codes are read one by one, so a
 * part that does not read is dropped and the rest kept. */
export function parseMyBeads(raw: string): MyBeads | undefined {
  let saved: unknown
  try {
    saved = JSON.parse(raw)
  } catch {
    return undefined
  }
  if (typeof saved !== 'object' || saved === null || Array.isArray(saved)) return undefined
  return Object.fromEntries(
    Object.entries(saved).flatMap(([catalogId, codes]) => {
      const kept = Array.isArray(codes) ? [...new Set(codes.filter((code): code is string => typeof code === 'string' && code !== ''))] : []
      return kept.length > 0 ? [[catalogId, kept]] : []
    }),
  )
}

/** The saved form of the list, a JSON object of code lists; null for an empty one, so nothing is kept. */
export function writeMyBeads(list: MyBeads): string | null {
  return Object.keys(list).length > 0 ? JSON.stringify(list) : null
}

/** The Bead's codes a match to My beads may use (ticket 0902): those of `targets` (made in the Bead's size) in the list. */
export function ownedTargets(targets: readonly TargetColor[], codes: readonly string[]): TargetColor[] {
  const owned = new Set(codes)
  return targets.filter((target) => target.code !== undefined && owned.has(target.code))
}
