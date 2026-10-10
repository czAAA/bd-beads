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
      messages: () => en,
      locale: () => 'en' as const,
      downloadFile,
    })
    await flow.onExportPng()
    await flow.onExportPdf()

    expect(exportProjectPng).not.toHaveBeenCalled()
    expect(exportProjectPdf).not.toHaveBeenCalled()
    expect(downloadFile).not.toHaveBeenCalled()
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
})

describe('useExportFlow where sharing needs a fresh tap (ticket 306)', () => {
  function setupShare(sharesFromTap: boolean) {
    const toasts: { id: string; text: string; action?: { label: string; run: () => void } }[] = []
    const flow = useExportFlow({
      currentProject: () => project,
      projects: () => [project],
      messages: () => en,
      locale: () => 'en' as const,
      downloadFile,
      sharesFromTap: () => sharesFromTap,
      showToast: (id, text, _tone, action) => toasts.push({ id, text, action }),
    })
    return { flow, toasts }
  }

  it('hands the file over only from the toast action, never after the wait', async () => {
    const { flow, toasts } = setupShare(true)
    await flow.onExportPng()

    expect(downloadFile).not.toHaveBeenCalled()
    expect(toasts.map((toast) => toast.text)).toEqual([en.saveBox.readyPng])
    toasts[0]!.action!.run()
    expect(downloadFile).toHaveBeenCalledWith(projectExportFileName(project, 'png'), expect.any(Blob), 'image/png')
  })

  it('shares nothing when the toast is dismissed', async () => {
    const { flow } = setupShare(true)
    await flow.onExportPdf()

    expect(downloadFile).not.toHaveBeenCalled()
  })

  it('names the PDF in its toast', async () => {
    const { flow, toasts } = setupShare(true)
    await flow.onExportPdf()

    expect(toasts[0]!.text).toBe(en.saveBox.readyPdf)
  })

  it('downloads at once, with no toast, off the share path', async () => {
    const { flow, toasts } = setupShare(false)
    await flow.onExportPng()

    expect(downloadFile).toHaveBeenCalledOnce()
    expect(toasts).toEqual([])
  })

  it('leaves the Project file and library exports alone', () => {
    const { flow, toasts } = setupShare(true)
    flow.onExportProjectFile()
    flow.onExportLibraryFile()

    expect(downloadFile).toHaveBeenCalledTimes(2)
    expect(toasts).toEqual([])
  })
})
