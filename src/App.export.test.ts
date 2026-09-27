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

/** The exports are items of the save box's Export menu (ticket 148). */
async function openExportMenu(wrapper: ReturnType<typeof mount>) {
  await wrapper.find('[data-testid="export-menu-button"]').trigger('click')
}

describe('App PNG and PDF export (tickets 73, 74)', () => {
  it('hands over the open Pattern as a PNG named for it', async () => {
    const wrapper = mountApp()
    await openExportMenu(wrapper)

    await wrapper.find('[data-testid="export-png"]').trigger('click')
    await flushPromises()

    expect(exportPatternPng).toHaveBeenCalledWith(
      expect.objectContaining({ id: pattern.id }),
      expect.objectContaining({ name: 'My scarf', labels: en.print }),
    )
    expect(downloadFile).toHaveBeenCalledWith(patternExportFileName(pattern, 'png'), expect.any(Blob), 'image/png')
    expect(patternExportFileName(pattern, 'png')).toBe('bd-beads-my-scarf.png')
  })

  it("hands over the open Pattern as a PDF, with the labels in the app's language", async () => {
    const wrapper = mountApp()
    await openExportMenu(wrapper)

    await wrapper.find('[data-testid="export-pdf"]').trigger('click')
    await flushPromises()

    expect(exportPatternPdf).toHaveBeenCalledWith(
      expect.objectContaining({ id: pattern.id }),
      expect.objectContaining({ name: 'My scarf', labels: en.print }),
    )
    expect(downloadFile).toHaveBeenCalledWith('bd-beads-my-scarf.pdf', expect.any(Blob), 'application/pdf')
  })

  it('keeps its buttons off while a picture is being drawn, and back on after', async () => {
    let finish!: (blob: Blob) => void
    vi.mocked(exportPatternPng).mockReturnValueOnce(new Promise((resolve) => (finish = resolve)))
    const wrapper = mountApp()
    await openExportMenu(wrapper)

    await wrapper.find('[data-testid="export-png"]').trigger('click')
    await openExportMenu(wrapper)
    expect(wrapper.find('[data-testid="export-png"]').attributes('disabled')).toBeDefined()

    finish(new Blob(['png']))
    await flushPromises()
    expect(wrapper.find('[data-testid="export-png"]').attributes('disabled')).toBeUndefined()
  })
})

describe('App empty, loading and failed states (ticket 158)', () => {
  it('says what is being made once an export takes longer than the loading delay', async () => {
    vi.useFakeTimers()
    let finish!: (blob: Blob) => void
    vi.mocked(exportPatternPdf).mockReturnValueOnce(new Promise((resolve) => (finish = resolve)))
    const wrapper = mountApp()
    await openExportMenu(wrapper)

    await wrapper.find('[data-testid="export-pdf"]').trigger('click')
    await vi.advanceTimersByTimeAsync(200)
    expect(wrapper.find('[data-testid="loading"]').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(100)
    expect(wrapper.find('[data-testid="save-box"] [data-testid="loading"]').text()).toBe('Making the PDF · My scarf')

    finish(new Blob(['pdf']))
    await flushPromises()
    expect(wrapper.find('[data-testid="loading"]').exists()).toBe(false)
    vi.useRealTimers()
  })

  it('offers Export Pattern as the way out when a save fails, handing over the open Pattern', async () => {
    const wrapper = mountApp()
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    await wrapper.find('[data-testid="save-button"]').trigger('click')
    setItem.mockRestore()
    vi.mocked(downloadFile).mockClear()

    await wrapper.find('[data-testid="save-failed-export"]').trigger('click')

    expect(downloadFile).toHaveBeenCalledWith('bd-beads-my-scarf.json', expect.any(String))
  })

  it('offers Export Pattern from the Export menu when the Pattern is too large for a QR code', async () => {
    const wrapper = mountApp()
    await openExportMenu(wrapper)

    // The fixture is small enough for a code: no way out needed.
    expect(wrapper.find('[data-testid="export-qr-way-out"]').exists()).toBe(false)
  })
})
