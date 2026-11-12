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
import { font, loadPrintFonts, MONO } from './printPages'
import { A4_PORTRAIT } from './printPlan'
import { printText } from './printText'
import { exportProjectPdf } from './projectExport'

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

  it('draws a list page for the colors page 1 has no room for', () => {
    const project = fixtureProject({ technique: 'loom', columns: 100, rows: 100 })
    const many = { ...wordsOf(project), colors: Array.from({ length: 90 }, (_, index) => ({ hex: '#123456', name: `Color ${index}`, beads: '10', grams: '0.1 g', tubes: '1 × 5 g' })) }
    const layout = pageOneLayout(project, many)

    expect(layout.lists.length).toBeGreaterThan(0)
    expect(drawNeededListPage(project, many, layout, 0, layout.plan)).toMatchObject({ width: A4_PORTRAIT.width, height: A4_PORTRAIT.height })
  })

  it('prints grams, tubes and the grams note for a known Bead, and none of them for an unknown one', () => {
    const drawn = (project: ReturnType<typeof fixtureProject>) => {
      const words = wordsOf(project)
      const fillText = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText')
      drawPageOne(project, words, pageOneLayout(project, words), pageOneLayout(project, words).plan)
      const texts = fillText.mock.calls.map(([value]) => value)
      fillText.mockRestore()
      return { texts, words }
    }
    const known = drawn(withLayers(fixtureProject({ technique: 'loom', columns: 20, rows: 20 }), { beadId: 'miyuki-delica-11-0', bead: findBead('miyuki-delica-11-0') }))
    expect(known.texts).toEqual(expect.arrayContaining(['to buy', 'grams']))
    expect(known.texts.some((value) => value.startsWith(known.words.gramsNote!.slice(0, 12)))).toBe(true)
    expect(known.texts.some((value) => value.includes(known.words.totalTubes!))).toBe(true)

    const unknown = drawn(withLayers(fixtureProject({ technique: 'loom', columns: 20, rows: 20 }), { beadId: 'a-bead-this-device-never-had', bead: undefined }))
    expect(unknown.words.gramsNote).toBeUndefined()
    expect(unknown.texts).not.toContain('to buy')
    expect(unknown.texts).not.toContain('grams')
    expect(unknown.texts.some((value) => / g\b/.test(value))).toBe(false)
  })

  it.each<[Locale, Translations]>([['en', en], ['ru', ru], ['uk', uk], ['be', be], ['zh', zh], ['es', es], ['pl', pl]])('fits Beads needed\'s column heads in their room in %s', (_locale, messages) => {
    const context = document.createElement('canvas').getContext('2d')!
    context.font = font('400', 6.5, MONO)
    const width = (value: string) => context.measureText(value.toLowerCase()).width
    const { print } = messages
    expect(width(print.columnCode) + width(print.columnBeads), `${print.columnCode} ${print.columnBeads}`).toBeLessThanOrEqual(NEEDED_ROOM.codeAndBeads)
    expect(width(print.columnGrams), print.columnGrams).toBeLessThanOrEqual(NEEDED_ROOM.grams)
    expect(width(print.columnToBuy), print.columnToBuy).toBeLessThanOrEqual(NEEDED_ROOM.toBuy)
  })
})

describe('the PDF of a piece cut into parts (ticket 0914)', () => {
  it('is the overview, then a page for each sheet, each counted in "1 / N"', async () => {
    const project = withLetters(fixtureProject({ technique: 'loom', columns: 150, rows: 100 }), false)
    const words = wordsOf(project)
    const { plan } = pageOneLayout(project, words)

    expect(plan.pageCount).toBe(3)
    expect(await pdfPages(await exportProjectPdf(project, words, 150))).toBe(3)
  }, 60_000)
})
