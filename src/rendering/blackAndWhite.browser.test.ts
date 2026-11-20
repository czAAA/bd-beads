import { beforeAll, describe, expect, it } from 'vitest'
import { fixtureProject } from '../../e2e/support/projects'
import { en } from '../i18n/en'
import { drawChartPage } from './chartPage'
import { mmPt } from './chartVector'
import { drawCoverPage } from './coverPage'
import { pageOneLayout } from './pageOneLayout'
import { drawPageOne } from './pageOnePage'
import { blankPage, loadPrintFonts } from './printPages'
import { printText, type PrintChoices } from './printText'
import { A4_PORTRAIT } from './printPlan'
import { drawWordChartPages } from './wordChartPages'

// Black and white drawn for real (ticket 1096; PrintBlackAndWhite card): every page after the cover in one ink, each bead
// on paper, a 10, 20 or 30% tint or solid black; the cover in color.

const wordsOf = (project: ReturnType<typeof fixtureProject>, choices: PrintChoices = { blackAndWhite: true }) => printText(project, en, 'en', new Date(), choices)

/** The colors a page's drawing sets, as 0–1 channels: `rg` fills (beads, letters) and `RG` strokes (lines). */
function drawingColors(drawing: string, operator: 'rg' | 'RG'): number[][] {
  return [...drawing.matchAll(new RegExp(`^([\\d.]+) ([\\d.]+) ([\\d.]+) ${operator}$`, 'gm'))].map((match) => match.slice(1, 4).map(Number))
}

/** How many pixels of a page's picture hold a color rather than a grey. */
function coloredPixels(canvas: HTMLCanvasElement): number {
  const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)
  let colored = 0
  for (let at = 0; at < data.length; at += 4) if (Math.abs(data[at]! - data[at + 1]!) > 2 || Math.abs(data[at + 1]! - data[at + 2]!) > 2) colored += 1
  return colored
}

/** Paper, the three tints and black, as a PDF fill's channel. */
const TONES = [1, 0.902, 0.8, 0.702, 0]

describe('Black and white', () => {
  beforeAll(loadPrintFonts)

  it('draws page 1, the chart pages and the Word chart with no color in their pictures or their drawing', () => {
    const project = fixtureProject({ technique: 'loom', columns: 150, rows: 100 })
    const words = wordsOf(project, { blackAndWhite: true, rowByRow: true })
    const layout = pageOneLayout(project, words)
    const sheets = [...new Set(layout.plan.parts.map((part) => part.page))].map((page) => layout.plan.parts.filter((part) => part.page === page))
    const chartPages = sheets.map((parts) => drawChartPage(project, words, layout.plan, parts))
    const wordPages = [...drawWordChartPages(words, A4_PORTRAIT, () => blankPage(A4_PORTRAIT, 1), 4, 5)]

    expect(layout.overview).toBeDefined()
    const pictures = [drawPageOne(project, words, layout, layout.plan).canvas, ...chartPages.map((page) => page.canvas), ...wordPages]
    expect(pictures.map(coloredPixels)).toEqual(pictures.map(() => 0))
    for (const { drawing } of chartPages) {
      expect(drawingColors(drawing, 'rg').every(([r, g, b]) => r === g && g === b)).toBe(true)
      expect(drawingColors(drawing, 'RG')).toEqual(drawingColors(drawing, 'RG').map(() => [0, 0, 0]))
    }
  })

  it('fills every chart bead with paper, a tint or black, its letter black, or white on black', () => {
    const project = fixtureProject({ technique: 'loom', columns: 20, rows: 20 })
    const words = wordsOf(project)
    const layout = pageOneLayout(project, words)
    const { drawing } = drawPageOne(project, words, layout, layout.plan)
    const fills = drawingColors(drawing!, 'rg').map(([level]) => level!)

    expect(fills.length).toBeGreaterThan(0)
    expect(fills.every((level) => TONES.includes(level))).toBe(true)
    // Letters are set after a fill of their own color: black, or white on a solid black bead.
    const letterFills = [...drawing!.matchAll(/^([\d.]+) [\d.]+ [\d.]+ rg\n(?:BT|.*Tf)/gm)].map((match) => Number(match[1]))
    expect(letterFills.every((level) => level === 0 || level === 1)).toBe(true)
  })

  it('keeps a solid black bead apart from its neighbours by paper', () => {
    const black = Array.from({ length: 4 }, (_, index) => ({ row: 8 + Math.floor(index / 2), column: 8 + (index % 2), color: '#000000' }))
    const white = Array.from({ length: 400 }, (_, index) => ({ row: Math.floor(index / 20), column: index % 20, color: '#ffffff' }))
    const project = fixtureProject({ technique: 'loom', columns: 20, rows: 20, override: [...white.filter((cell) => !black.some((b) => b.row === cell.row && b.column === cell.column)), ...black] })
    const words = wordsOf(project)
    const layout = pageOneLayout(project, words)
    const { drawing } = drawPageOne(project, words, layout, layout.plan)
    const rects = (level: string) => [...drawing!.matchAll(new RegExp(`^${level} ${level} ${level} rg\\n((?:[\\d.-]+ [\\d.-]+ [\\d.]+ [\\d.]+ re f\\n)+)`, 'gm'))].flatMap((match) => [...match[1]!.matchAll(/[\d.-]+ [\d.-]+ ([\d.]+) [\d.]+ re f/g)].map((rect) => Number(rect[1])))

    const solid = rects('0')
    const paper = rects('1')
    expect(solid).toHaveLength(4)
    expect(paper.length).toBeGreaterThan(300)
    for (const width of solid) expect(width).toBeCloseTo(paper[0]! - mmPt(0.2), 2)
  })

  it('leaves the chart in color with the switch off', () => {
    const project = fixtureProject({ technique: 'loom', columns: 20, rows: 20 })
    const words = wordsOf(project, {})
    const layout = pageOneLayout(project, words)

    expect(drawingColors(drawPageOne(project, words, layout, layout.plan).drawing!, 'rg').some(([r, g, b]) => r !== g || g !== b)).toBe(true)
  })

  it('keeps the Cover page in color', () => {
    const project = fixtureProject({ technique: 'loom', columns: 20, rows: 20 })

    expect(coloredPixels(drawCoverPage(project, wordsOf(project, { cover: true, blackAndWhite: true }), A4_PORTRAIT, 1, 2))).toBeGreaterThan(1000)
  })
})
