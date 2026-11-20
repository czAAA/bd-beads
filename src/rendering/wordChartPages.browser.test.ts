import { describe, expect, it } from 'vitest'
import { fixtureProject } from '../../e2e/support/projects'
import { be } from '../i18n/be'
import { en } from '../i18n/en'
import { es } from '../i18n/es'
import { pl } from '../i18n/pl'
import { ru } from '../i18n/ru'
import { uk } from '../i18n/uk'
import { zh } from '../i18n/zh'
import { blankPage, loadPrintFonts, pt } from './printPages'
import { A4_PORTRAIT } from './printPlan'
import { printText } from './printText'
import type { Locale, Translations } from '../i18n/translations'
import type { PrintedRunUnit, PrintText } from './printText'
import { drawWordChartPages, placeRuns, wordChartPageCount } from './wordChartPages'

// The Word chart drawn for real (ticket 0574): how many sheets it takes, and that its picture is a PNG.
function wordsOf(technique: 'loom' | 'peyote' | 'brick', columns: number, rows: number) {
  const project = fixtureProject({ technique, columns, rows })
  return printText(project, en, 'en', new Date(), { rowByRow: true })
}

/** What each drawn sheet says: its title with its own rows, and how many columns of rows it runs in (the row numbers'
 * distinct right edges under the title: a row number is set right-aligned, a run's count is not). */
function drawnSheets(words: PrintText): { title: string; columns: number }[] {
  const chart = words.wordChart!
  const labels = new Set(chart.rows.map((row) => row.label))
  const sheets: { value: string; x: number; y: number; right: boolean }[][] = []
  const makePage = () => {
    const made = blankPage(A4_PORTRAIT, 1)
    const texts: { value: string; x: number; y: number; right: boolean }[] = []
    const fill = made.context.fillText.bind(made.context)
    made.context.fillText = (value, x, y, maxWidth) => {
      texts.push({ value, x, y, right: made.context.textAlign === 'right' })
      fill(value, x, y, maxWidth)
    }
    sheets.push(texts)
    return made
  }
  const count = wordChartPageCount(words, A4_PORTRAIT)
  expect([...drawWordChartPages(words, A4_PORTRAIT, makePage, 1, count)]).toHaveLength(count)
  return sheets.map((texts) => {
    const at = texts.findIndex((drawn) => drawn.value === chart.title)
    const title = texts[at]!
    const rows = texts.filter((drawn) => drawn.y > title.y && drawn.right && labels.has(drawn.value))
    return { title: `${title.value} ${texts[at + 1]!.value}`, columns: new Set(rows.map((drawn) => drawn.x)).size }
  })
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

  /** What the Word chart's sheets write, in order; with `rowType`, only what is set in the rows' type (DM Mono 400 10 pt). */
  function written(words: PrintText, rowType = false): string[] {
    const texts: string[] = []
    const rowSize = pt(10)
    const inRowType = (style: string) => style.includes('DM Mono') && Math.abs(Number(/([\d.]+)px/.exec(style)?.[1]) - rowSize) < 0.1
    const makePage = () => {
      const made = blankPage(A4_PORTRAIT, 1)
      const fill = made.context.fillText.bind(made.context)
      made.context.fillText = (value, x, y, maxWidth) => {
        if (!rowType || inRowType(made.context.font)) texts.push(value)
        fill(value, x, y, maxWidth)
      }
      return made
    }
    Array.from(drawWordChartPages(words, A4_PORTRAIT, makePage, 1, 1))
    return texts
  }

  it('writes each run as its count, its bead a swatch with its letter, with no letter beside it and no comma (ticket 1096)', async () => {
    await loadPrintFonts()
    const words = wordsOf('loom', 10, 8)
    const texts = written(words, true)
    const counts = words.wordChart!.rows.flatMap((row) => row.runs.flat().flatMap((part) => ('count' in part ? [String(part.count)] : [])))

    expect(counts.length).toBeGreaterThan(10)
    expect(counts.every((count) => texts.includes(count))).toBe(true)
    expect(texts.some((value) => /[A-Z×*,]/.test(value))).toBe(false)
  })

  it('draws an empty position as the empty swatch the key names, never a × or a star (tickets 0963, 1096)', async () => {
    await loadPrintFonts()
    const words = wordsOf('loom', 10, 8)
    const texts = written(words)

    expect(words.wordChart!.rows.some((row) => row.runs.flat().some((part) => 'count' in part && part.letter === undefined))).toBe(true)
    expect(texts).toContain(en.print.wordChart.empty)
    expect(texts.some((value) => value.includes('×') || value.includes('*'))).toBe(false)
  })

  it('wraps a long row only between runs and pairs, never a run from its swatch or a pair from its brackets', () => {
    const context = document.createElement('canvas').getContext('2d')!
    const pair: PrintedRunUnit = [{ text: '(' }, { count: 1, letter: 'A' }, { count: 1, letter: 'B' }, { text: ')' }]
    const units: PrintedRunUnit[] = Array.from({ length: 12 }, (_, index) => (index % 3 === 1 ? pair : [{ count: 12, letter: 'C' }]))
    const { parts, lines } = placeRuns(context, units, 200)

    expect(lines).toBeGreaterThan(2)
    let at = 0
    for (const unit of units) {
      const placed = parts.slice(at, at + unit.length)
      expect(new Set(placed.map((part) => part.line)).size).toBe(1)
      at += unit.length
    }
  })

  // PrintWordChart card, Acceptance: a bracelet runs in two columns of 41 rows, a wide Schema in one.
  it('runs a 35 × 120 loom in two columns and titles each page with its own rows', async () => {
    await loadPrintFonts()
    // Three colors keep the key to one strip row, so the card's 41 rows a column fit.
    // The last bead in the far corner keeps all 120 rows (ticket 1128).
    const painted = [...['#e63746', '#2a9d8f', '#264653'].map((color, index) => ({ row: index, column: index, color })), { row: 119, column: 34, color: '#264653' }]
    const project = fixtureProject({ technique: 'loom', columns: 35, rows: 120, blank: true, override: painted })
    const words = printText(project, en, 'en', new Date(), { rowByRow: true })
    expect(drawnSheets(words)).toEqual([
      { title: 'Row by row 1–82', columns: 2 },
      { title: 'Row by row 83–120', columns: 1 },
    ])
  })

  it('runs a 100 × 100 loom in one column, each page titled with the rows it holds', async () => {
    await loadPrintFonts()
    const words = wordsOf('loom', 100, 100)
    const sheets = drawnSheets(words)
    expect(sheets.every((sheet) => sheet.columns === 1)).toBe(true)
    const titles = sheets.map((sheet) => sheet.title)
    expect(titles.length).toBeGreaterThan(1)
    expect(titles[0]).toMatch(/^Row by row 1–\d+$/)
    expect(titles.at(-1)).toMatch(/–100$/)
    expect(new Set(titles).size).toBe(titles.length)
  })

  // Text fit (ticket 552): the page lays out and draws in every language, with the longest label "250 (R)".
  it.each<[Locale, Translations]>([['en', en], ['ru', ru], ['uk', uk], ['be', be], ['zh', zh], ['es', es], ['pl', pl]])('lays the page out in %s', async (locale, messages) => {
    await loadPrintFonts()
    const project = fixtureProject({ technique: 'brick', columns: 8, rows: 250 })
    const words = printText(project, messages, locale, new Date(), { rowByRow: true })

    expect(Math.max(...drawnSheets(words).map((sheet) => sheet.columns))).toBe(2)
  })
})
