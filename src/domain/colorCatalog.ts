import { normalizeHex } from './color'

/** The Finishes every Brand's wording is mapped onto (ADR 0072, ticket 536), in the order they are listed. */
export const FINISHES = [
  'transparent',
  'opaque',
  'ceylon',
  'silver-lined',
  'luster',
  'matte',
  'rainbow',
  'metallic',
  'plated',
] as const

export type Finish = (typeof FINISHES)[number]

/** One maker code: facts only, no photo or durability (ADR 0072); a hex only once a human has measured one. */
interface ColorCode {
  /** The maker's own code, e.g. `DB1`. */
  code: string
  /** The maker's color family names, one or two. */
  family: string[]
  finish: Finish
  /** The maker's own words for the finish, kept for display. */
  wording: string
  /** The Bead sizes the code exists in, e.g. `11/0`. */
  sizes: string[]
  /** A hex measured for this code (ticket 0537): replaces the generated swatch. Never derived from the code's number. */
  hex?: string
  discontinued?: boolean
}

/** A Brand's table of maker codes (ADR 0072). Every Form factor of the Brand that has one names its `id`. */
export interface ColorCatalog {
  id: string
  codes: ColorCode[]
}

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string' && item !== '')

function parseCode(raw: unknown, catalogId: string): ColorCode {
  const row = raw as Partial<Record<keyof ColorCode, unknown>> | null
  const fail = (why: string): never => {
    throw new Error(`Color catalog ${catalogId}: ${why}`)
  }
  if (typeof row !== 'object' || row === null) return fail('a code is not an object')
  if (typeof row.code !== 'string' || row.code === '') return fail('a code has no maker code')
  const where = `code ${row.code}`
  if (!isStringList(row.family)) return fail(`${where} has no color family`)
  if (!FINISHES.includes(row.finish as Finish)) return fail(`${where} has an unknown finish`)
  if (typeof row.wording !== 'string') return fail(`${where} has no finish wording`)
  if (!isStringList(row.sizes)) return fail(`${where} has no sizes`)
  if (row.discontinued !== undefined && row.discontinued !== true) return fail(`${where} has a bad discontinued flag`)
  const hex = typeof row.hex === 'string' ? normalizeHex(row.hex) : undefined
  return {
    code: row.code,
    family: row.family,
    finish: row.finish as Finish,
    wording: row.wording,
    sizes: row.sizes,
    ...(hex ? { hex } : {}),
    ...(row.discontinued ? { discontinued: true } : {}),
  }
}

/** Reads a catalog file's contents, throwing on the first thing that is not a catalog (a bad file fails loudly, not
 * quietly into wrong colors). The id must be the one asked for, and a code may appear once. */
export function parseColorCatalog(raw: unknown, expectedId: string): ColorCatalog {
  const file = raw as { id?: unknown; codes?: unknown } | null
  if (typeof file !== 'object' || file === null || file.id !== expectedId || !Array.isArray(file.codes)) {
    throw new Error(`Color catalog ${expectedId}: not a catalog of that id`)
  }
  const codes = file.codes.map((row) => parseCode(row, expectedId))
  if (new Set(codes.map((row) => row.code)).size !== codes.length) {
    throw new Error(`Color catalog ${expectedId}: a code is listed twice`)
  }
  return { id: expectedId, codes }
}

/** The catalog's entry for a maker code; undefined for a code it does not list (ticket 0760). */
export function catalogEntry(catalog: ColorCatalog, code: string): ColorCatalog['codes'][number] | undefined {
  return catalog.codes.find((entry) => entry.code === code)
}
