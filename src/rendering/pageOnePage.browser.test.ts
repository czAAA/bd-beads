import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fixtureProject } from '../../e2e/support/projects'
import { findBead } from '../domain/beads'
import { withLetters } from '../domain/layerRecord'
import { withLayers } from '../testUtils/layerFields'
import { be } from '../i18n/be'
import { en } from '../i18n/en'
import { es } from '../i18n/es'
import { pl } from '../i18n/pl'
import { ru } from '../i18n/ru'
import { uk } from '../i18n/uk'
import { zh } from '../i18n/zh'
import type { Locale, Translations } from '../i18n/translations'
import { pageOneLayout } from './pageOneLayout'
import { drawNeededListPage, drawPageOne, NEEDED_ROOM } from './pageOnePage'
import { font, loadPrintFonts, MONO, SERIF } from './printPages'
import { A4_PORTRAIT, PRINT_MARGIN } from './printPlan'
import { printText } from './printText'
import { exportProjectPdf } from './projectExport'
import { PRINT_COLORS } from './printColors'
import { fillBlanks } from '../domain/fillBlanks'

// Page 1 of the PDF drawn for real (ticket 0914; PrintPage1 card): the whole piece and Beads needed, and for most pieces
// the whole PDF.

const wordsOf = (project: ReturnType<typeof fixtureProject>) => printText(project, en, 'en', new Date())

/** The pages the PDF says it has. */
async function pdfPages(blob: Blob): Promise<number> {
  return Number(/\/Count (\d+)/.exec(await blob.text())?.[1])
}

describe('page 1 of the PDF', () => {
  beforeAll(loadPrintFonts)

  it('is one A4 page, its whole chart as drawing with a letter on every bead', () => {
    const project = fixtureProject({ technique: 'loom', columns: 20, rows: 20 })
    const words = wordsOf(project)
    const layout = pageOneLayout(project, words)
    const page = drawPageOne(project, words, layout, layout.plan, 2)

    expect([page.canvas.width, page.canvas.height]).toEqual([A4_PORTRAIT.width * 2, A4_PORTRAIT.height * 2])
    expect(page.drawing).toContain('/F2')
    expect(page.drawing).toMatch(/Td \([A-Z?]\) Tj/)
  })

  it('is the overview of a piece cut into parts: a picture, with no drawing laid over it', () => {
    const project = fixtureProject({ technique: 'loom', columns: 150, rows: 150 })
    const words = wordsOf(project)
    const layout = pageOneLayout(project, words)

    expect(layout.overview).toBeDefined()
    expect(drawPageOne(project, words, layout, layout.plan).drawing).toBeUndefined()
  })

  it('draws its chart with the rim only with Chart border on, and its overview\'s crosses only with Empty grid on (ticket 1127)', () => {
    const small = fixtureProject({ technique: 'loom', columns: 20, rows: 20 })
    const chart = (chartBorder: boolean) => {
      const words = printText(small, en, 'en', new Date(), { chartBorder })
      return drawPageOne(small, words, pageOneLayout(small, words), pageOneLayout(small, words).plan).drawing!.split('\n').filter((line) => line.includes(' c ') && line.endsWith(' S')).length
    }
    expect(chart(true) - chart(false)).toBe(1)

    const big = fixtureProject({ technique: 'loom', columns: 150, rows: 150 })
    const crosses = (emptyGrid: boolean) => {
      const words = printText(big, en, 'en', new Date(), { emptyGrid })
      const layout = pageOneLayout(big, words)
      const stroke = vi.spyOn(CanvasRenderingContext2D.prototype, 'stroke')
      const faint: number[] = []
      stroke.mockImplementation(function (this: CanvasRenderingContext2D) {
        if (this.strokeStyle === PRINT_COLORS.faint) faint.push(1)
      })
      drawPageOne(big, words, layout, layout.plan)
      stroke.mockRestore()
      expect(layout.overview).toBeDefined()
      return faint.length
    }
    // Off, the only faint stroke is the key's empty swatch (ticket 0963); on, every empty position's cross too.
    expect(crosses(false)).toBe(1)
    expect(crosses(true)).toBeGreaterThan(1)
  })

  it('draws a list page for the colors page 1 has no room for', () => {
    const project = fixtureProject({ technique: 'loom', columns: 100, rows: 100 })
    const many = { ...wordsOf(project), colors: Array.from({ length: 90 }, (_, index) => ({ hex: '#123456', name: `Color ${index}`, beads: '10', grams: '0.1 g' })) }
    const layout = pageOneLayout(project, many)

    expect(layout.lists.length).toBeGreaterThan(0)
    expect(drawNeededListPage(project, many, layout, 0, layout.plan)).toMatchObject({ width: A4_PORTRAIT.width, height: A4_PORTRAIT.height })
  })

  const drawn = (project: ReturnType<typeof fixtureProject>) => {
    const words = wordsOf(project)
    const layout = pageOneLayout(project, words)
    const fillText = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText')
    drawPageOne(project, words, layout, layout.plan)
    const calls = fillText.mock.calls.map(([value, x]) => ({ value, x }))
    fillText.mockRestore()
    return { texts: calls.map(({ value }) => value), calls, words, layout }
  }
  const delica = () => withLayers(fixtureProject({ technique: 'loom', columns: 20, rows: 20 }), { beadId: 'miyuki-delica-11-0', bead: findBead('miyuki-delica-11-0') })
  const unknownBead = () => withLayers(fixtureProject({ technique: 'loom', columns: 20, rows: 20 }), { beadId: 'a-bead-this-device-never-had', bead: undefined })

  it('prints grams and the grams note for a known Bead, and none of them for an unknown one; no to buy column (ticket 1096)', () => {
    const known = drawn(delica())
    expect(known.texts).toContain('grams')
    expect(known.texts.some((value) => value.startsWith(known.words.gramsNote!.slice(0, 12)))).toBe(true)

    const unknown = drawn(unknownBead())
    expect(unknown.words.gramsNote).toBeUndefined()
    expect(unknown.texts).not.toContain('grams')
    expect(unknown.texts.some((value) => / g\b/.test(value))).toBe(false)
  })

  it('names the Bead after the heading, and leaves it out for an unknown Bead (ticket 1096)', () => {
    expect(drawn(delica()).texts).toContain(' · Miyuki Delica 11/0')
    expect(drawn(unknownBead()).texts.some((value) => value.startsWith(' · '))).toBe(false)
  })

  it('sets the colors one to a row as wide as the page when they fit, grams at the page edge (ticket 1096)', () => {
    const { calls, words, layout } = drawn(withLayers(fixtureProject({ technique: 'loom', columns: 40, rows: 20 }), { beadId: 'miyuki-delica-11-0', bead: findBead('miyuki-delica-11-0') }))
    const right = A4_PORTRAIT.width - PRINT_MARGIN

    expect(layout.needed.columns).toBe(1)
    const grams = calls.filter(({ value }) => words.colors.some((color) => color.grams === value))
    expect(grams.length).toBeGreaterThan(0)
    expect(grams.every(({ x }) => Math.abs(x - right) < 0.5)).toBe(true)
  })

  it('ends its key with the cross and "empty" when the Schema has empty positions (ticket 0963)', () => {
    const texts = (project: ReturnType<typeof fixtureProject>) => {
      const words = wordsOf(project)
      const fillText = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText')
      const layout = pageOneLayout(project, words)
      drawPageOne(project, words, layout, layout.plan, 1)
      const drawn = fillText.mock.calls.map(([value]) => value)
      fillText.mockRestore()
      return drawn
    }
    const holed = fixtureProject({ technique: 'loom', columns: 20, rows: 20 })
    const overview = fixtureProject({ technique: 'loom', columns: 200, rows: 200 })
    const everyCell = Array.from({ length: 400 }, (_, index) => ({ row: Math.floor(index / 20), column: index % 20, color: '#e63746' }))
    const full = fixtureProject({ technique: 'loom', columns: 20, rows: 20, override: everyCell })
    expect(texts(holed)).toContain(en.print.wordChart.empty)
    expect(texts(overview)).toContain(en.print.wordChart.empty)
    expect(texts(full)).not.toContain(en.print.wordChart.empty)
  })

  it.each<[Locale, Translations]>([['en', en], ['ru', ru], ['uk', uk], ['be', be], ['zh', zh], ['es', es], ['pl', pl]])('fits the tech line and the maker across the page in %s', (locale, messages) => {
    const project = { ...fixtureProject({ technique: 'loom', columns: 130, rows: 60 }), makerName: 'Anna Kowalska' }
    const words = printText(project, messages, locale, new Date())
    const context = document.createElement('canvas').getContext('2d')!
    const room = A4_PORTRAIT.width - PRINT_MARGIN * 2
    context.font = font('400', 7.5, MONO)
    const tech = [words.techniqueWord, words.metaLine].join(' · ')
    expect(context.measureText(tech).width, tech).toBeLessThanOrEqual(room)
    context.font = font('italic 400', 13, SERIF)
    const byMaker = fillBlanks(words.labels.byMaker, { maker: words.maker })
    expect(context.measureText(byMaker).width, byMaker).toBeLessThanOrEqual(room)
  })

  it.each<[Locale, Translations]>([['en', en], ['ru', ru], ['uk', uk], ['be', be], ['zh', zh], ['es', es], ['pl', pl]])('fits Beads needed\'s column heads in their room in %s', (_locale, messages) => {
    const context = document.createElement('canvas').getContext('2d')!
    context.font = font('400', 6.5, MONO)
    const width = (value: string) => context.measureText(value.toLowerCase()).width
    const { print } = messages
    expect(width(print.columnCode) + width(print.columnBeads), `${print.columnCode} ${print.columnBeads}`).toBeLessThanOrEqual(NEEDED_ROOM.codeAndBeads)
    expect(width(print.columnGrams), print.columnGrams).toBeLessThanOrEqual(NEEDED_ROOM.grams)
  })
})

describe('the PDF of a piece cut into parts (ticket 0914)', () => {
  it('is the overview, then a page for each sheet, each counted in "1 / N"', async () => {
    const project = withLetters(fixtureProject({ technique: 'loom', columns: 150, rows: 100 }), 'frame', false)
    const words = wordsOf(project)
    const { plan } = pageOneLayout(project, words)

    expect(plan.pageCount).toBe(3)
    expect(await pdfPages(await exportProjectPdf(project, words, 150))).toBe(3)
  }, 60_000)
})

describe('the overview\'s rulers', () => {
  beforeAll(loadPrintFonts)

  it('numbers the overview from 1 at its left and top, every 5th or 10th, all regular and muted in one size (ticket 1129)', () => {
    const project = fixtureProject({ technique: 'loom', columns: 150, rows: 100 })
    const words = wordsOf(project)
    const layout = pageOneLayout(project, words)
    const fillText = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText')
    const drawn: { value: string; font: string; color: string }[] = []
    fillText.mockImplementation(function (this: CanvasRenderingContext2D, value: string) {
      drawn.push({ value, font: this.font, color: String(this.fillStyle) })
    })
    drawPageOne(project, words, layout, layout.plan)
    fillText.mockRestore()
    const numbers = drawn.filter((text) => /^\d+$/.test(text.value) && text.color === PRINT_COLORS.muted)
    const values = new Set(numbers.map((text) => Number(text.value)))

    expect(layout.overview).toBeDefined()
    expect(values.has(1)).toBe(true)
    expect([...values].every((value) => value === 1 || value % 5 === 0)).toBe(true)
    expect(Math.max(...values)).toBe(150)
    expect(new Set(numbers.map((text) => text.font)).size).toBe(1)
    expect(numbers[0]!.font).not.toMatch(/^(bold|700)/)
  })
})
