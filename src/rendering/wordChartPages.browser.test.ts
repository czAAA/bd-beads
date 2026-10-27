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
import { blankPage, loadPrintFonts } from './printPages'
import { A4_PORTRAIT, PRINT_MARGIN } from './printPlan'
import { printText } from './printText'
import { exportWordChartPng } from './projectExport'
import type { Locale, Translations } from '../i18n/translations'
import { drawWordChartPages, measureWordChart, wordChartPageCount } from './wordChartPages'

// The Word chart drawn for real (ticket 0574): how many sheets it takes, and that its picture is a PNG.
function wordsOf(technique: 'loom' | 'peyote' | 'brick', columns: number, rows: number) {
  const project = withLetters(fixtureProject({ technique, columns, rows }), true)
  return printText(project, en, 'en', new Date())
}

describe('Word chart pages and picture', () => {
  it('takes one sheet for a small Frame and more for a tall one, each the size of the page', async () => {
    await loadPrintFonts()
    const small = wordsOf('loom', 10, 8)
    const tall = wordsOf('peyote', 20, 120)
    expect(wordChartPageCount(small, A4_PORTRAIT)).toBe(1)
    const count = wordChartPageCount(tall, A4_PORTRAIT)
    expect(count).toBeGreaterThan(1)

    const pages = [...drawWordChartPages(tall, A4_PORTRAIT, () => blankPage(A4_PORTRAIT, 1), 5, 4 + count)]
    expect(pages).toHaveLength(count)
    expect(pages.every((page) => page.width === A4_PORTRAIT.width && page.height === A4_PORTRAIT.height)).toBe(true)
  })

  it('makes a PNG that is larger at a higher Export quality', async () => {
    const words = wordsOf('brick', 12, 30)
    const medium = await exportWordChartPng(words, 1)
    const high = await exportWordChartPng(words, 1.5)
    expect(medium.type).toBe('image/png')
    expect(high.size).toBeGreaterThan(medium.size)
  })

  // Text fit (ticket 552): the label column holds the longest label, "Row 250 (R):", in every language, and still leaves
  // most of the line for the runs; the key's notes stay a few lines.
  it.each<[Locale, Translations]>([['en', en], ['ru', ru], ['uk', uk], ['be', be], ['zh', zh], ['es', es], ['pl', pl]])('leaves the runs most of the line in %s', async (locale, messages) => {
    await loadPrintFonts()
    const project = withLetters(fixtureProject({ technique: 'brick', columns: 8, rows: 250 }), true)
    const words = printText(project, messages, locale, new Date())
    const width = A4_PORTRAIT.width - PRINT_MARGIN * 2
    const measured = measureWordChart(document.createElement('canvas').getContext('2d')!, words, width)

    expect(measured.runsWidth).toBeGreaterThan(width * 0.6)
    expect(measured.key.notes.length).toBeLessThanOrEqual(10)
  })
})
