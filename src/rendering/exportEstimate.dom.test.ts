import { describe, expect, it } from 'vitest'
import { fixtureProject } from '../../e2e/support/projects'
import { en } from '../i18n/en'
import { estimatePdf, estimatePng, exportFacts, type ExportFacts } from './exportEstimate'
import { printText } from './printText'
import type { Technique } from '../domain/weave'
import { withLayers } from '../testUtils/layerFields'

const factsOf = (technique: Technique, columns: number, rows: number, letters = false): ExportFacts => {
  const project = withLayers(fixtureProject({ technique, columns, rows }), { letters })
  return exportFacts(project, printText(project, en, 'en', new Date()))!
}

describe('exportFacts', () => {
  it('has none for a Project with no Frame', () => {
    const project = withLayers(fixtureProject({ technique: 'loom' }), { frame: undefined })
    expect(exportFacts(project, printText(project, en, 'en', new Date()))).toBeUndefined()
  })

  it('counts the Cover and a chart page for a small Schema, and the Word chart only with Letters', () => {
    expect(factsOf('loom', 20, 30)).toMatchObject({ lists: [], sheets: 1, wordPages: 0 })
    expect(factsOf('loom', 20, 30, true)).toMatchObject({ lists: [], sheets: 1, wordPages: 1 })
  })

  it('crosses the empty positions of the PDF Cover only when its beads carry no letters (ticket 0719)', () => {
    const project = withLayers(fixtureProject({ technique: 'loom', columns: 20, rows: 20 }), { letters: true, paletteLetters: { '#ff0000': 'R' } })
    const facts = (letters: boolean) => {
      const shown = withLayers(project, { letters })
      return exportFacts(shown, printText(shown, en, 'en', new Date()))!.pdfCrosses
    }
    expect([facts(false), facts(true)]).toEqual([true, false])
  })

  it('counts a chart page for every sheet a big Schema takes', () => {
    // 100 × 100 takes three sheets where 20 × 20 takes one (ticket 0585).
    expect(factsOf('loom', 100, 100).sheets).toBe(3)
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

  it('grows with the beads on the Cover', () => {
    expect(estimatePng({ ...facts, filled: facts.filled * 2, edges: facts.edges * 2 }, 300).bytes).toBeGreaterThan(estimatePng(facts, 300).bytes)
  })
})

describe('estimatePdf', () => {
  it('counts every page: the Cover, list pages, chart pages, the Specification and the Word chart pages', () => {
    const plain = factsOf('loom', 100, 100)
    expect(estimatePdf(plain, 300).count).toBe(1 + 0 + 3 + 1 + 0)
    expect(estimatePdf({ ...plain, lists: [20], wordPages: 2 }, 300).count).toBe(1 + 1 + 3 + 1 + 2)
  })

  it('adds a chart page as drawing and its text, far smaller than a picture page (ticket 0585)', () => {
    const one = factsOf('loom', 20, 20)
    const three = factsOf('loom', 100, 100)
    expect(estimatePdf(three, 300).bytes - estimatePdf(one, 300).bytes).toBeGreaterThan(2 * 90_000)
  })

  it('weighs the Word chart pages Letters add', () => {
    const without = factsOf('loom', 20, 30)
    const withLetters = factsOf('loom', 20, 30, true)
    expect(estimatePdf(withLetters, 300).bytes).toBeGreaterThan(estimatePdf(without, 300).bytes)
  })

  it('is smaller where the pictures are drawn at 150 dpi', () => {
    const facts = factsOf('loom', 40, 60, true)
    expect(estimatePdf(facts, 150).bytes).toBeLessThan(estimatePdf(facts, 300).bytes)
  })
})
