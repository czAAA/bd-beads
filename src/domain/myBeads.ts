import { makerCodeOf } from './beadCodeSearch'
import type { Bead } from './beads'
import type { ColorCatalog } from './colorCatalog'
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

/** The list with `codes` added after those it holds, each once (ticket 0903). */
export function withCodesAdded(list: MyBeads, catalogId: string, codes: readonly string[]): MyBeads {
  const next = [...new Set([...myBeadsCodes(list, catalogId), ...codes])]
  return next.length > 0 ? { ...list, [catalogId]: next } : list
}

/** The list with one Color catalog's codes cleared, the others kept (ticket 0903, Clear list). */
export function withListCleared(list: MyBeads, catalogId: string): MyBeads {
  const { [catalogId]: _cleared, ...others } = list
  return others
}

/** The codes a pasted text lists (ticket 0903): one a line, or between commas, semicolons or spaces. Letters standing
 * alone before a number ("DB 721") are that code's prefix.
 * @internal Its test checks the splitting on its own. */
export function codeListOf(text: string): string[] {
  const parts = text.split(/[\s,;]+/).filter((part) => part !== '')
  return parts.flatMap((part, index) => {
    if (/^[A-Za-z]+$/.test(part) && /^\d/.test(parts[index + 1] ?? '')) return []
    const prefix = parts[index - 1]
    return [prefix && /^[A-Za-z]+$/.test(prefix) && /^\d/.test(part) ? `${prefix}${part}` : part]
  })
}

/** What a paste does to the list (ticket 0903): the codes added, those the list held already, and the pasted text of
 * each code the catalog does not know. */
export interface PastedCodes {
  added: string[]
  already: string[]
  unknown: string[]
}

/** The catalog's code a pasted one names, read as a shop writes it for the Bead's size first, then for each other size
 * of the catalog, so a code of any size is known. */
function catalogCodeOf(typed: string, bead: Pick<Bead, 'formFactor' | 'size'>, sizes: readonly string[], known: ReadonlySet<string>) {
  for (const size of [bead.size, ...sizes.filter((other) => other !== bead.size)]) {
    const code = makerCodeOf(typed, { formFactor: bead.formFactor, size })
    if (code && known.has(code)) return code
  }
  return undefined
}

/** The codes of a pasted text that `catalog` knows, in any of its sizes, split by whether `held` has them, and the
 * pasted codes it does not know (ticket 0903). A code pasted twice counts once. */
export function pastedCodes(text: string, catalog: ColorCatalog, bead: Pick<Bead, 'formFactor' | 'size'>, held: readonly string[]): PastedCodes {
  const known = new Set(catalog.codes.map((entry) => entry.code))
  const sizes = [...new Set(catalog.codes.flatMap((entry) => entry.sizes))]
  const holds = new Set(held)
  const result: PastedCodes = { added: [], already: [], unknown: [] }
  for (const typed of codeListOf(text)) {
    const code = catalogCodeOf(typed, bead, sizes, known)
    const into = !code ? result.unknown : holds.has(code) ? result.already : result.added
    const named = code ?? typed
    if (!into.includes(named)) into.push(named)
  }
  return result
}
