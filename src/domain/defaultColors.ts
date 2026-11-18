import { findBead } from './beads'
import miyukiDelica from '../data/defaultColors/miyuki-delica.json'
import miyukiRound from '../data/defaultColors/miyuki-round.json'
import toho from '../data/defaultColors/toho.json'

/** One default color as a catalog names it: the maker's code and the color measured for it (ticket 1070). */
interface NamedDefault {
  code: string
  hex: string
}

/** A Color catalog's default colors (ticket 1070): for each Bead size it lists codes in, one code per color family of
 * its Brand, by family id. Drafted from the measured colors by `scripts/draft-default-colors.mjs` in the docs repo. */
interface DefaultColorsFile {
  id: string
  sizes: Readonly<Record<string, Readonly<Record<string, NamedDefault>>>>
}

// Small and needed before any catalog loads, so in the main bundle, unlike the lazy catalogs (ADR 0072). Imported by
// name, as the visual check reads this outside Vite: a new Color catalog brings its file and its line here, and a
// test fails without them.
const FILES: readonly DefaultColorsFile[] = [toho, miyukiDelica, miyukiRound]

/** Every catalog's default colors file, by catalog id.
 * @internal The default colors' test checks each against its catalog; the app asks `namedDefaults`. */
export const DEFAULT_COLOR_FILES: Readonly<Record<string, DefaultColorsFile>> = Object.fromEntries(FILES.map((file) => [file.id, file]))

/** The default colors a Bead's catalog names for its size, by family id; undefined for a Bead with no catalog or one
 * whose catalog lists no codes in its size (TOHO Round 10/0 and 7/0), which keeps the generic family colors. */
export function namedDefaults(beadId: string): Readonly<Record<string, NamedDefault>> | undefined {
  const bead = findBead(beadId)
  const catalog = bead?.formFactor.colorCatalog
  return catalog ? DEFAULT_COLOR_FILES[catalog]?.sizes[bead.size] : undefined
}
