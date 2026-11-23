import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ExportPanel from './ExportPanel.vue'
import { createProject } from '../../domain/createProject'
import { withColors } from '../../domain/canvas'
import type { Project } from '../../domain/project'
import { en } from '../../i18n/en'
import { PNG_DPI_BY_QUALITY, type ExportQuality } from '../../domain/exportQuality'
import { withFrameSheet } from '../../domain/frameSheet'
import { withLayers } from '../../testUtils/layerFields'
import { withProjectName } from '../../domain/projectName'
import { frameOf } from '../../domain/layerRecord'
import type { Selection } from '../../domain/selection'

vi.mock('../../rendering/exportDpi', () => ({ pngDpiFor: vi.fn((quality: ExportQuality) => PNG_DPI_BY_QUALITY[quality]), pdfPageDpi: vi.fn(() => 300) }))

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

afterEach(() => {
  document.body.innerHTML = ''
})

/** A Project made with a size has a Frame; these start with none. */
function empty(): Project {
  const unframed = withFrameSheet(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 10, height: 10, unit: 'beads' } }), undefined)
  return unframed
}
const drawn = (): Project => (withLayers(empty(), { beads: withColors({}, [{ row: 1, column: 1, color: '#ff0000' }]) }))
const framed = (): Project => (withLayers(empty(), { frame: { row: 2, column: 3, rows: 6, columns: 5, technique: 'loom', beads: {} } }))
/** A Frame with a Frame shape: a Custom frame. */
const custom = (): Project => withLayers(empty(), { frame: { row: 2, column: 3, rows: 6, columns: 5, technique: 'loom', shape: 'triangle', beads: {} } })
/** A Frame big enough that its chart prints under 3 mm, so Large beads shows (ticket 1125). */
const big = (): Project => withLayers(empty(), { frame: { row: 0, column: 0, rows: 100, columns: 100, technique: 'loom', beads: {} } })

/** The panel with its File size estimates there: the print code they are worked out with comes after (ticket 0991). */
async function mountPanel(project: Project, { settingsOpen = true }: { settingsOpen?: boolean } = {}) {
  // The settings are folded until opened (ticket 1210); the rows' tests read them, so they start open.
  if (settingsOpen) localStorage.setItem('openbeads:panel-sections-opened', 'export:settings')
  const wrapper = mount(ExportPanel, { props: { project }, attachTo: document.body })
  await vi.dynamicImportSettled()
  await flushPromises()
  return wrapper
}
type Panel = Awaited<ReturnType<typeof mountPanel>>
const has = (wrapper: Panel, testId: string) => wrapper.find(`[data-testid="${testId}"]`).exists()
/** The ways to a Frame, in the panel's order. */
const rows = (wrapper: Panel) => wrapper.findAll('[data-testid="export-fit"], [data-testid="export-select-frame"], [data-testid="export-select-piece-frame"]').map((row) => row.attributes('data-testid'))

describe('ExportPanel (ticket 0652)', () => {
  it('names the open Project on the title line, with or without a Frame (ticket 0986)', async () => {
    for (const project of [framed(), empty()]) {
      const wrapper = await mountPanel(withProjectName(project, 'Loom cuff'))
      expect(wrapper.get('.export-panel__title [data-testid="export-panel-project"]').text()).toBe('· Loom cuff')
    }
  })

  it('holds the PNG and PDF buttons in one row with a Frame, each naming its file and size, and passes each export on (ticket 1121)', async () => {
    const wrapper = await mountPanel(framed())
    const png = wrapper.get('[data-testid="export-files"] [data-testid="export-png"]')
    const pdf = wrapper.get('[data-testid="export-files"] [data-testid="export-pdf"]')

    expect([png.text(), pdf.text()]).toEqual(['PNG', 'PDF'])
    expect(png.attributes('aria-label')).toMatch(/^Picture, PNG (≈ \d+\.\d MB|< 0\.1 MB) · 1 file$/)
    expect(pdf.attributes('aria-label')).toMatch(/^Printable chart, PDF (≈ \d+\.\d MB|< 0\.1 MB) · \d+ pages?$/)
    expect(['export-needs-frame', 'export-select-frame', 'export-fit', 'frame-letters'].filter((id) => has(wrapper, id))).toEqual([])

    await png.trigger('click')
    await pdf.trigger('click')
    expect(wrapper.emitted('export-png')).toHaveLength(1)
    expect(wrapper.emitted('export-pdf')).toHaveLength(1)
  })

  it('has a File button after PNG and PDF, in their row, that saves the Project file and says what it holds (ticket 1121)', async () => {
    const wrapper = await mountPanel(framed())
    const file = wrapper.get('[data-testid="export-files"] [data-testid="export-project-file"]')

    expect(file.text()).toBe(en.frame.exportProjectFile)
    expect(file.attributes('aria-label')).toBe(`${en.panels.project.saveFile}, ${en.frame.exportProjectFileBody}`)
    await file.trigger('click')
    expect(wrapper.emitted('save-project-file')).toHaveLength(1)
  })

  it('puts Saves as right under the buttons, then Name on exports, then Export quality and the switches (tickets 1121, 1210)', async () => {
    const wrapper = await mountPanel(big())
    const ids = ['export-png', 'export-pdf', 'export-project-file', 'export-file-name', 'export-maker-name-row', 'quality-slider', 'export-cover-page', 'export-black-and-white', 'export-empty-grid', 'export-chart-border', 'export-large-beads', 'export-row-by-row']
    const order = wrapper.findAll('[data-testid]').map((part) => part.attributes('data-testid')).filter((id) => ids.includes(id!))

    expect(order).toEqual(ids)
  })

  it('folds Export settings at first, with the quality and every switch under it, and keeps it open once opened (ticket 1210)', async () => {
    const wrapper = await mountPanel(framed(), { settingsOpen: false })
    const fold = () => wrapper.get('[aria-controls]')

    expect(wrapper.text()).toContain(en.frame.exportSettings)
    expect(fold().attributes('aria-expanded')).toBe('false')
    expect(['quality-slider', 'export-cover-page', 'export-row-by-row'].filter((id) => has(wrapper, id))).toEqual([])
    expect(['export-png', 'export-file-name', 'export-maker-name-row'].filter((id) => has(wrapper, id))).toHaveLength(3)
    await fold().trigger('click')
    expect(['quality-slider', 'export-cover-page', 'export-row-by-row'].filter((id) => has(wrapper, id))).toHaveLength(3)

    wrapper.unmount()
    const again = await mountPanel(framed(), { settingsOpen: false })
    expect(again.get('[aria-controls]').attributes('aria-expanded')).toBe('true')
  })

  it('has Name on exports under Saves as, saving the maker name as typed (ticket 1210)', async () => {
    const wrapper = await mountPanel({ ...framed(), makerName: 'Ada Lind' })
    expect(wrapper.get('[data-testid="export-maker-name"]').text()).toBe('Ada Lind')
    expect(wrapper.get('[data-testid="export-maker-name-row"]').text()).toContain(en.frame.nameOnExports)
    await wrapper.get('[data-testid="export-maker-name-edit"]').trigger('click')
    await wrapper.get('[data-testid="export-maker-name-input"]').setValue(' Bo ')
    await wrapper.get('[data-testid="export-maker-name-form"]').trigger('submit')
    expect(wrapper.emitted('save-maker-name')).toEqual([['Bo']])
  })

  it('says to set a frame with none, offers Fit first with the Frame icon, then Drag a Frame, and shows no export rows (ticket 0944)', async () => {
    const wrapper = await mountPanel(drawn())

    expect(wrapper.get('[data-testid="export-needs-frame"]').text()).toBe(en.frame.exportNeedsFrame)
    expect(['export-png', 'export-pdf', 'quality-range'].filter((id) => has(wrapper, id))).toEqual([])
    expect(rows(wrapper)).toEqual(['export-fit', 'export-select-frame', 'export-select-piece-frame'])
    expect(wrapper.get('[data-testid="export-fit"] [data-icon]').attributes('data-icon')).toBe('frame')
    expect(wrapper.get('[data-testid="export-select-frame"]').text()).toBe(en.frame.selectAFrame)

    await wrapper.get('[data-testid="export-select-frame"]').trigger('click')
    await wrapper.get('[data-testid="export-select-piece-frame"]').trigger('click')
    await wrapper.get('[data-testid="export-fit"]').trigger('click')
    expect(wrapper.emitted('select-frame')).toHaveLength(1)
    expect(wrapper.emitted('select-piece-frame')).toHaveLength(1)
    expect(wrapper.emitted('fit')).toHaveLength(1)
  })

  it('offers File with no Frame too, after the ways to a Frame, and it saves the Project file (ticket 1133)', async () => {
    const wrapper = await mountPanel(drawn())
    const order = wrapper.findAll('[data-testid]').map((part) => part.attributes('data-testid')).filter((id) => ['export-needs-frame', 'export-fit', 'export-select-frame', 'export-project-file'].includes(id!))

    expect(order).toEqual(['export-needs-frame', 'export-fit', 'export-select-frame', 'export-project-file'])
    await wrapper.get('[data-testid="export-project-file"]').trigger('click')
    expect(wrapper.emitted('save-project-file')).toHaveLength(1)
  })

  it('has Fit off, with its reason, and second while nothing is drawn', async () => {
    const wrapper = await mountPanel(empty())
    const fit = wrapper.get('[data-testid="export-fit"]')

    expect(rows(wrapper)).toEqual(['export-select-frame', 'export-select-piece-frame', 'export-fit'])

    expect(fit.attributes('aria-disabled')).toBe('true')
    await fit.trigger('click')
    expect(wrapper.emitted('fit')).toBeUndefined()
  })
})

describe('ExportPanel print choices (tickets 0916, 1096)', () => {
  const pages = (wrapper: Panel) => /· (\d+) pages?$/.exec(wrapper.get('[data-testid="export-pdf"]').attributes('aria-label') ?? '')?.[1]

  it('offers Cover page on and Black and white, Large beads and Row by row off, each with what it does behind its Info button', async () => {
    const wrapper = await mountPanel(big())
    const switches = [['export-cover-page', en.frame.coverPageInfoLabel, 'true'], ['export-black-and-white', en.frame.blackAndWhiteInfoLabel, 'false'], ['export-large-beads', en.frame.largeBeadsInfoLabel, 'false'], ['export-row-by-row', en.frame.rowByRowInfoLabel, 'false']] as const

    for (const [id, label, on] of switches) {
      expect(wrapper.get(`[data-testid="${id}"]`).attributes('aria-checked')).toBe(on)
      expect(wrapper.get(`[data-testid="${id}-info"]`).attributes('aria-label')).toBe(label)
    }
  })

  it('counts the PDF\'s pages on the Printable chart row, following each switch at once', async () => {
    const wrapper = await mountPanel(big())
    expect(pages(wrapper)).toBe('2')
    await wrapper.get('[data-testid="export-cover-page"]').trigger('click')
    expect(pages(wrapper)).toBe('1')

    await wrapper.get('[data-testid="export-large-beads"]').trigger('click')
    const large = Number(pages(wrapper))
    expect(large).toBeGreaterThan(2)

    await wrapper.get('[data-testid="export-row-by-row"]').trigger('click')
    expect(Number(pages(wrapper))).toBeGreaterThan(large)
  })

  it('remembers every switch on the device', async () => {
    const wrapper = await mountPanel(big())
    await wrapper.get('[data-testid="export-cover-page"]').trigger('click')
    await wrapper.get('[data-testid="export-black-and-white"]').trigger('click')
    await wrapper.get('[data-testid="export-large-beads"]').trigger('click')
    await wrapper.get('[data-testid="export-row-by-row"]').trigger('click')
    expect(['cover', 'black-and-white', 'large-beads', 'row-by-row'].map((key) => localStorage.getItem(`openbeads:print-${key}`))).toEqual(['off', 'on', 'on', 'on'])
    wrapper.unmount()

    const again = await mountPanel(big())
    expect(again.get('[data-testid="export-cover-page"]').attributes('aria-checked')).toBe('false')
    expect(again.get('[data-testid="export-black-and-white"]').attributes('aria-checked')).toBe('true')
    expect(again.get('[data-testid="export-large-beads"]').attributes('aria-checked')).toBe('true')
    expect(again.get('[data-testid="export-row-by-row"]').attributes('aria-checked')).toBe('true')
  })
})

describe('ExportPanel Empty grid and Chart border (ticket 1127)', () => {
  const pages = (wrapper: Panel) => /· (\d+) pages?$/.exec(wrapper.get('[data-testid="export-pdf"]').attributes('aria-label') ?? '')?.[1]

  it('puts Empty grid, then Chart border, after Cover page and Black and white, and before Large beads', async () => {
    const wrapper = await mountPanel(big())
    const ids = ['export-cover-page', 'export-black-and-white', 'export-empty-grid', 'export-chart-border', 'export-large-beads', 'export-row-by-row']
    const order = wrapper.findAll('[data-testid]').map((part) => part.attributes('data-testid')).filter((id) => ids.includes(id!))

    expect(order).toEqual(ids)
  })

  it('offers Empty grid off and Chart border on, each with what it does behind its Info button', async () => {
    const wrapper = await mountPanel(framed())
    const switches = [['export-empty-grid', en.frame.emptyGridInfoLabel, 'false'], ['export-chart-border', en.frame.chartBorderInfoLabel, 'true']] as const

    for (const [id, label, on] of switches) {
      expect(wrapper.get(`[data-testid="${id}"]`).attributes('aria-checked')).toBe(on)
      expect(wrapper.get(`[data-testid="${id}-info"]`).attributes('aria-label')).toBe(label)
    }
  })

  it('adds or removes no page, and remembers both on the device', async () => {
    const wrapper = await mountPanel(big())
    const before = pages(wrapper)
    await wrapper.get('[data-testid="export-empty-grid"]').trigger('click')
    await wrapper.get('[data-testid="export-chart-border"]').trigger('click')
    expect(pages(wrapper)).toBe(before)
    expect(['empty-grid', 'chart-border'].map((key) => localStorage.getItem(`openbeads:print-${key}`))).toEqual(['on', 'off'])
    wrapper.unmount()

    const again = await mountPanel(big())
    expect(again.get('[data-testid="export-empty-grid"]').attributes('aria-checked')).toBe('true')
    expect(again.get('[data-testid="export-chart-border"]').attributes('aria-checked')).toBe('false')
  })

  it('names each in the PDF\'s file name while it is on, after Cover page\'s word and in the panel\'s order', async () => {
    const wrapper = await mountPanel({ ...withProjectName(big(), 'Peacock cuff'), makerName: 'Ada Lind' })
    const fileName = () => wrapper.get('[data-testid="export-file-name"]').text()
    await wrapper.get('[data-testid="export-empty-grid"]').trigger('click')
    expect(fileName()).toBe('peacock-cuff-ada-lind_cover_empty-grid_chart-border.pdf')
    await wrapper.get('[data-testid="export-chart-border"]').trigger('click')
    expect(fileName()).toBe('peacock-cuff-ada-lind_cover_empty-grid.pdf')
  })
})

describe('ExportPanel Row by row direction', () => {
  const ways = (wrapper: Panel) => wrapper.findAll('[data-testid^="export-row-by-row-way-"]').map((chip) => chip.attributes('data-testid')!.replace('export-row-by-row-way-', ''))

  it('shows the way the rows run only with Row by row on, as Row progress by default and each of the four ways beside it', async () => {
    const wrapper = await mountPanel(framed())
    expect(has(wrapper, 'export-row-by-row-way')).toBe(false)

    await wrapper.get('[data-testid="export-row-by-row"]').trigger('click')
    expect(ways(wrapper)).toEqual(['progress', 'down', 'right', 'up', 'left'])
    expect(wrapper.get('[data-testid="export-row-by-row-way-progress"]').attributes('aria-checked')).toBe('true')

    await wrapper.get('[data-testid="export-row-by-row"]').trigger('click')
    expect(has(wrapper, 'export-row-by-row-way')).toBe(false)
  })

  it('remembers the way chosen on the device, and Row progress again clears it', async () => {
    const wrapper = await mountPanel(framed())
    await wrapper.get('[data-testid="export-row-by-row"]').trigger('click')

    await wrapper.get('[data-testid="export-row-by-row-way-up"]').trigger('click')
    expect(localStorage.getItem('openbeads:print-row-by-row-way')).toBe('up')
    expect(wrapper.get('[data-testid="export-row-by-row-way-up"]').attributes('aria-checked')).toBe('true')

    await wrapper.get('[data-testid="export-row-by-row-way-progress"]').trigger('click')
    expect(localStorage.getItem('openbeads:print-row-by-row-way')).toBeNull()
  })
})

describe('ExportPanel Large beads only where it acts (ticket 1125)', () => {
  it('leaves Large beads out for a piece that already prints at 3 mm or more, Row by row still there', async () => {
    const wrapper = await mountPanel(framed())

    expect(has(wrapper, 'export-large-beads')).toBe(false)
    expect(has(wrapper, 'export-row-by-row')).toBe(true)
  })

  it('keeps a remembered Large beads on, doing nothing and naming nothing, until the piece is big enough', async () => {
    localStorage.setItem('openbeads:print-large-beads', 'on')
    const small = await mountPanel(withProjectName(framed(), 'Charm'))

    // The Cover page (on at first, ticket 1096) and page 1: Large beads adds no page and no word.
    expect(small.get('[data-testid="export-pdf"]').attributes('aria-label')).toMatch(/· 2 pages$/)
    expect(small.get('[data-testid="export-file-name"]').text()).toBe('charm_cover_chart-border.pdf')
    expect(localStorage.getItem('openbeads:print-large-beads')).toBe('on')

    await small.setProps({ project: big() })
    expect(small.get('[data-testid="export-large-beads"]').attributes('aria-checked')).toBe('true')
  })
})

describe('ExportPanel "Saves as" (ticket 1096)', () => {
  const named = (): Project => ({ ...withProjectName(big(), 'Peacock cuff'), makerName: 'Ada Lind' })
  const fileName = (wrapper: Panel) => wrapper.get('[data-testid="export-file-name"]').text()

  async function rename(wrapper: Panel, typed: string) {
    await wrapper.get('[data-testid="export-file-name-edit"]').trigger('click')
    await wrapper.get('[data-testid="export-file-name-input"]').setValue(typed)
    await wrapper.get('[data-testid="export-file-name-form"]').trigger('submit')
  }

  it('names the PDF under the switches, with a word for each switch that is on, at once', async () => {
    const wrapper = await mountPanel(named())
    expect(wrapper.get('[data-testid="export-file-name-row"]').text()).toMatch(/^Saves as/)
    expect(fileName(wrapper)).toBe('peacock-cuff-ada-lind_cover_chart-border.pdf')

    await wrapper.get('[data-testid="export-row-by-row"]').trigger('click')
    expect(fileName(wrapper)).toBe('peacock-cuff-ada-lind_cover_chart-border_row-by-row.pdf')
    await wrapper.get('[data-testid="export-large-beads"]').trigger('click')
    expect(fileName(wrapper)).toBe('peacock-cuff-ada-lind_cover_chart-border_large-beads_row-by-row.pdf')
    await wrapper.get('[data-testid="export-black-and-white"]').trigger('click')
    expect(fileName(wrapper)).toBe('peacock-cuff-ada-lind_cover_black-and-white_chart-border_large-beads_row-by-row.pdf')
    await wrapper.get('[data-testid="export-cover-page"]').trigger('click')
    expect(fileName(wrapper)).toBe('peacock-cuff-ada-lind_black-and-white_chart-border_large-beads_row-by-row.pdf')
  })

  it('takes a typed name, adds no switch’s word to it, and passes it on with the export', async () => {
    const wrapper = await mountPanel(named())
    await rename(wrapper, 'Cuff for Ada')
    expect(fileName(wrapper)).toBe('Cuff for Ada.pdf')

    await wrapper.get('[data-testid="export-large-beads"]').trigger('click')
    expect(fileName(wrapper)).toBe('Cuff for Ada.pdf')
    await wrapper.get('[data-testid="export-pdf"]').trigger('click')
    expect(wrapper.emitted('export-pdf')).toEqual([['Cuff for Ada.pdf']])
  })

  it('brings the made name back for an emptied name, and forgets a typed one once the panel closes', async () => {
    const wrapper = await mountPanel(named())
    await rename(wrapper, 'Cuff for Ada')
    await rename(wrapper, '  ')
    expect(fileName(wrapper)).toBe('peacock-cuff-ada-lind_cover_chart-border.pdf')

    await rename(wrapper, 'Cuff for Ada')
    wrapper.unmount()
    const again = await mountPanel(named())
    expect(fileName(again)).toBe('peacock-cuff-ada-lind_cover_chart-border.pdf')
    await again.get('[data-testid="export-pdf"]').trigger('click')
    expect(again.emitted('export-pdf')).toEqual([[undefined]])
  })

  it('puts the Beta chip on PNG and PDF only while the Frame is a Custom frame, never on File (ticket 1198)', async () => {
    const plain = await mountPanel(framed())
    expect(plain.find('[data-testid="beta-chip"]').exists()).toBe(false)
    plain.unmount()
    const shaped = await mountPanel(custom())
    expect(shaped.find('[data-testid="export-png"] [data-testid="beta-chip"]').exists()).toBe(true)
    expect(shaped.find('[data-testid="export-pdf"] [data-testid="beta-chip"]').exists()).toBe(true)
    expect(shaped.findAll('[data-testid="beta-chip"]')).toHaveLength(2)
  })
})

describe('ExportPanel over a Selection (ticket 1210)', () => {
  const selection: Selection = { top: 1, left: 1, rows: 3, columns: 4, layer: 'canvas' }

  async function mountSelection(project: Project) {
    const wrapper = mount(ExportPanel, { props: { project, selection }, attachTo: document.body })
    await vi.dynamicImportSettled()
    await flushPromises()
    return wrapper
  }

  it('says what it exports with its size in beads, the same rows under it as the Frame\'s', async () => {
    const wrapper = await mountSelection(drawn())
    expect(wrapper.get('[data-testid="export-panel-scope"]').text()).toBe('Exporting the Selection · 4×3')
    expect(wrapper.find('[data-testid="export-panel-project"]').exists()).toBe(false)
    expect(['export-png', 'export-pdf', 'export-project-file', 'export-file-name', 'export-maker-name-row'].filter((id) => has(wrapper as Panel, id))).toHaveLength(5)
  })

  it('hands the Selection laid as a Frame with each export, named part in the file name\'s Frame place', async () => {
    const wrapper = await mountSelection(drawn())
    await wrapper.get('[data-testid="export-png"]').trigger('click')
    await wrapper.get('[data-testid="export-pdf"]').trigger('click')

    const [png] = wrapper.emitted('export-png')![0] as [Project]
    const [typed, pdf] = wrapper.emitted('export-pdf')![0] as [string | undefined, Project]
    expect([frameOf(png)!.rows, frameOf(png)!.columns, frameOf(png)!.name]).toEqual([3, 4, en.frame.partFileName])
    expect(typed).toBeUndefined()
    expect(frameOf(pdf)!.name).toBe(en.frame.partFileName)
    expect(wrapper.get('[data-testid="export-file-name"]').text()).toMatch(/-part/)
  })
})
