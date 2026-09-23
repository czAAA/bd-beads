import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { BEAD_CATALOG } from './domain/beads'
import { downloadFile } from './domain/fileDownload'
import { createPattern } from './domain/pattern'
import { patternExportFileName } from './domain/patternFile'
import { savePatterns } from './domain/patternStorage'
import { en } from './i18n/en'
import { exportPatternPdf, exportPatternPng } from './rendering/patternExport'

/** Drawing needs a real canvas and the hand-over a real browser, which jsdom is not: both are observed instead (the exports are checked in a browser by e2e/visual/export.spec.ts). */
vi.mock('./domain/fileDownload', () => ({ downloadFile: vi.fn() }))
vi.mock('./rendering/patternExport', () => ({
  exportPatternPng: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
  exportPatternPdf: vi.fn(async () => new Blob(['pdf'], { type: 'application/pdf' })),
}))

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!
const pattern = createPattern({ technique: 'loom', beadId: cubeBead.id, name: 'My scarf', size: { width: 15, height: 30, unit: 'mm' } })

const mounted: ReturnType<typeof mount>[] = []

beforeEach(() => {
  vi.mocked(downloadFile).mockClear()
  vi.mocked(exportPatternPng).mockClear()
  vi.mocked(exportPatternPdf).mockClear()
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
  savePatterns([pattern])
})

afterEach(() => {
  for (const wrapper of mounted.splice(0)) {
    wrapper.unmount()
  }
})

function mountApp() {
  const wrapper = mount(App)
  mounted.push(wrapper)
  return wrapper
}

describe('App PNG and PDF export (tickets 73, 74)', () => {
  it('hands over the open Pattern as a PNG named for it', async () => {
    const wrapper = mountApp()

    await wrapper.find('[data-testid="export-png"]').trigger('click')
    await flushPromises()

    expect(exportPatternPng).toHaveBeenCalledWith(expect.objectContaining({ id: pattern.id }))
    expect(downloadFile).toHaveBeenCalledWith(patternExportFileName(pattern, 'png'), expect.any(Blob), 'image/png')
    expect(patternExportFileName(pattern, 'png')).toBe('bd-beads-my-scarf.png')
  })

  it("hands over the open Pattern as a PDF, with the labels in the app's language", async () => {
    const wrapper = mountApp()

    await wrapper.find('[data-testid="export-pdf"]').trigger('click')
    await flushPromises()

    expect(exportPatternPdf).toHaveBeenCalledWith(
      expect.objectContaining({ id: pattern.id }),
      expect.objectContaining({ totalLabel: en.transfer.pdfTotalLabel, pageLabel: en.transfer.pdfPageLabel }),
    )
    expect(downloadFile).toHaveBeenCalledWith('bd-beads-my-scarf.pdf', expect.any(Blob), 'application/pdf')
  })

  it('keeps its buttons off while a picture is being drawn, and back on after', async () => {
    let finish!: (blob: Blob) => void
    vi.mocked(exportPatternPng).mockReturnValueOnce(new Promise((resolve) => (finish = resolve)))
    const wrapper = mountApp()

    await wrapper.find('[data-testid="export-png"]').trigger('click')
    expect(wrapper.find('[data-testid="export-png"]').attributes('disabled')).toBeDefined()

    finish(new Blob(['png']))
    await flushPromises()
    expect(wrapper.find('[data-testid="export-png"]').attributes('disabled')).toBeUndefined()
  })
})
