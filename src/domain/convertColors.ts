import { catalogSwatches, type CatalogSwatch } from './beadSwatch'
import type { ColorCatalog } from './colorCatalog'
import type { ReducedColors } from './imageColors'
import { nearestColor } from './imageColors'
import { addedColorId, type PaletteCodes, type PaletteColor } from './palette'
import type { Cell, Grid } from './project'

// The Convert image wizard's colors (spec 0645, ADR 0010): the picture's reduced colors matched to a source, then the
// maker's choice for each applied after the match, so changing the source keeps every keep, remap and empty.

/** What found colors are matched to: the Bead's Color catalog, its Brand's built-in colors, or nothing (Exact). */
export type ColorSource = 'bead-colors' | 'default' | 'exact'

/** A color a found color becomes. A Bead color carries its code, family and Finish; a built-in color its id; one with
 * neither is a Custom color. */
export interface TargetColor {
  hex: string
  code?: string
  family?: string
  finish?: CatalogSwatch['finish']
  colorId?: string
}

/** What the maker chose for a found color (FoundColorRow card): its own picture color, another color, or no bead. */
export type FoundColorChoice = { kind: 'exact' } | { kind: 'remap'; target: TargetColor } | { kind: 'empty' }

/** The maker's choices, by the found color's picture hex. */
export type ColorChoices = ReadonlyMap<string, FoundColorChoice>

/** One color found in the picture: how many beads, what the source matched it to, and what its beads become. */
export interface FoundColor {
  pictureHex: string
  count: number
  match: TargetColor
  choice: FoundColorChoice | undefined
  /** Undefined when the color is set to empty. */
  result: TargetColor | undefined
}

/** The codes of a Color catalog a match may use (spec 0645): those made in the Bead size, discontinued ones left out. */
export function beadColorTargets(catalog: ColorCatalog, size: string, builtIns: readonly PaletteColor[]): TargetColor[] {
  return catalogSwatches(catalog, size, [], builtIns)
    .filter((swatch) => !swatch.discontinued)
    .map(({ hex, code, family, finish }) => ({ hex, code, family, finish }))
}

/** The colors a source matches to: the Bead colors given, the built-in colors, or none for Exact. */
export function sourceTargets(source: ColorSource, builtIns: readonly PaletteColor[], beadColors: readonly TargetColor[]): TargetColor[] | undefined {
  if (source === 'exact') return undefined
  return source === 'bead-colors' ? [...beadColors] : builtIns.map((color) => ({ hex: color.hex, colorId: color.id }))
}

/** The nearest of the targets to `hex`, by how alike they look (OKLab, ticket 0634); itself, a Custom color, under Exact. */
function matchOf(hex: string, targets: readonly TargetColor[] | undefined, nearest: (hex: string) => string | undefined): TargetColor {
  if (!targets) return { hex }
  const hit = nearest(hex)
  return targets.find((target) => target.hex === hit) ?? { hex }
}

/** Each found color matched to the source and given the maker's choice, most beads first. */
export function matchFoundColors(reduced: ReducedColors, targets: readonly TargetColor[] | undefined, choices: ColorChoices): FoundColor[] {
  const hexes = targets?.map((target) => target.hex) ?? []
  const nearest = (hex: string) => nearestColor(hexes, hex)
  return reduced.colors.map(({ hex, count }) => {
    const match = matchOf(hex, targets, nearest)
    const choice = choices.get(hex)
    const result = !choice ? match : choice.kind === 'exact' ? { hex } : choice.kind === 'remap' ? choice.target : undefined
    return { pictureHex: hex, count, match, choice, result }
  })
}

/** What each sampled hex becomes: its found color's result, or no bead. */
export function resultLookup(reduced: ReducedColors, found: readonly FoundColor[]): (hex: string) => string | null {
  const byPicture = new Map(found.map((color) => [color.pictureHex, color.result?.hex ?? null]))
  return (hex) => byPicture.get(reduced.byHex.get(hex) ?? '') ?? null
}

/** The Project's grid from the Frame's sampled colors (undefined off the picture or too transparent). */
export function convertFrame(raw: readonly (readonly (string | undefined)[])[], reduced: ReducedColors, found: readonly FoundColor[]): Grid {
  const result = resultLookup(reduced, found)
  return raw.map((row) => row.map<Cell>((hex) => ({ color: hex === undefined ? null : result(hex) })))
}

/** The new Project's Palette (spec 0645): its built-in colors, then every other color its beads use, most beads first,
 * each an ordinary added swatch; a Bead color brings its code, built-in hex or not. No Image colors are kept. */
export function newProjectPalette(builtIns: readonly PaletteColor[], found: readonly FoundColor[]): { ids: string[]; codes: PaletteCodes } {
  const ids = builtIns.map((color) => color.id)
  const held = new Set(builtIns.map((color) => color.hex))
  const codes: Record<string, string> = {}
  for (const { result } of found) {
    if (!result) continue
    if (result.code && !codes[result.hex]) codes[result.hex] = result.code
    if (held.has(result.hex)) continue
    held.add(result.hex)
    ids.push(addedColorId(result.hex))
  }
  return { ids, codes }
}
