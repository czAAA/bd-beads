import { beforeAll, describe, expect, it } from 'vitest'
import { fixtureProject } from '../../e2e/support/projects'
import { be } from '../i18n/be'
import { en } from '../i18n/en'
import { es } from '../i18n/es'
import { pl } from '../i18n/pl'
import { ru } from '../i18n/ru'
import { uk } from '../i18n/uk'
import { zh } from '../i18n/zh'
import type { Locale, Translations } from '../i18n/translations'
import { drawCoverPage, drawListPage } from './coverPage'
import { coverLayout, listHeader, TABLE_HEAD } from './coverLayout'
import { font, loadPrintFonts, MONO, SERIF } from './printPages'
import { A4_PORTRAIT, displayedGrid, PRINT_MARGIN } from './printPlan'
import { toHex } from '../domain/color'
import { PRINT_THEME } from './beadLook'
import { printText } from './printText'
import { exportProjectPng, projectPageCount } from './projectExport'
import { frameGrid } from '../testUtils/frameGrid'
import { fillBlanks } from '../domain/fillBlanks'
import { withLayers } from '../testUtils/layerFields'

const wordsOf = (project: ReturnType<typeof fixtureProject>, messages: Translations = en, locale: Locale = 'en') => printText(project, messages, locale, new Date())

const pixel = (canvas: HTMLCanvasElement, x: number, y: number) => {
  const [r, g, b] = canvas.getContext('2d')!.getImageData(Math.round(x), Math.round(y), 1, 1).data
  return toHex({ r: r!, g: g!, b: b! })
}

// The Cover page drawn for real (ticket 0583): one A4 portrait page for both formats.
describe('Cover page', () => {
  beforeAll(loadPrintFonts)

  it('is one A4 portrait page, larger at a higher dpi', () => {
    const project = { ...fixtureProject({ technique: 'loom', columns: 20, rows: 20 }), makerName: 'Ada' }
    const words = wordsOf(project)
    const layout = coverLayout(project, words)

    expect(drawCoverPage(project, words, layout, 1)).toMatchObject({ width: A4_PORTRAIT.width, height: A4_PORTRAIT.height })
    expect(drawCoverPage(project, words, layout, 2)).toMatchObject({ width: A4_PORTRAIT.width * 2, height: A4_PORTRAIT.height * 2 })
  })

  it('draws each bead in its color where the layout puts it', () => {
    const project = fixtureProject({ technique: 'loom', columns: 20, rows: 20 })
    const words = wordsOf(project)
    const layout = coverLayout(project, words)
    const canvas = drawCoverPage(project, words, layout, 1)
    const grid = displayedGrid(project)
    const painted = frameGrid(project)[3]![2]!.color

    expect(pixel(canvas, layout.board.x + (2 + 0.5) * grid.stepAcross * layout.zoom, layout.board.y + (3 + 0.5) * grid.stepDown * layout.zoom)).toBe(painted)
  })

  it('leaves an empty position as bare board, and a White bead drawn as a bead', () => {
    const project = fixtureProject({ technique: 'loom', columns: 20, rows: 20, blank: true, override: [{ row: 3, column: 2, color: '#ffffff' }] })
    const words = wordsOf(project)
    const layout = coverLayout(project, words)
    const canvas = drawCoverPage(project, words, layout, 1)
    const grid = displayedGrid(project)
    const at = (row: number, column: number) => [layout.board.x + (column + 0.5) * grid.stepAcross * layout.zoom, layout.board.y + (row + 0.5) * grid.stepDown * layout.zoom] as const

    expect(pixel(canvas, ...at(5, 5))).toBe(PRINT_THEME.background)
    expect(pixel(canvas, ...at(3, 2))).toBe('#ffffff')
  })

  it('exports the PNG without Swatch letters, whatever the Letters toggle says', async () => {
    const lettered = withLayers(fixtureProject({ technique: 'loom', columns: 20, rows: 20 }), { letters: true, paletteLetters: { '#ff0000': 'R' } })
    const plain = withLayers(lettered, { letters: false })
    const bytes = async (project: typeof lettered) => Array.from(new Uint8Array(await (await exportProjectPng(project, wordsOf(project), 150)).arrayBuffer()))

    expect(await bytes(lettered)).toEqual(await bytes(plain))
  })

  it('draws a list page for the colors the cover has no room for', () => {
    const project = fixtureProject({ technique: 'loom', columns: 60, rows: 60 })
    const base = wordsOf(project)
    const words = { ...base, colors: Array.from({ length: 120 }, (_, index) => ({ hex: '#336699', name: `Color ${index}`, beads: '12' })) }
    const layout = coverLayout(project, words)

    expect(layout.lists.length).toBeGreaterThan(0)
    const page = drawListPage(words, layout, 0, 1)
    expect(page).toMatchObject({ width: A4_PORTRAIT.width, height: A4_PORTRAIT.height })
    // The first swatch, in the first row under the name and the heading.
    expect(pixel(page, PRINT_MARGIN + 6, PRINT_MARGIN + listHeader(words) + TABLE_HEAD + layout.lists[0]!.rowHeight / 2)).toBe('#336699')
  })

  it('exports the cover at the dpi asked, one file for a short list', async () => {
    const project = fixtureProject({ technique: 'loom', columns: 20, rows: 20 })
    const words = wordsOf(project)
    const picture = await createImageBitmap(await exportProjectPng(project, words, 150))

    expect(projectPageCount(project, words)).toBe(1)
    expect([picture.width, picture.height]).toEqual([A4_PORTRAIT.width, A4_PORTRAIT.height])
  })

  it.each<[Locale, Translations]>([['en', en], ['ru', ru], ['uk', uk], ['be', be], ['zh', zh], ['es', es], ['pl', pl]])('fits the tech line and the maker across the page in %s', (locale, messages) => {
    const project = { ...fixtureProject({ technique: 'loom', columns: 130, rows: 60 }), makerName: 'Anna Kowalska' }
    const words = wordsOf(project, messages, locale)
    const context = document.createElement('canvas').getContext('2d')!
    const room = A4_PORTRAIT.width - PRINT_MARGIN * 2
    context.font = font('400', 7.5, MONO)
    const tech = [words.techniqueWord, words.metaLine].join(' · ')
    expect(context.measureText(tech).width, tech).toBeLessThanOrEqual(room)
    context.font = font('italic 400', 13, SERIF)
    const byMaker = fillBlanks(words.labels.byMaker, { maker: words.maker })
    expect(context.measureText(byMaker).width, byMaker).toBeLessThanOrEqual(room)
  })
})
