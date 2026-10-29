import { describe, expect, it } from 'vitest'
import { fixtureProject } from '../../e2e/support/projects'
import { BUILT_IN_COLORS } from '../domain/palette'
import { PNG_DPI_BY_QUALITY, PDF_PAGE_DPI } from '../domain/exportQuality'
import { framedGrid } from '../domain/layerBeads'
import type { Cell, Project } from '../domain/project'
import { en } from '../i18n/en'
import { estimatePdf, estimatePng, exportFacts } from './exportEstimate'
import { printText } from './printText'
import { exportProjectPdf, exportProjectPng, projectPageCount } from './projectExport'
import { withLayers } from '../testUtils/layerFields'

// The size each export shows against the real files (ticket 0588, ADR 0076): never less than the file and under about twice
// it, for a small drawing, a long narrow one, a big symmetric one, a photograph, a conversion in many colors and a Schema
// with a large empty background, with Letters off and on, at every Export quality.

const COLORS = BUILT_IN_COLORS.map((color) => color.hex)

function drawn(name: string, columns: number, rows: number, color: (row: number, column: number) => number | null, palette = COLORS): Project {
  const grid: Cell[][] = Array.from({ length: rows }, (_row, row) =>
    Array.from({ length: columns }, (_cell, column) => {
      const index = color(row, column)
      return { color: index === null ? null : palette[index % palette.length]! }
    }),
  )
  return withLayers(fixtureProject({ technique: 'loom', columns, rows }), { name, ...framedGrid(grid, { technique: 'loom' }) })
}

/** The same noise every run. */
function noise(): () => number {
  let state = 7
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296
    return state / 4_294_967_296
  }
}

const CORPUS: [string, () => Project][] = [
  ['a 20 × 20 heart', () => drawn('Heart', 20, 20, (row, column) => ((column - 9.5) ** 2 + (row - 8) ** 2 < 60 ? 3 : null))],
  ['a 35 × 120 zig-zag', () => drawn('Zig-zag', 35, 120, (row, column) => ((Math.abs((row % 20) - 10) + column) % 7 < 3 ? (row >> 3) % 6 : null))],
  ['a 100 × 100 mandala', () => drawn('Mandala', 100, 100, (row, column) => Math.floor(Math.hypot(row - 50, column - 50) / 3 + Math.abs(Math.atan2(row - 50, column - 50)) * 2) % 12)],
  [
    'a dense photo conversion',
    () => {
      const random = noise()
      return drawn('Photo', 120, 150, () => Math.floor(random() * COLORS.length))
    },
  ],
  [
    'a conversion in 90 colors',
    () => {
      const random = noise()
      const palette = Array.from({ length: 90 }, () => `#${Math.floor(random() * 0xffffff).toString(16).padStart(6, '0')}`)
      return drawn('Conversion', 80, 80, () => Math.floor(random() * palette.length), palette)
    },
  ],
  ['a Schema with a large empty background', () => drawn('Background', 60, 80, (row, column) => (row > 70 && column > 50 ? 4 : null))],
]

/** The pages the PDF says it has. */
async function pdfPages(blob: Blob): Promise<number> {
  return Number(/\/Count (\d+)/.exec(await blob.text())?.[1])
}

describe('the File size estimate against real exports (QualitySlider card, ADR 0076)', () => {
  it.each(CORPUS)('is never less than the file and under 2.2 × it for %s', async (_name, make) => {
    const off: string[] = []
    const check = (what: string, estimate: number, real: number) => {
      if (estimate < real || estimate > real * 2.2) off.push(`${what}: estimate ${estimate} B is ${(estimate / real).toFixed(2)} × the ${real} B file`)
    }
    for (const letters of [false, true]) {
      const project = withLayers(make(), { letters })
      const words = printText(project, en, 'en', new Date())
      const facts = exportFacts(project, words)!
      for (const [quality, dpi] of Object.entries(PNG_DPI_BY_QUALITY)) {
        const estimate = estimatePng(facts, dpi)
        expect(estimate.count).toBe(projectPageCount(project, words))
        let real = 0
        for (let page = 0; page < estimate.count; page += 1) real += (await exportProjectPng(project, words, dpi, page)).size
        check(`PNG at ${quality}, Letters ${letters}`, estimate.bytes, real)
      }
      const pdf = await exportProjectPdf(project, words, PDF_PAGE_DPI)
      const estimate = estimatePdf(facts, PDF_PAGE_DPI)
      expect(estimate.count).toBe(await pdfPages(pdf))
      check(`PDF, Letters ${letters}`, estimate.bytes, pdf.size)
    }
    expect(off).toEqual([])
  }, 300_000)
})
