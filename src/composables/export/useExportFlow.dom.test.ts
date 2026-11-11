import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createProject } from '../../domain/createProject'
import type { Project } from '../../domain/project'
import { libraryFileName, projectExportFileName, projectFileName, projectFileNameOf, projectListFileName } from '../../domain/projectFile'
import { en } from '../../i18n/en'
import { readProjectsFile } from '../../services/projectFileCodec'
import { encodeProject } from '../../domain/projectEncoding'
import { projectSummaryOf } from '../../domain/sealedProject'
import { useExportFlow } from './useExportFlow'
import type { FileWriter, PickedFile } from '../../services/fileWriter'
import type { LinkedFileStore } from '../../services/linkedFileStore'
import type { SealedProject } from '../../domain/sealedProject'

import { PNG_DPI_BY_QUALITY, type ExportQuality } from '../../domain/exportQuality'
vi.mock('../../rendering/exportDpi', () => ({ pngDpiFor: vi.fn((quality: ExportQuality) => PNG_DPI_BY_QUALITY[quality]), pdfPageDpi: vi.fn(() => 300) }))
vi.mock('../../rendering/projectExport', () => ({
  exportProjectPng: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
  exportProjectPdf: vi.fn(async () => new Blob(['pdf'], { type: 'application/pdf' })),
  projectPageCount: vi.fn(() => 1),
}))
import { exportProjectPdf, exportProjectPng, projectPageCount } from '../../rendering/projectExport'
import { canvasOf, withFrameSheet } from '../../domain/layerRecord'
import { withLayers } from '../../testUtils/layerFields'

const project = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'My scarf', size: { width: 3, height: 3, unit: 'beads' } })

/** A fake for the file hand-over, so nothing here touches the DOM. */
const downloadFile = vi.fn()

beforeEach(() => {
  downloadFile.mockClear()
  vi.mocked(exportProjectPng).mockClear()
  vi.mocked(exportProjectPdf).mockClear()
  vi.mocked(projectPageCount).mockReturnValue(1)
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
    const open = withFrameSheet(project, undefined)
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
    expect(canvasOf(replaced.at(-1)!).letters).toBe(true)
    flow.onSetLetters(false)
    expect(canvasOf(replaced.at(-1)!).letters).toBeUndefined()
    flow.onSetLetters(false)
    expect(replaced).toHaveLength(2)
  })
})

describe('useExportFlow Word chart (ticket 0586)', () => {
  it('makes only the pattern PNG with Letters on: the Word chart is PDF pages, not a picture', async () => {
    await setup({ project: withLayers(project, { letters: true }) }).onExportPng()

    expect(downloadFile.mock.calls.map((call) => call[0])).toEqual([projectExportFileName(project, 'png')])
  })
})

describe('useExportFlow', () => {
  describe('Project file', () => {
    it('hands over the whole library as one gzipped file', async () => {
      await setup().onExportLibraryFile()
      expect(downloadFile).toHaveBeenCalledWith(libraryFileName(), expect.any(Uint8Array), 'application/json')
    })

    it('hands over the open Project as a Project file', async () => {
      await setup().onSave()
      expect(downloadFile).toHaveBeenCalledWith(projectFileName(project), expect.any(Uint8Array), 'application/json')
    })

    it('hands over a sealed Project, and the library with it, read back from its stored form (ticket 0716)', async () => {
      const kept = { ...projectSummaryOf(encodeProject(project))!, stored: JSON.stringify(encodeProject(project)) }
      const flow = useExportFlow({ currentProject: () => undefined, projects: () => [], sealed: () => [kept], messages: () => en, locale: () => 'en', replaceProject: () => {}, downloadFile })

      await flow.onExportSealed(kept)
      await flow.onExportLibraryFile()

      const [one, library] = vi.mocked(downloadFile).mock.calls.slice(-2)
      expect(one![0]).toBe(projectFileName(project))
      expect((await readProjectsFile(new Blob([one![1] as Uint8Array<ArrayBuffer>]))).projects.map((each) => each.id)).toEqual([project.id])
      expect((await readProjectsFile(new Blob([library![1] as Uint8Array<ArrayBuffer>]))).projects.map((each) => each.id)).toEqual([project.id])
    })

    it('hands over the whole library when no Project is open', async () => {
      await setup({ open: false }).onSave()
      expect(downloadFile).toHaveBeenCalledWith(libraryFileName(), expect.any(Uint8Array), 'application/json')
    })

    it('saves the Project file of any Project of the library, open or not, a sealed one from its stored form (ticket 0842)', async () => {
      const other = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Owl', size: { width: 3, height: 3, unit: 'beads' } })
      const kept = { ...projectSummaryOf(encodeProject(other))!, id: 'kept', name: 'Kept', stored: JSON.stringify(encodeProject(other)) }
      const flow = useExportFlow({ currentProject: () => project, projects: () => [project, other], sealed: () => [kept], messages: () => en, locale: () => 'en', replaceProject: () => {}, downloadFile })

      expect(await flow.onSaveFileOf(other.id)).toBe(true)
      await flow.onSaveFileOf('kept')
      expect(await flow.onSaveFileOf('gone')).toBe(false)

      expect(downloadFile.mock.calls.map((call) => call[0])).toEqual([projectFileName(other), projectFileNameOf('Kept')])
    })
  })

  describe('PNG and PDF', () => {
    it('draws the open Project as a PNG, printing the maker’s name, and hands it over named for the Project and its maker', async () => {
      const flow = setup({ project: { ...project, makerName: 'Ada' } })
      await flow.onExportPng()

      expect(exportProjectPng).toHaveBeenCalledWith(
        expect.objectContaining({ id: project.id }),
        expect.objectContaining({ name: 'My scarf', labels: en.print, maker: 'Ada' }),
        300,
      )
      expect(downloadFile).toHaveBeenCalledWith(projectExportFileName({ ...project, makerName: 'Ada' }, 'png'), expect.any(Blob), 'image/png')
    })

    it('draws the PNG page at the dpi of the Export quality on the device, like a PDF page (ticket 0583)', async () => {
      localStorage.setItem('openbeads:export-quality', 'high')
      await setup().onExportPng()
      expect(exportProjectPng).toHaveBeenCalledWith(expect.anything(), expect.anything(), 450)
    })

    it('hands over the list pages Beads needed runs over onto as _2 and _3, in order (ticket 0583)', async () => {
      vi.mocked(projectPageCount).mockReturnValue(3)
      await setup({ project: withLayers(project, { letters: true }) }).onExportPng()

      expect(downloadFile.mock.calls.map((call) => call[0])).toEqual([projectExportFileName(project, 'png'), projectListFileName(project, 2), projectListFileName(project, 3)])
      expect(projectListFileName(project, 2)).toBe('my-scarf_2.png')
      expect(vi.mocked(exportProjectPng).mock.calls.map((call) => call[3])).toEqual([undefined, 1, 2])
    })

    it('stops handing over pages when one is cancelled (ticket 0583)', async () => {
      vi.mocked(projectPageCount).mockReturnValue(3)
      downloadFile.mockResolvedValueOnce('saved').mockResolvedValueOnce('cancelled')
      await setup().onExportPng()

      expect(downloadFile).toHaveBeenCalledTimes(2)
    })

    it('draws the PDF at its own dpi whatever the Export quality (ADR 0076)', async () => {
      localStorage.setItem('openbeads:export-quality', 'high')
      await setup().onExportPdf()
      expect(exportProjectPdf).toHaveBeenCalledWith(expect.anything(), expect.anything(), 300)
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

  it('hands the file over in the tap, then names it in the saved-file toast, with no action (ticket 0859)', async () => {
    const { flow, toasts } = setupToasts('handed')
    await flow.onExportPng()

    expect(downloadFile).toHaveBeenCalledWith(projectExportFileName(project, 'png'), expect.any(Blob), 'image/png')
    expect(toasts).toEqual([{ id: 'saved-file', text: 'Saved: my-scarf.png', action: undefined }])
  })

  it('names the PDF and the Project file in the same toast, each replacing the last', async () => {
    const { flow, toasts } = setupToasts()
    await flow.onExportPdf()
    await flow.onSave()

    expect(toasts.map((toast) => [toast.id, toast.text])).toEqual([['saved-file', 'Saved: my-scarf.pdf'], ['saved-file', `Saved: ${projectFileName(project)}`]])
  })

  it('gives each further page its own toast, so every file is named', async () => {
    vi.mocked(projectPageCount).mockReturnValue(2)
    const { flow, toasts } = setupToasts()
    await flow.onExportPng()

    expect(toasts.map((toast) => [toast.id, toast.text])).toEqual([['saved-file', 'Saved: my-scarf.png'], ['saved-file-2', 'Saved: my-scarf_2.png']])
  })

  it('says nothing when the person closed the share sheet', async () => {
    const { flow, toasts } = setupToasts('cancelled')
    await flow.onExportPng()

    expect(toasts).toEqual([])
  })

  it('keeps a Save action when the share was refused for a stale tap, hands the file over again from it, then says Saved', async () => {
    const { flow, toasts } = setupToasts('refused')
    await flow.onExportPng()

    expect(toasts).toHaveLength(1)
    expect(toasts[0]!.text).toBe('Ready to save: my-scarf.png')
    expect(toasts[0]!.action!.label).toBe(en.saveBox.readySave)
    downloadFile.mockClear()
    downloadFile.mockReturnValue('handed')
    toasts[0]!.action!.run()
    expect(downloadFile).toHaveBeenCalledWith(projectExportFileName(project, 'png'), expect.any(Blob), 'image/png')
    await vi.waitFor(() => expect(toasts.at(-1)!.text).toBe('Saved: my-scarf.png'))
  })
})

describe('useExportFlow Save and Save as (ADR 0090, ticket 0796)', () => {
  const linked = (name: string) => ({ name }) as PickedFile

  function setupSave(options: { writer?: Partial<FileWriter>; links?: Record<string, PickedFile>; handOver?: 'handed' | 'refused' | 'cancelled'; projects?: Project[]; sealed?: SealedProject[] } = {}) {
    const toasts: { id: string; text: string; action?: { label: string; run: () => void } }[] = []
    const links = new Map(Object.entries(options.links ?? {}))
    const saved: (readonly string[])[] = []
    const fileNames: string[] = []
    const reached = vi.fn()
    downloadFile.mockReturnValue(options.handOver ?? 'handed')
    const writer: FileWriter = {
      available: true,
      pick: vi.fn(async (name: string) => ({ kind: 'picked' as const, file: linked(name) })),
      ready: vi.fn(async () => true),
      write: vi.fn(async () => true),
      ...options.writer,
    }
    const linkedFiles: LinkedFileStore = {
      get: async (id) => links.get(id),
      put: async (id, file) => !!links.set(id, file),
      remove: async (id) => void links.delete(id),
      keepOnly: async () => {},
    }
    const flow = useExportFlow({
      currentProject: () => project,
      projects: () => options.projects ?? [project],
      sealed: () => options.sealed ?? [],
      messages: () => en,
      locale: () => 'en' as const,
      replaceProject: () => {},
      downloadFile,
      fileWriter: writer,
      linkedFiles,
      onFileSaved: (ids, fileName) => {
        saved.push(ids)
        fileNames.push(fileName)
      },
      onFileReached: reached,
      showToast: (id, text, _tone, action) => toasts.push({ id, text, action }),
    })
    return { flow, writer, links, saved, fileNames, toasts, reached }
  }

  it('without File System Access, Save hands the file over as before, names it and counts from 0 again', async () => {
    const { flow, saved, fileNames, toasts } = setupSave({ writer: { available: false } })
    await flow.onSave()

    expect(downloadFile).toHaveBeenCalledWith(projectFileName(project), expect.any(Uint8Array), 'application/json')
    expect(toasts.map((toast) => toast.text)).toEqual([`Saved: ${projectFileName(project)}`])
    expect(saved).toEqual([[project.id]])
    expect(fileNames).toEqual([projectFileName(project)])
    expect(flow.canSaveAs.value).toBe(false)
  })

  it('without File System Access, Save as is Save', async () => {
    const { flow, writer } = setupSave({ writer: { available: false } })
    await flow.onSaveAs()

    expect(writer.pick).not.toHaveBeenCalled()
    expect(downloadFile).toHaveBeenCalledWith(projectFileName(project), expect.any(Uint8Array), 'application/json')
  })

  it('keeps the count when the share sheet is closed, or refused until its action hands the file over', async () => {
    expect((await run('cancelled')).saved).toEqual([])
    const refused = await run('refused')
    expect(refused.saved).toEqual([])
    downloadFile.mockReturnValue('handed')
    refused.toasts[0]!.action!.run()
    await vi.waitFor(() => expect(refused.saved).toEqual([[project.id]]))

    async function run(handOver: 'refused' | 'cancelled') {
      const setup = setupSave({ writer: { available: false }, handOver })
      await setup.flow.onSave()
      return setup
    }
  })

  it('the first Save asks where to save, writes the file, links it and says Saved: {file}', async () => {
    const { flow, writer, links, saved, fileNames, toasts } = setupSave()
    await flow.onSave()

    expect(writer.pick).toHaveBeenCalledWith(projectFileName(project))
    expect(writer.write).toHaveBeenCalledWith(linked(projectFileName(project)), expect.any(Uint8Array))
    expect(links.get(project.id)).toEqual(linked(projectFileName(project)))
    expect(downloadFile).not.toHaveBeenCalled()
    expect(toasts.map((toast) => toast.text)).toEqual([`Saved: ${projectFileName(project)}`])
    expect(saved).toEqual([[project.id]])
    expect(fileNames).toEqual([projectFileName(project)])
    await vi.waitFor(() => expect(flow.linkedFileName.value).toBe(projectFileName(project)))
  })

  it('a later Save writes into the Linked file with no dialog', async () => {
    const { flow, writer } = setupSave({ links: { [project.id]: linked('Moth.openbeads') } })
    await flow.onSave()

    expect(writer.ready).toHaveBeenCalledWith(linked('Moth.openbeads'))
    expect(writer.pick).not.toHaveBeenCalled()
    expect(writer.write).toHaveBeenCalledWith(linked('Moth.openbeads'), expect.any(Uint8Array))
  })

  it('a refused permission or a moved file opens the dialog and links the file picked, with no error', async () => {
    const { flow, writer, links, toasts } = setupSave({ links: { [project.id]: linked('Moth.openbeads') }, writer: { ready: vi.fn(async () => false) } })
    await flow.onSave()

    expect(writer.pick).toHaveBeenCalled()
    expect(links.get(project.id)).toEqual(linked(projectFileName(project)))
    expect(toasts.map((toast) => toast.text)).toEqual([`Saved: ${projectFileName(project)}`])
  })

  it('a cancelled dialog changes nothing', async () => {
    const { flow, writer, links, saved, toasts } = setupSave({ writer: { pick: vi.fn(async () => ({ kind: 'cancelled' as const })) } })
    await flow.onSave()

    expect(writer.write).not.toHaveBeenCalled()
    expect(downloadFile).not.toHaveBeenCalled()
    expect([links.size, saved, toasts]).toEqual([0, [], []])
  })

  it('a dialog the browser refuses to open, or a write that fails, hands the file over instead', async () => {
    const refused = setupSave({ writer: { pick: vi.fn(async () => ({ kind: 'failed' as const })) } })
    await refused.flow.onSave()
    const failed = setupSave({ writer: { write: vi.fn(async () => false) } })
    await failed.flow.onSave()

    expect(downloadFile).toHaveBeenCalledTimes(2)
    expect(failed.links.size).toBe(0)
    expect(failed.toasts.map((toast) => toast.text)).toEqual([`Saved: ${projectFileName(project)}`])
  })

  it('Save as always asks and links the new file', async () => {
    const { flow, writer, links } = setupSave({ links: { [project.id]: linked('Moth.openbeads') }, writer: { pick: vi.fn(async () => ({ kind: 'picked' as const, file: linked('Moth 2.openbeads') })) } })
    await flow.onSaveAs()

    expect(writer.ready).not.toHaveBeenCalled()
    expect(links.get(project.id)).toEqual(linked('Moth 2.openbeads'))
    expect(flow.canSaveAs.value).toBe(true)
  })

  it('says a file reached the device after a Save, whether written or handed over (ticket 0839)', async () => {
    const written = setupSave()
    await written.flow.onSave()
    expect(written.reached).toHaveBeenCalledOnce()
    const handed = setupSave({ writer: { available: false } })
    await handed.flow.onSaveFileOf(project.id)
    expect(handed.reached).toHaveBeenCalledOnce()
  })

  it('says nothing reached the device when the pick is cancelled or the share refused (ticket 0839)', async () => {
    const cancelled = setupSave({ writer: { pick: vi.fn(async () => ({ kind: 'cancelled' as const })) } })
    await cancelled.flow.onSave()
    expect(cancelled.reached).not.toHaveBeenCalled()
    const refused = setupSave({ writer: { available: false }, handOver: 'refused' })
    await refused.flow.onSave()
    expect(refused.reached).not.toHaveBeenCalled()
  })

  it('says a file reached the device after a PNG or PDF export too (ticket 0839)', async () => {
    const { flow, reached } = setupSave()
    await flow.onExportPng()
    await flow.onExportPdf()
    expect(reached).toHaveBeenCalledTimes(2)
  })

  it('Export all and a sealed Project\'s Export hand over, never link, and count every Project they wrote from 0 again', async () => {
    const kept = { ...projectSummaryOf(encodeProject(project))!, id: 'sealed', stored: JSON.stringify(encodeProject(project)) }
    const { flow, writer, saved } = setupSave({ sealed: [kept] })
    await flow.onExportLibraryFile()
    await flow.onExportSealed(kept)

    expect(writer.pick).not.toHaveBeenCalled()
    expect(downloadFile).toHaveBeenCalledTimes(2)
    expect(saved).toEqual([[project.id, 'sealed'], ['sealed']])
  })
})

describe('useExportFlow Linked files kept (ADR 0090)', () => {
  it('drops the links of no Project at start, and a Project\'s link when it leaves the library', async () => {
    const ids = ref(['a', 'b'])
    const linkedFiles = { get: vi.fn(async () => undefined), put: vi.fn(), remove: vi.fn(async () => {}), keepOnly: vi.fn(async () => {}) }
    useExportFlow({ currentProject: () => undefined, projects: () => [], messages: () => en, locale: () => 'en', replaceProject: () => {}, linkedFiles, libraryIds: () => ids.value })

    expect(linkedFiles.keepOnly).toHaveBeenCalledWith(new Set(['a', 'b']))
    ids.value = ['b']
    await nextTick()
    expect(linkedFiles.remove).toHaveBeenCalledWith('a')
  })
})
