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
import { A4_PORTRAIT } from './printPlan'
import { printText } from './printText'
import type { Locale, Translations } from '../i18n/translations'
import { drawWordChartPages, wordChartColumns, wordChartPageCount, wordChartPageTitles } from './wordChartPages'

// The Word chart drawn for real (ticket 0574): how many sheets it takes, and that its picture is a PNG.
function wordsOf(technique: 'loom' | 'peyote' | 'brick', columns: number, rows: number) {
  const project = withLetters(fixtureProject({ technique, columns, rows }), true)
  return printText(project, en, 'en', new Date())
}

describe('Word chart pages', () => {
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

  // PrintWordChart card, Acceptance: a bracelet runs in two columns of 41 rows, a wide Schema in one.
  it('runs a 35 × 120 loom in two columns and titles each page with its own rows', async () => {
    await loadPrintFonts()
    // Three colors keep the key to one strip row, so the card's 41 rows a column fit.
    const painted = ['#e63746', '#2a9d8f', '#264653'].map((color, index) => ({ row: index, column: index, color }))
    const project = withLetters(fixtureProject({ technique: 'loom', columns: 35, rows: 120, blank: true, override: painted }), true)
    const words = printText(project, en, 'en', new Date())
    expect(wordChartColumns(words, A4_PORTRAIT)).toBe(2)
    expect(wordChartPageTitles(words, A4_PORTRAIT)).toEqual(['Row by row 1–82', 'Row by row 83–120'])
  })

  it('runs a 100 × 100 loom in one column, each page titled with the rows it holds', async () => {
    await loadPrintFonts()
    const words = wordsOf('loom', 100, 100)
    expect(wordChartColumns(words, A4_PORTRAIT)).toBe(1)
    const titles = wordChartPageTitles(words, A4_PORTRAIT)
    expect(titles.length).toBeGreaterThan(1)
    expect(titles[0]).toMatch(/^Row by row 1–\d+$/)
    expect(titles.at(-1)).toMatch(/–100$/)
    expect(new Set(titles).size).toBe(titles.length)
  })

  // Text fit (ticket 552): the page lays out and draws in every language, with the longest label "250 (R)".
  it.each<[Locale, Translations]>([['en', en], ['ru', ru], ['uk', uk], ['be', be], ['zh', zh], ['es', es], ['pl', pl]])('lays the page out in %s', async (locale, messages) => {
    await loadPrintFonts()
    const project = withLetters(fixtureProject({ technique: 'brick', columns: 8, rows: 250 }), true)
    const words = printText(project, messages, locale, new Date())
    const count = wordChartPageCount(words, A4_PORTRAIT)

    expect(wordChartColumns(words, A4_PORTRAIT)).toBe(2)
    expect([...drawWordChartPages(words, A4_PORTRAIT, () => blankPage(A4_PORTRAIT, 1), 1, count)]).toHaveLength(count)
  })
})
