import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createProject, type Project } from '../../domain/project'
import { libraryFileName, projectExportFileName, projectFileName } from '../../domain/projectFile'
import { en } from '../../i18n/en'
import { useExportFlow } from './useExportFlow'

import { PDF_DPI_BY_QUALITY, type ExportQuality } from '../../domain/exportQuality'
vi.mock('../../rendering/pdfDpi', () => ({ pdfDpiFor: vi.fn((quality: ExportQuality) => PDF_DPI_BY_QUALITY[quality]) }))
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

function setup(options: { open?: boolean; project?: Project } = {}) {
  let current = options.project ?? project
  const deps = {
    currentProject: () => (options.open === false ? undefined : current),
    projects: () => [current],
    replaceProject: (next: Project) => {
      current = next
    },
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
      replaceProject: () => {},
      downloadFile,
    })
    await flow.onExportPng()
    await flow.onExportPdf()

    expect(exportProjectPng).not.toHaveBeenCalled()
    expect(exportProjectPdf).not.toHaveBeenCalled()
    expect(downloadFile).not.toHaveBeenCalled()
  })
})

describe('useExportFlow Letters (ticket 0573)', () => {
  it('turns Letters on and off on the open Project, saved with it', () => {
    const replaced: Project[] = []
    const flow = useExportFlow({ currentProject: () => replaced.at(-1) ?? project, projects: () => [project], messages: () => en, locale: () => 'en' as const, replaceProject: (next) => replaced.push(next), downloadFile })
    flow.onSetLetters(true)
    expect(replaced.at(-1)?.letters).toBe(true)
    flow.onSetLetters(false)
    expect(replaced.at(-1)?.letters).toBeUndefined()
    flow.onSetLetters(false)
    expect(replaced).toHaveLength(2)
  })
})

describe('useExportFlow', () => {
  describe('Project file', () => {
    it('hands over the whole library as one gzipped file', async () => {
      await setup().onExportLibraryFile()
      expect(downloadFile).toHaveBeenCalledWith(libraryFileName(), expect.any(Uint8Array), 'application/json')
    })

    it('hands over the open Project as a Project file', async () => {
      await setup().onExportProjectFile()
      expect(downloadFile).toHaveBeenCalledWith(projectFileName(project), expect.any(Uint8Array), 'application/json')
    })

    it('hands over the whole library when no Project is open', async () => {
      await setup({ open: false }).onExportProjectFile()
      expect(downloadFile).toHaveBeenCalledWith(libraryFileName(), expect.any(Uint8Array), 'application/json')
    })
  })

  describe('PNG and PDF', () => {
    it('draws the open Project as a PNG, printing the maker’s name, and hands it over named for the Project', async () => {
      const flow = setup({ project: { ...project, makerName: 'Ada' } })
      await flow.onExportPng()

      expect(exportProjectPng).toHaveBeenCalledWith(
        expect.objectContaining({ id: project.id }),
        expect.objectContaining({ name: 'My scarf', labels: en.print, maker: 'Ada' }),
        60,
      )
      expect(downloadFile).toHaveBeenCalledWith(projectExportFileName(project, 'png'), expect.any(Blob), 'image/png')
    })

    it('draws a bead as many px across as the Export quality on the device says (ticket 571)', async () => {
      localStorage.setItem('openbeads:export-quality', 'high')
      await setup().onExportPng()
      expect(exportProjectPng).toHaveBeenCalledWith(expect.anything(), expect.anything(), 90)
    })

    it('draws the PDF at the dpi of the Export quality on the device (ticket 572)', async () => {
      localStorage.setItem('openbeads:export-quality', 'high')
      await setup().onExportPdf()
      expect(exportProjectPdf).toHaveBeenCalledWith(expect.anything(), expect.anything(), 450)
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
    it('is saved on the open Project, trimmed', () => {
      const flow = setup()
      flow.onSaveMakerName('  Ada ')

      expect(flow.makerName.value).toBe('Ada')
    })

    it('prints none on an export once cleared', async () => {
      const flow = setup({ project: { ...project, makerName: 'Ada' } })
      flow.onSaveMakerName('')
      await flow.onExportPdf()

      expect(flow.makerName.value).toBe('')
      expect(exportProjectPdf).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ maker: '' }), 300)
    })
  })
})

describe('useExportFlow toasts (ticket 523)', () => {
  function setupToasts(handOver?: 'handed' | 'refused' | 'cancelled') {
    const toasts: { id: string; text: string; action?: { label: string; run: () => void } }[] = []
    downloadFile.mockReturnValue(handOver)
    const flow = useExportFlow({
      currentProject: () => project,
      projects: () => [project],
      messages: () => en,
      locale: () => 'en' as const,
      replaceProject: () => {},
      downloadFile,
      showToast: (id, text, _tone, action) => toasts.push({ id, text, action }),
    })
    return { flow, toasts }
  }

  it('hands the file over in the tap, then says it is ready, with no action', async () => {
    const { flow, toasts } = setupToasts('handed')
    await flow.onExportPng()

    expect(downloadFile).toHaveBeenCalledWith(projectExportFileName(project, 'png'), expect.any(Blob), 'image/png')
    expect(toasts).toEqual([{ id: 'export-png', text: en.saveBox.readyPng, action: undefined }])
  })

  it('names the PDF and the file in their toasts', async () => {
    const { flow, toasts } = setupToasts()
    await flow.onExportPdf()
    await flow.onExportProjectFile()

    expect(toasts.map((toast) => toast.text)).toEqual([en.saveBox.readyPdf, en.saveBox.readyFile])
  })

  it('says nothing when the person closed the share sheet', async () => {
    const { flow, toasts } = setupToasts('cancelled')
    await flow.onExportPng()

    expect(toasts).toEqual([])
  })

  it('keeps a Save action when the share was refused for a stale tap, and hands the file over again from it', async () => {
    const { flow, toasts } = setupToasts('refused')
    await flow.onExportPng()

    expect(toasts).toHaveLength(1)
    expect(toasts[0]!.action!.label).toBe(en.saveBox.readySave)
    downloadFile.mockClear()
    toasts[0]!.action!.run()
    expect(downloadFile).toHaveBeenCalledWith(projectExportFileName(project, 'png'), expect.any(Blob), 'image/png')
  })
})
