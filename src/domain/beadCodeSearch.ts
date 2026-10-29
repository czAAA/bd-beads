import type { Bead } from './beads'

// A code's shape follows the Color catalog, not the Brand: Miyuki keys Delica `DB433` and Round `1F` differently, while
// TOHO's Cube and Round share one series and one `toho` catalog. The Bead's size names the size prefix a shop adds.
type CodeShape = (typed: string, size: string) => string | undefined

/** Miyuki's Delica prefix is also its size: `DB` 11/0, `DBS` 15/0, `DBM` 10/0, `DBL` 8/0 (research note
 * miyuki-and-toho-shapes-sizes-colors). */
const DELICA_PREFIX: Record<string, string> = { '11/0': 'DB', '15/0': 'DBS', '10/0': 'DBM', '8/0': 'DBL' }

/** Delica, sold as `DB-0433`, `DB0433` or `db 433` for Miyuki's `DB433`: the prefix is the Bead's own or left out. */
const delicaCode: CodeShape = (typed, size) => {
  const own = DELICA_PREFIX[size]
  const match = /^(DB[SML]?)?[-\s]*0*(\d+)([A-Z]*)$/.exec(typed)
  if (!own || !match || (match[1] && match[1] !== own)) return undefined
  return `${own}${match[2]}${match[3]}`
}

/** A seed-bead size as a shop prefixes it: `11/0` is `11`. */
const sizeDigits = (size: string) => /^(\d+)\/0$/.exec(size)?.[1]

/** Miyuki Round, sold as `#1F`, `11-1F` or the SKU `N-RR11-0001F` (`N-RR6S-3284` for a square hole) for Miyuki's `1F`:
 * the size, when written, is the Bead's own. */
const miyukiRoundCode: CodeShape = (typed, size) => {
  const match = /^(?:N-)?(?:RR)?(?:(\d+)S?-)?0*(\d+)([A-Z]*)$/.exec(typed)
  if (!match || (match[1] && match[1] !== sizeDigits(size))) return undefined
  return `${match[2]}${match[3]}`
}

/** TOHO, whose own code is the bare `49` (`PF21` in its PF series), sold as `TO11R49` or `11-49` (research note, Perles
 * & Co): a size is read only before `R`, a dash or a space, so `1149` stays the code 1149. No shop form of the Cube's
 * `1.5mm` is known, so a Cube takes no size prefix. */
const tohoCode: CodeShape = (typed, size) => {
  const match = /^(?:TO)?(?:(\d+)(?:R|[-\s])\s*)?(PF)?0*(\d+)([A-Z]*)$/.exec(typed)
  if (!match || (match[1] && match[1] !== sizeDigits(size))) return undefined
  return `${match[2] ?? ''}${match[3]}${match[4]}`
}

const SHAPES: Record<string, CodeShape> = { 'miyuki-delica': delicaCode, 'miyuki-round': miyukiRoundCode, toho: tohoCode }

/** The maker's own code that `typed`, written as a shop prints it, names for `bead`, or undefined when it is not a code
 * of that Bead's catalog (ticket 0696): a `#`, a retailer or size prefix of the Bead's own size, a dash or space and the
 * number's leading zeros are dropped; a prefix of another size or Brand is not a match. */
export function makerCodeOf(typed: string, bead: Pick<Bead, 'formFactor' | 'size'>): string | undefined {
  const shape = bead.formFactor.colorCatalog && SHAPES[bead.formFactor.colorCatalog]
  const text = typed.trim().toUpperCase().replace(/^#/, '')
  return shape && text ? shape(text, bead.size) : undefined
}
