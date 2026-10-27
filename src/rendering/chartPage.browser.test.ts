import { describe, expect, it } from 'vitest'
import { fixtureProject } from '../../e2e/support/projects'
import { en } from '../i18n/en'
import { drawChartPage } from './chartPage'
import { planWithKey } from './chartPageKey'
import { loadPrintFonts } from './printPages'
import { printText } from './printText'
import { exportProjectPdf } from './projectExport'

// A chart page drawn for real (ticket 0585, ADR 0043): lines and letters as PDF drawing over a picture of its text alone.
describe('chart pages of the PDF', () => {
  it('is a text picture at the page size with the drawing beside it', async () => {
    await loadPrintFonts()
    const project = fixtureProject({ technique: 'loom', columns: 100, rows: 100 })
    const plan = planWithKey(project)
    const page = drawChartPage(project, printText(project, en, 'en', new Date()), plan, [plan.parts[0]!], 2)

    expect([page.canvas.width, page.canvas.height]).toEqual([plan.page.width * 2, plan.page.height * 2])
    expect(page.drawing).toContain('/F2 6.5 Tf')
  })

  it('writes every chart page with one picture, its text, and the letters and lines as drawing, tens of kB each', async () => {
    const project = fixtureProject({ technique: 'loom', columns: 100, rows: 100 })
    const pdf = await exportProjectPdf(project, printText(project, en, 'en', new Date()), 150)
    const bytes = new TextDecoder('latin1').decode(await pdf.arrayBuffer())
    const plan = planWithKey(project)
    const chartPages = new Set(plan.parts.map((part) => part.page)).size

    // One picture on every page: the Cover, the chart pages and the Specification.
    const pages = (bytes.match(/\/Type \/Page /g) ?? []).length
    expect((bytes.match(/\/Subtype \/Image/g) ?? []).length).toBe(pages)
    expect((bytes.match(/\/Filter \/FlateDecode \/Length \d+ >>\nstream/g) ?? []).length).toBe(chartPages)
    expect(bytes).toContain('/BaseFont /Helvetica-Bold')
    expect(bytes).not.toContain('/FontFile')
    // The chart pages' drawing and picture are small beside a picture of the chart (a megabyte a page).
    const drawings = [...bytes.matchAll(/\/Filter \/FlateDecode \/Length (\d+) >>\nstream/g)].map((match) => Number(match[1]))
    expect(Math.max(...drawings)).toBeLessThan(150_000)
  }, 120_000)
})
