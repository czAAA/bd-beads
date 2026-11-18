import type { MeasuredColorSource } from '../domain/colorCatalog'
import type { Translations } from './translations'

/** Each source's words in the Palette popover and in the converter's line, so a new source fails the type check here. */
const NOTE_KEYS = {
  photographs: { popover: 'photoColors', line: 'beadPaletteNotePhotos' },
  'sample-cards': { popover: 'cardColors', line: 'beadPaletteNoteCards' },
} as const satisfies Record<MeasuredColorSource, unknown>

/** The Palette popover's note on where its Bead colors come from, in the catalog's own words (tickets 0886, 1068):
 * MIYUKI's photographs, TOHO's sample cards, or made from the color family and Finish where nothing was read. */
export function beadColorsNote(t: Translations, source: MeasuredColorSource | undefined): string {
  const words = t.palette.beadColors
  return source ? words[NOTE_KEYS[source].popover] : words.approximate
}

/** The converter's line for the Bead's palette, as beadColorsNote; its `{bead}` blank is left for the caller to fill. */
export function beadPaletteNote(t: Translations, source: MeasuredColorSource | undefined): string {
  const words = t.convertImage.wizard
  return source ? words[NOTE_KEYS[source].line] : words.beadPaletteNote
}
