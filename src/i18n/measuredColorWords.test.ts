import { describe, expect, it } from 'vitest'
import { en } from './en'
import { beadColorsNote, beadPaletteNote } from './measuredColorWords'

describe('the words for where a catalog\'s colors come from (tickets 0886, 1068)', () => {
  it('names MIYUKI\'s photographs, TOHO\'s sample cards, or the made swatches of a catalog with none', () => {
    expect([beadColorsNote(en, 'photographs'), beadColorsNote(en, 'sample-cards'), beadColorsNote(en, undefined)]).toEqual([
      en.palette.beadColors.photoColors,
      en.palette.beadColors.cardColors,
      en.palette.beadColors.approximate,
    ])
    expect([beadPaletteNote(en, 'photographs'), beadPaletteNote(en, 'sample-cards'), beadPaletteNote(en, undefined)]).toEqual([
      en.convertImage.wizard.beadPaletteNotePhotos,
      en.convertImage.wizard.beadPaletteNoteCards,
      en.convertImage.wizard.beadPaletteNote,
    ])
  })
})
