import { describe, expect, it } from 'vitest'
import { fixtureProject } from '../../e2e/support/projects'
import { withLetters } from '../domain/project'
import { be } from '../i18n/be'
import { en } from '../i18n/en'
import { es } from '../i18n/es'
import { pl } from '../i18n/pl'
import { ru } from '../i18n/ru'
import { uk } from '../i18n/uk'
import { zh } from '../i18n/zh'
import { font, loadPrintFonts, MONO } from './printPages'
import { A4_PORTRAIT, mm, planPrint } from './printPlan'
import { printText } from './printText'
import { drawSpecificationPage, SPEC_LABEL_ROOM } from './printSpecification'
import type { Locale, Translations } from '../i18n/translations'

// The Specification page drawn for real (ticket 0581): the size of the page, and the labels fit their room in every
// language.

/** The room a column head has: two heads side by side share the 18 mm code column and the 22 mm beads column, so each
 * gets half. */
const HEAD_ROOM = mm(20)

describe('Specification page', () => {
  it('is one A4 page', async () => {
    await loadPrintFonts()
    const project = withLetters(fixtureProject({ technique: 'loom', columns: 130, rows: 60 }), true)
    const plan = planPrint(project)
    const canvas = drawSpecificationPage(printText(project, en, 'en', new Date()), plan, 5)
    expect(canvas.width).toBe(A4_PORTRAIT.width)
    expect(canvas.height).toBe(A4_PORTRAIT.height)
  })

  it.each<[Locale, Translations]>([['en', en], ['ru', ru], ['uk', uk], ['be', be], ['zh', zh], ['es', es], ['pl', pl]])('fits its fact labels and column heads in %s', async (_locale, messages) => {
    await loadPrintFonts()
    const context = document.createElement('canvas').getContext('2d')!
    context.font = font('400', 6.5, MONO)
    const width = (value: string) => context.measureText(value.toLowerCase()).width
    const { print } = messages
    for (const label of [print.madeBy, print.technique, print.bead, print.shape, print.size, print.estimatedSize, print.factBeads, print.chartStyleFact, print.pagesFact]) {
      expect(width(label), label).toBeLessThanOrEqual(SPEC_LABEL_ROOM)
    }
    for (const head of [print.columnLetter, print.columnColor, print.columnCode, print.columnBeads, print.columnGrams, print.columnToBuy]) {
      expect(width(head), head).toBeLessThanOrEqual(HEAD_ROOM)
    }
  })
})
