import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ExportPanel from './ExportPanel.vue'
import { createProject } from '../../domain/createProject'
import { withColors } from '../../domain/canvas'
import type { Project } from '../../domain/project'
import { en } from '../../i18n/en'
import { PNG_DPI_BY_QUALITY, type ExportQuality } from '../../domain/exportQuality'
import { withFrameSheet } from '../../domain/layerRecord'
import { withFields } from '../../testUtils/flatFields'

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
const drawn = (): Project => (withFields(empty(), { beads: withColors({}, [{ row: 1, column: 1, color: '#ff0000' }]) }))
const framed = (): Project => (withFields(empty(), { frame: { row: 2, column: 3, rows: 6, columns: 5, technique: 'loom', beads: {} } }))

const mountPanel = (project: Project) => mount(ExportPanel, { props: { project }, attachTo: document.body })
const has = (wrapper: ReturnType<typeof mountPanel>, testId: string) => wrapper.find(`[data-testid="${testId}"]`).exists()

describe('ExportPanel (ticket 0652)', () => {
  it('holds Picture, Printable chart and Export quality with a Frame, and passes each export on', async () => {
    const wrapper = mountPanel(framed())

    expect(wrapper.get('[data-testid="export-png"]').text()).toMatch(/^Picture.*PNG/)
    expect(wrapper.get('[data-testid="export-pdf"]').text()).toMatch(/^Printable chart.*PDF/)
    expect(has(wrapper, 'quality-range')).toBe(true)
    expect(['export-needs-frame', 'export-select-frame', 'export-fit', 'frame-letters'].filter((id) => has(wrapper, id))).toEqual([])

    await wrapper.get('[data-testid="export-png"]').trigger('click')
    await wrapper.get('[data-testid="export-pdf"]').trigger('click')
    expect(wrapper.emitted('export-png')).toHaveLength(1)
    expect(wrapper.emitted('export-pdf')).toHaveLength(1)
  })

  it('says to set a frame with none, offers Select a frame and Fit, and shows no export rows', async () => {
    const wrapper = mountPanel(drawn())

    expect(wrapper.get('[data-testid="export-needs-frame"]').text()).toBe(en.frame.exportNeedsFrame)
    expect(['export-png', 'export-pdf', 'quality-range'].filter((id) => has(wrapper, id))).toEqual([])

    await wrapper.get('[data-testid="export-select-frame"]').trigger('click')
    await wrapper.get('[data-testid="export-fit"]').trigger('click')
    expect(wrapper.emitted('select-frame')).toHaveLength(1)
    expect(wrapper.emitted('fit')).toHaveLength(1)
  })

  it('has Fit off, with its reason, while nothing is drawn', async () => {
    const wrapper = mountPanel(empty())
    const fit = wrapper.get('[data-testid="export-fit"]')

    expect(fit.attributes('aria-disabled')).toBe('true')
    await fit.trigger('click')
    expect(wrapper.emitted('fit')).toBeUndefined()
  })
})
