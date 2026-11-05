import { describe, expect, it } from 'vitest'
import { en } from '../../i18n/en'
import { ru } from '../../i18n/ru'
import { MAX_IMAGE_COLORS } from '../../domain/imageConversion'
import { insideCards, insideRows } from './insideCopy'

describe("What's inside's copy (ticket 0797)", () => {
  it('has the four cards in order, each with its icon', () => {
    expect(insideCards(en).map(({ icon, name }) => [icon, name])).toEqual([
      ['device', 'Yours, on this device'],
      ['pen-mode', 'For iPad and Pencil'],
      ['check', 'Free forever'],
      ['keyboard', 'Keyboard shortcuts'],
    ])
  })

  it("points the shortcuts card at the Menu path in the app's own labels, in every language", () => {
    expect(insideCards(en)[3].text).toBe('Every edit has its own key. Find them all in Menu → Help → Keyboard shortcuts.')
    expect(insideCards(ru)[3].text).toContain(`${ru.panels.menu.help} → ${ru.shortcutsHelp.title}`)
  })

  it('lists the 13 rows in the order the tour plays them, each with the icon the editor uses for it', () => {
    expect(insideRows(en, 'en').map(({ id, icon }) => [id, icon])).toEqual([
      ['canvas', 'select'],
      ['techniques', 'grid'],
      ['editing', 'paint'],
      ['mirror', 'mirror'],
      ['reference', 'reference-image'],
      ['convert', 'image'],
      ['colors', 'palette'],
      ['letters', 'pattern'],
      ['starters', 'frame'],
      ['rowProgress', 'turn-row-direction'],
      ['beadsNeeded', 'bead'],
      ['exports', 'export'],
      ['savedProjects', 'library'],
    ])
  })

  it("takes Convert image's most colors and the catalogs' brands from the app", () => {
    const rows = insideRows(en, 'en')
    expect(rows.find((row) => row.id === 'convert')!.text).toBe(`A picture into a Schema, in up to ${MAX_IMAGE_COLORS} colors.`)
    expect(rows.find((row) => row.id === 'colors')!.text).toBe('TOHO and Miyuki, and a Palette of your own.')
    expect(insideRows(ru, 'ru').find((row) => row.id === 'colors')!.text).toBe('TOHO и Miyuki и ваша собственная палитра.')
  })
})
