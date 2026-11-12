import { describe, expect, it } from 'vitest'
import { fixtureProject } from '../../e2e/support/projects'
import { en } from '../i18n/en'
import { estimatePdf, estimatePng, exportFacts, type ExportFacts } from './exportEstimate'
import { printText, type PrintChoices } from './printText'
import type { Technique } from '../domain/weave'
import { withLayers } from '../testUtils/layerFields'

const factsOf = (technique: Technique, columns: number, rows: number, choices: PrintChoices = {}, letters = false): ExportFacts => {
  const project = withLayers(fixtureProject({ technique, columns, rows }), { letters })
  return exportFacts(project, printText(project, en, 'en', new Date(), choices))!
}
const ROW_BY_ROW = { rowByRow: true }

describe('exportFacts', () => {
  it('has none for a Project with no Frame', () => {
    const project = withLayers(fixtureProject({ technique: 'loom' }), { frame: undefined })
    expect(exportFacts(project, printText(project, en, 'en', new Date()))).toBeUndefined()
  })

  it('counts page 1 alone for a small Schema, its chart there (ticket 0914)', () => {
    expect(factsOf('loom', 20, 30)).toMatchObject({ lists: [], sheets: 0, wordPages: 0, pdfPages: 1 })
    expect(factsOf('loom', 20, 30).overviewZoom).toBeUndefined()
  })

  it('counts the Word chart pages with Row by row on, whatever Letters says, and none with it off (ticket 0916)', () => {
    expect(factsOf('loom', 20, 30, ROW_BY_ROW)).toMatchObject({ wordPages: 1, pdfPages: 2 })
    expect(factsOf('loom', 20, 30, ROW_BY_ROW, true)).toMatchObject({ wordPages: 1, pdfPages: 2 })
    expect(factsOf('loom', 20, 30, {}, true)).toMatchObject({ wordPages: 0, pdfPages: 1 })
  })

  it('counts the chart pages Large beads adds (ticket 0916)', () => {
    const large = factsOf('loom', 100, 100, { largeBeads: true })
    expect(large.sheets).toBeGreaterThan(1)
    expect(large.pdfPages).toBe(1 + large.sheets)
  })

  it('counts a chart page for every sheet a big Schema takes after its overview', () => {
    // 150 × 150 takes four sheets where 100 × 100 is whole on page 1 (tickets 0585, 0913, 0914).
    expect(factsOf('loom', 100, 100).sheets).toBe(0)
    expect(factsOf('loom', 150, 150).sheets).toBe(4)
    expect(factsOf('loom', 150, 150).overviewZoom).toBeGreaterThan(0)
  })
})

describe('estimatePng (QualitySlider card)', () => {
  // Against real files: exportEstimate.browser.test.ts.
  const facts = factsOf('loom', 40, 60)

  it('is one file, and grows with the dpi', () => {
    expect(estimatePng(facts, 300).count).toBe(1)
    expect(estimatePng(facts, 300).bytes).toBeGreaterThan(estimatePng(facts, 150).bytes)
    expect(estimatePng(facts, 450).bytes).toBeGreaterThan(estimatePng(facts, 300).bytes)
  })

  it('adds a file and its bytes for every list page', () => {
    const over = estimatePng({ ...facts, lists: [30, 12] }, 300)
    expect(over.count).toBe(3)
    expect(over.bytes).toBeGreaterThan(estimatePng(facts, 300).bytes)
  })

  it('grows with the beads on page 1', () => {
    expect(estimatePng({ ...facts, filled: facts.filled * 2, edges: facts.edges * 2 }, 300).bytes).toBeGreaterThan(estimatePng(facts, 300).bytes)
  })
})

describe('estimatePdf', () => {
  it('counts every page: page 1, its list pages, the chart pages and the Word chart pages', () => {
    expect(estimatePdf(factsOf('loom', 150, 150), 300).count).toBe(1 + 0 + 4 + 0)
    const rows = factsOf('loom', 150, 150, ROW_BY_ROW)
    expect(rows.wordPages).toBeGreaterThan(0)
    expect(estimatePdf(rows, 300).count).toBe(1 + 0 + 4 + rows.wordPages)
  })

  it('adds a chart page as drawing and its text, far smaller than a picture page (ticket 0585)', () => {
    const one = factsOf('loom', 20, 20)
    const four = factsOf('loom', 150, 150)
    expect(estimatePdf(four, 300).bytes - estimatePdf(one, 300).bytes).toBeGreaterThan(3 * 90_000)
  })

  it('weighs the Word chart pages Row by row adds (ticket 0916)', () => {
    expect(estimatePdf(factsOf('loom', 20, 30, ROW_BY_ROW), 300).bytes).toBeGreaterThan(estimatePdf(factsOf('loom', 20, 30), 300).bytes)
  })

  it('is smaller where the pictures are drawn at 150 dpi', () => {
    const facts = factsOf('loom', 40, 60, ROW_BY_ROW)
    expect(estimatePdf(facts, 150).bytes).toBeLessThan(estimatePdf(facts, 300).bytes)
  })
})
