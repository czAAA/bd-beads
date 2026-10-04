import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createProject } from '../../domain/project'
import { libraryFileName, projectExportFileName, projectFileName } from '../../domain/projectFile'
import { en } from '../../i18n/en'
import { useExportFlow } from './useExportFlow'

vi.mock('../../rendering/projectExport', () => ({
  exportProjectPng: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
  exportProjectPdf: vi.fn(async () => new Blob(['pdf'], { type: 'application/pdf' })),
}))
import { exportProjectPdf, exportProjectPng } from '../../rendering/projectExport'

const project = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'My scarf', size: { width: 3, height: 3, unit: 'beads' } })

/** A fake for the file hand-over, so nothing here touches the DOM. */
const downloadFile = vi.fn()

beforeEach(() => {
  downloadFile.mockClear()
  vi.mocked(exportProjectPng).mockClear()
  vi.mocked(exportProjectPdf).mockClear()
  localStorage.clear()
})

function setup(options: { open?: boolean } = {}) {
  const deps = {
    currentProject: () => (options.open === false ? undefined : project),
    projects: () => [project],
    shareableProject: () => (options.open === false ? undefined : project),
    messages: () => en,
    locale: () => 'en' as const,
    downloadFile,
  }
  return useExportFlow(deps)
}

describe('useExportFlow with no Frame (ticket 233)', () => {
  it('exports no PNG or PDF, since they hold the Frame\'s beads', async () => {
    const { frame: _frame, ...open } = project
    const flow = useExportFlow({
      currentProject: () => open,
      projects: () => [open],
      shareableProject: () => open,
      messages: () => en,
      locale: () => 'en' as const,
      downloadFile,
    })
    await flow.onExportPng()
    await flow.onExportPdf()

    expect(exportProjectPng).not.toHaveBeenCalled()
    expect(exportProjectPdf).not.toHaveBeenCalled()
    expect(downloadFile).not.toHaveBeenCalled()
    expect(flow.qrExport.matrix.value).toBeUndefined()
    expect(flow.qrExport.tooLarge.value).toBe(false)
  })
})

describe('useExportFlow', () => {
  describe('Project file', () => {
    it('hands over the whole library as one file', () => {
      setup().onExportLibraryFile()
      expect(downloadFile).toHaveBeenCalledWith(libraryFileName(), expect.any(String))
    })

    it('hands over the open Project as a Project file', () => {
      setup().onExportProjectFile()
      expect(downloadFile).toHaveBeenCalledWith(projectFileName(project), expect.any(String))
    })

    it('hands over the whole library when no Project is open', () => {
      setup({ open: false }).onExportProjectFile()
      expect(downloadFile).toHaveBeenCalledWith(libraryFileName(), expect.any(String))
    })
  })

  describe('PNG and PDF', () => {
    it('draws the open Project as a PNG, printing the maker’s name, and hands it over named for the Project', async () => {
      const flow = setup()
      flow.onSaveMakerName('Ada')
      await flow.onExportPng()

      expect(exportProjectPng).toHaveBeenCalledWith(
        expect.objectContaining({ id: project.id }),
        expect.objectContaining({ name: 'My scarf', labels: en.print, maker: 'Ada' }),
      )
      expect(downloadFile).toHaveBeenCalledWith(projectExportFileName(project, 'png'), expect.any(Blob), 'image/png')
    })

    it('draws the open Project as a PDF', async () => {
      await setup().onExportPdf()
      expect(exportProjectPdf).toHaveBeenCalled()
      expect(downloadFile).toHaveBeenCalledWith(projectExportFileName(project, 'pdf'), expect.any(Blob), 'application/pdf')
    })

    it('says which export is being drawn until it is done, and refuses a second one meanwhile', async () => {
      const flow = setup()
      const first = flow.onExportPng()
      expect(flow.exporting.value).toBe('png')

      await flow.onExportPdf()
      expect(exportProjectPdf).not.toHaveBeenCalled()

      await first
      expect(flow.exporting.value).toBeUndefined()
    })

    it('stops saying so when drawing fails', async () => {
      vi.mocked(exportProjectPng).mockRejectedValueOnce(new Error('no canvas'))
      const flow = setup()
      await expect(flow.onExportPng()).rejects.toThrow('no canvas')
      expect(flow.exporting.value).toBeUndefined()
    })

    it('does nothing with no Project open', async () => {
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
    it('follows the settled Project and opens and closes its panel', () => {
      const { qrExport } = setup()
      expect(qrExport.panelOpen.value).toBe(false)
      qrExport.open()
      expect(qrExport.panelOpen.value).toBe(true)
      qrExport.close()
      expect(qrExport.panelOpen.value).toBe(false)
    })
  })
})
