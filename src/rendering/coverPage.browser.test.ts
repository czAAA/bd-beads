import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fixtureProject } from '../../e2e/support/projects'
import { toHex } from '../domain/color'
import { en } from '../i18n/en'
import { drawCoverPage } from './coverPage'
import { coverPageLayout } from './coverPageLayout'
import { pageOneLayout } from './pageOneLayout'
import { loadPrintFonts } from './printPages'
import { PRINT_COLORS } from './printColors'
import { A4_PORTRAIT } from './printPlan'
import { printText } from './printText'
import { exportProjectPdf, exportProjectPng } from './projectExport'

// The Cover page drawn for real (ticket 1096; PrintCover card): the piece in color on the board, the title block, the
// tech line and the footer, as the PDF's first page.

const wordsOf = (project: ReturnType<typeof fixtureProject>, cover = true) => ({ ...printText(project, en, 'en', new Date(), { cover }), name: 'Peacock cuff', maker: 'Ada Lind' })

const pixel = (canvas: HTMLCanvasElement, x: number, y: number) => {
  const [r, g, b] = canvas.getContext('2d')!.getImageData(Math.round(x), Math.round(y), 1, 1).data
  return toHex({ r: r!, g: g!, b: b! })
}

/** What a drawing writes, in order. */
async function written(draw: () => unknown): Promise<string[]> {
  const fillText = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText')
  await draw()
  const values = fillText.mock.calls.map(([value]) => value)
  fillText.mockRestore()
  return values
}

const pageNumbers = (values: string[]) => values.filter((value) => /^\d+ \/ \d+$/.test(value))

/** The pages the PDF says it has. */
async function pdfPages(blob: Blob): Promise<number> {
  return Number(/\/Count (\d+)/.exec(await blob.text())?.[1])
}

describe('the Cover page', () => {
  beforeAll(loadPrintFonts)

  it('shows the piece in color on the board, an empty position as bare board', () => {
    // A column empty inside the piece, which trimming keeps (ticket 1128): nothing above it casts a shadow there.
    const project = fixtureProject({ technique: 'loom', columns: 6, rows: 6, override: Array.from({ length: 6 }, (_, row) => ({ row, column: 2, color: null })) })
    const canvas = drawCoverPage(project, wordsOf(project), A4_PORTRAIT, 1, 2)
    const { board, piece } = coverPageLayout(project)
    const bead = piece.width / 6

    expect(pixel(canvas, board.x + board.width / 2, board.y + 4)).toBe(PRINT_COLORS.board)
    expect(pixel(canvas, piece.x + bead * 2.5, piece.y + bead * 3.5)).toBe(PRINT_COLORS.board)
    expect(pixel(canvas, piece.x + bead * 3.5, piece.y + bead * 3.5)).not.toBe(PRINT_COLORS.board)
  })

  it('writes the technique word, the title, the maker, the Total, the tech line and the page number, and no Swatch letter', async () => {
    const project = fixtureProject({ technique: 'loom', columns: 20, rows: 10 })
    const words = wordsOf(project)
    const values = await written(() => drawCoverPage(project, words, A4_PORTRAIT, 1, 2))

    expect(values).toEqual(expect.arrayContaining([words.techniqueWord, 'Peacock cuff', 'by Ada Lind', words.metaLine, '1 / 2']))
    expect(values.find((value) => value.startsWith(words.colorsCount))).toContain(words.totalBeads)
    expect(values.filter((value) => /^[A-Z]{1,2}$/.test(value))).toEqual([])
  })

  it('runs a long title to two lines, then an ellipsis', async () => {
    const project = fixtureProject({ technique: 'loom', columns: 20, rows: 10 })
    const name = 'A very long name for a cuff that a maker typed to say every last thing about it'
    const values = await written(() => drawCoverPage(project, { ...wordsOf(project), name }, A4_PORTRAIT, 1, 2))
    const title = values.filter((value) => value.length > 3 && name.includes(value.replace('…', '').trimEnd()))

    expect(title).toHaveLength(2)
    expect(title[1]).toMatch(/…$/)
  })

  it('leaves out the title and the "by" line when there is neither', async () => {
    const project = fixtureProject({ technique: 'loom', columns: 20, rows: 10 })
    const words = { ...wordsOf(project), name: '  ', maker: '' }
    const values = await written(() => drawCoverPage(project, words, A4_PORTRAIT, 1, 1))

    expect(values.slice(0, 2)).toEqual([words.techniqueWord, expect.stringMatching(new RegExp(`^${words.colorsCount}`))])
    expect(values.some((value) => value.trim() === '' || value.startsWith('by '))).toBe(false)
  })
})

describe('the PDF with the Cover page (ticket 1096)', () => {
  it('opens on the cover, and counts it on every page after, the list pages too', async () => {
    const project = fixtureProject({ technique: 'loom', columns: 100, rows: 100 })
    const words = { ...wordsOf(project), colors: Array.from({ length: 90 }, (_, index) => ({ hex: '#336699', name: `Color ${index}`, beads: '10' })) }
    const lists = pageOneLayout(project, words).lists.length
    let pages = 0
    const values = await written(async () => (pages = await pdfPages(await exportProjectPdf(project, words, 150))))
    const count = 2 + lists

    expect(lists).toBeGreaterThan(0)
    expect(pages).toBe(count)
    expect(pageNumbers(values)).toEqual(Array.from({ length: count }, (_, index) => `${index + 1} / ${count}`))
  }, 60_000)

  it('opens on page 1 with the switch off', async () => {
    const project = fixtureProject({ technique: 'loom', columns: 20, rows: 20 })

    expect(await pdfPages(await exportProjectPdf(project, wordsOf(project, false), 150))).toBe(1)
  }, 60_000)
})

describe('Picture saves the Cover page (ticket 1096; PngExport card)', () => {
  beforeAll(loadPrintFonts)

  it('is the cover, "1 / 1", whatever the Cover page switch says', async () => {
    const project = fixtureProject({ technique: 'loom', columns: 20, rows: 20 })
    for (const cover of [true, false]) {
      const words = wordsOf(project, cover)
      const values = await written(() => exportProjectPng(project, words, 150))
      expect(values, `switch ${cover ? 'on' : 'off'}`).toEqual(await written(() => drawCoverPage(project, words, A4_PORTRAIT, 1, 1)))
      expect(pageNumbers(values)).toEqual(['1 / 1'])
    }
  })

  it('is one picture at the dpi asked, however many colors the piece has', async () => {
    const project = fixtureProject({ technique: 'loom', columns: 100, rows: 100 })
    const many = { ...wordsOf(project), colors: Array.from({ length: 90 }, (_, index) => ({ hex: '#336699', name: `Color ${index}`, beads: '10' })) }
    const picture = await createImageBitmap(await exportProjectPng(project, many, 300))

    expect(pageOneLayout(project, many).lists.length).toBeGreaterThan(0)
    expect([picture.width, picture.height]).toEqual([A4_PORTRAIT.width * 2, A4_PORTRAIT.height * 2])
  }, 60_000)
})
