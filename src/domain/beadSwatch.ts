import { channelsOf, mix, toHex } from './color'
import type { ColorCatalog } from './colorCatalog'
import { familyHex } from './palette'

type Finish = ColorCatalog['codes'][number]['finish']

/** A Finish as a change to the family color (ticket 0537, ADR 0072): `toward` is white or black, `by` how far, and
 * `grey` how much color is drained first. Ours, not a maker's: the swatch is approximate. */
interface FinishChange {
  toward: 0 | 255
  by: number
  grey?: number
}

const FINISH_CHANGES: Readonly<Record<Finish, FinishChange>> = {
  opaque: { toward: 255, by: 0 },
  transparent: { toward: 255, by: 0.3 },
  ceylon: { toward: 255, by: 0.25 },
  'silver-lined': { toward: 255, by: 0.12 },
  luster: { toward: 255, by: 0.18 },
  matte: { toward: 0, by: 0.08, grey: 0.25 },
  rainbow: { toward: 255, by: 0.08, grey: 0.15 },
  metallic: { toward: 0, by: 0.22 },
  plated: { toward: 0, by: 0.12 },
}

/** The generated swatch of a color family in a Finish: the family's hex changed by the Finish. Pure and approximate;
 * undefined for a family with no single color (ticket 0537).
 * @internal Its test checks each Finish's change on its own. */
export function swatchHex(family: string, finish: Finish): string | undefined {
  const base = familyHex(family)
  if (!base) return undefined
  const { toward, by, grey = 0 } = FINISH_CHANGES[finish]
  const rgb = channelsOf(base)
  const average = (rgb.r + rgb.g + rgb.b) / 3
  return toHex(mix(mix(rgb, { r: average, g: average, b: average }, grey), { r: toward, g: toward, b: toward }, by))
}

/** One code of a Bead's Color catalog as the picker lists it. */
export interface CatalogSwatch {
  code: string
  family: string
  finish: Finish
  hex: string
  /** True for a generated hex; a measured one is not approximate. */
  approximate: boolean
  discontinued: boolean
  /** The Palette already holds a swatch of this hex, so the code cannot be added a second time. */
  taken: boolean
}

/** The codes of `catalog` that exist in Bead size `size`, in catalog order, each with its swatch. A code whose families
 * have no single color (a Mix) is left out. `paletteHexes` are the hexes the Palette already holds (ticket 0537). */
export function catalogSwatches(catalog: ColorCatalog, size: string, paletteHexes: readonly string[]): CatalogSwatch[] {
  const held = new Set(paletteHexes)
  return catalog.codes.flatMap((entry) => {
    if (!entry.sizes.includes(size)) return []
    const family = entry.family.find((name) => familyHex(name))
    const hex = entry.hex ?? (family ? swatchHex(family, entry.finish) : undefined)
    if (!family || !hex) return []
    return [{ code: entry.code, family, finish: entry.finish, hex, approximate: !entry.hex, discontinued: !!entry.discontinued, taken: held.has(hex) }]
  })
}
