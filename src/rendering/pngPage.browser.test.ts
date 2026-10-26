import { beforeAll, describe, expect, it } from 'vitest'
import { fixtureProject } from '../../e2e/support/projects'
import { en } from '../i18n/en'
import { PNG_STORY_LEFT, pngLayout } from './pngPage'
import { font, loadPrintFonts, MONO, SERIF } from './printPages'
import { printText } from './printText'
import { exportProjectPng, PNG_MARGIN_PX, PNG_MAX_WIDTH, pngZoom } from './projectExport'
import { displayedExtentPx } from './surfaceView'
import { frameWeave } from '../domain/project'
import { be } from '../i18n/be'
import { es } from '../i18n/es'
import { pl } from '../i18n/pl'
import { ru } from '../i18n/ru'
import { uk } from '../i18n/uk'
import { zh } from '../i18n/zh'
import type { Locale, Translations } from '../i18n/translations'

const chartOf = (columns: number, rows: number) => {
  const project = fixtureProject({ technique: 'loom', columns, rows })
  const zoom = pngZoom(project)
  const { width, height } = displayedExtentPx('loom', columns, rows, zoom, project.rotation, frameWeave(project).cell)
  return { project, chart: { width: Math.ceil(width) + PNG_MARGIN_PX * 2, height: Math.ceil(height) + PNG_MARGIN_PX * 2 } }
}

// One portrait picture (ticket 0582): the story always sits under the chart, whatever the Schema's shape.
describe('pngLayout (PngExport card)', () => {
  beforeAll(loadPrintFonts)

  it.each([['square', 60, 60], ['tall', 30, 120], ['wide', 120, 30]])('puts the story under the chart of a %s Schema', (_shape, columns, rows) => {
    const { project, chart } = chartOf(columns, rows)
    const layout = pngLayout(chart, printText(project, en, 'en', new Date()))

    expect(layout.storyY).toBeGreaterThanOrEqual(chart.height)
    expect(layout.height).toBeGreaterThan(layout.storyY)
  })

  it('keeps a Schema wider than the story at full width, flush left', () => {
    const { project, chart } = chartOf(120, 30)
    const layout = pngLayout(chart, printText(project, en, 'en', new Date()))

    expect(layout.width).toBe(chart.width)
    expect(layout.chartX).toBe(0)
  })

  it('centres a small Schema on a board wide enough for the story', () => {
    const { project, chart } = chartOf(8, 8)
    const layout = pngLayout(chart, printText(project, en, 'en', new Date()))

    expect(layout.width).toBeGreaterThan(chart.width)
    expect(layout.chartX).toBe(Math.floor((layout.width - chart.width) / 2))
  })

  it.each([['widest', 1000, 4], ['very wide', 600, 40]])('stays within the canvas width limit for a %s Schema', (_shape, columns, rows) => {
    const { project, chart } = chartOf(columns, rows)
    const layout = pngLayout(chart, printText(project, en, 'en', new Date()))

    expect(layout.width).toBeLessThanOrEqual(PNG_MAX_WIDTH)
  })
})

// The picture's own size is in its header (IHDR: width at byte 16, height at byte 20, big-endian).
describe('exportProjectPng with a centred chart (PngExport card)', () => {
  beforeAll(loadPrintFonts)

  it('is as wide and as tall as the layout says for a small Schema', async () => {
    const { project, chart } = chartOf(8, 8)
    const layout = pngLayout(chart, printText(project, en, 'en', new Date()))
    const header = new DataView(await (await exportProjectPng(project, printText(project, en, 'en', new Date()))).slice(0, 24).arrayBuffer())

    expect(layout.chartX).toBeGreaterThan(0)
    expect([header.getUint32(16), header.getUint32(20)]).toEqual([layout.width, layout.height])
  })
})

describe('the PNG story fits its room (PngExport card)', () => {
  beforeAll(loadPrintFonts)

  it.each<[Locale, Translations]>([['en', en], ['ru', ru], ['uk', uk], ['be', be], ['zh', zh], ['es', es], ['pl', pl]])('fits the size line and the maker in the left block in %s', async (locale, messages) => {
    const project = { ...fixtureProject({ technique: 'loom', columns: 130, rows: 60 }), maker: 'Anna Kowalska' }
    const words = printText(project, messages, locale, new Date())
    const context = document.createElement('canvas').getContext('2d')!
    context.font = font('400', 7.5, MONO)
    expect(context.measureText(words.metaLine).width, words.metaLine).toBeLessThanOrEqual(PNG_STORY_LEFT)
    context.font = font('italic 400', 9, SERIF)
    const byMaker = words.labels.byMaker.replace('{maker}', words.maker)
    expect(context.measureText(byMaker).width, byMaker).toBeLessThanOrEqual(PNG_STORY_LEFT)
  })
})
