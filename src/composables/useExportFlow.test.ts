import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPattern } from '../domain/pattern'
import { libraryFileName, patternExportFileName, patternFileName } from '../domain/patternFile'
import { en } from '../i18n/en'
import { useExportFlow } from './useExportFlow'

vi.mock('../rendering/patternExport', () => ({
  exportPatternPng: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
  exportPatternPdf: vi.fn(async () => new Blob(['pdf'], { type: 'application/pdf' })),
}))
import { exportPatternPdf, exportPatternPng } from '../rendering/patternExport'

const pattern = createPattern({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'My scarf', size: { width: 3, height: 3, unit: 'beads' } })

/** A fake for the file hand-over, so nothing here touches the DOM. */
const downloadFile = vi.fn()

beforeEach(() => {
  downloadFile.mockClear()
  vi.mocked(exportPatternPng).mockClear()
  vi.mocked(exportPatternPdf).mockClear()
  localStorage.clear()
})

function setup(options: { open?: boolean } = {}) {
  const deps = {
    currentPattern: () => (options.open === false ? undefined : pattern),
    patterns: () => [pattern],
    shareablePattern: () => (options.open === false ? undefined : pattern),
    messages: () => en,
    locale: () => 'en' as const,
    downloadFile,
  }
  return useExportFlow(deps)
}

describe('useExportFlow', () => {
  describe('Pattern file', () => {
    it('hands over the whole library as one file', () => {
      setup().onExportLibraryFile()
      expect(downloadFile).toHaveBeenCalledWith(libraryFileName(), expect.any(String))
    })

    it('hands over the open Pattern as a Pattern file', () => {
      setup().onExportPatternFile()
      expect(downloadFile).toHaveBeenCalledWith(patternFileName(pattern), expect.any(String))
    })

    it('hands over the whole library when no Pattern is open', () => {
      setup({ open: false }).onExportPatternFile()
      expect(downloadFile).toHaveBeenCalledWith(libraryFileName(), expect.any(String))
    })
  })

  describe('PNG and PDF', () => {
    it('draws the open Pattern as a PNG, printing the maker’s name, and hands it over named for the Pattern', async () => {
      const flow = setup()
      flow.onSaveMakerName('Ada')
      await flow.onExportPng()

      expect(exportPatternPng).toHaveBeenCalledWith(
        expect.objectContaining({ id: pattern.id }),
        expect.objectContaining({ name: 'My scarf', labels: en.print, maker: 'Ada' }),
      )
      expect(downloadFile).toHaveBeenCalledWith(patternExportFileName(pattern, 'png'), expect.any(Blob), 'image/png')
    })

    it('draws the open Pattern as a PDF', async () => {
      await setup().onExportPdf()
      expect(exportPatternPdf).toHaveBeenCalled()
      expect(downloadFile).toHaveBeenCalledWith(patternExportFileName(pattern, 'pdf'), expect.any(Blob), 'application/pdf')
    })

    it('says which export is being drawn until it is done, and refuses a second one meanwhile', async () => {
      const flow = setup()
      const first = flow.onExportPng()
      expect(flow.exporting.value).toBe('png')

      await flow.onExportPdf()
      expect(exportPatternPdf).not.toHaveBeenCalled()

      await first
      expect(flow.exporting.value).toBeUndefined()
    })

    it('stops saying so when drawing fails', async () => {
      vi.mocked(exportPatternPng).mockRejectedValueOnce(new Error('no canvas'))
      const flow = setup()
      await expect(flow.onExportPng()).rejects.toThrow('no canvas')
      expect(flow.exporting.value).toBeUndefined()
    })

    it('does nothing with no Pattern open', async () => {
      const flow = setup({ open: false })
      await flow.onExportPng()
      await flow.onExportPdf()
      expect(downloadFile).not.toHaveBeenCalled()
    })
  })

  describe('the maker’s name', () => {
    it('is kept on this device and closes its modal', () => {
      const flow = setup()
      flow.nameOnExportsOpen.value = true
      flow.onSaveMakerName('  Ada ')

      expect(flow.makerName.value).toBe('Ada')
      expect(flow.nameOnExportsOpen.value).toBe(false)
      expect(setup().makerName.value).toBe('Ada')
    })
  })

  describe('QR code', () => {
    it('follows the settled Pattern and opens and closes its panel', () => {
      const { qrExport } = setup()
      expect(qrExport.panelOpen.value).toBe(false)
      qrExport.open()
      expect(qrExport.panelOpen.value).toBe(true)
      qrExport.close()
      expect(qrExport.panelOpen.value).toBe(false)
    })
  })
})
