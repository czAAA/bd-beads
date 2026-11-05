import { computed, ref, watch } from 'vue'
import { withMakerName } from '../../domain/makerName'
import { lettersOn, withLetters } from '../../domain/layerRecord'
import type { Project } from '../../domain/project'
import { libraryFileName, projectExportFileName, projectFileName, projectFileNameOf, projectListFileName } from '../../domain/projectFile'
import type { SealedProject } from '../../domain/sealedProject'
import type { Locale, Translations } from '../../i18n/translations'
import { pdfPageDpi, pngDpiFor } from '../../rendering/exportDpi'
import { exportProjectPdf, exportProjectPng, projectPageCount } from '../../rendering/projectExport'
import { printText } from '../../rendering/printText'
import { downloadFile as browserDownloadFile, type DownloadFile } from '../../services/fileDownload'
import type { FileWriter, PickedFile } from '../../services/fileWriter'
import type { LinkedFileStore } from '../../services/linkedFileStore'
import { fillBlanks } from '../../domain/fillBlanks'
import { packLibraryFile, packProjectFile, packStoredProjectFile } from '../../services/projectFileCodec'
import { useExportQuality } from './useExportQuality'
import type { MessageTone, Toast } from '../ui/useToasts'
import { frameOf } from '../../domain/layerRecord'

/** What exporting needs from the app shell: the open Project and the library, and the app's language. */
export interface ExportFlowDeps {
  currentProject: () => Project | undefined
  projects: () => Project[]
  /** The Projects the library keeps sealed (ticket 0716): exported from their stored form. */
  sealed?: () => SealedProject[]
  messages: () => Translations
  locale: () => Locale
  /** Saves the open Project with its new maker's name; the name is not an undo step (ADR 0060). */
  replaceProject: (project: Project) => void
  /** How a file is handed over (ADR 0020); the browser's by default. */
  downloadFile?: DownloadFile
  /** Shows a toast with an action (useToasts). */
  showToast?: (id: string, text: string, tone?: MessageTone, action?: Toast['action']) => void
  /** The reference images' pictures of these Projects, for the file to carry (ticket 0790); none when not given. */
  picturesOf?: (projectIds: readonly string[]) => Promise<ReadonlyMap<string, Blob>>
  /** Writing into a picked file (ADR 0090); without it, or where the browser can't, every save hands the file over. */
  fileWriter?: FileWriter
  /** Each Project's Linked file (ADR 0090); needed with `fileWriter`. */
  linkedFiles?: LinkedFileStore
  /** Every Project in the library, sealed ones too: a Linked file of none is dropped (Delete, Delete all, start-up). */
  libraryIds?: () => readonly string[]
  /** A Project file of these Projects reached the device (ticket 0796): their Beads since last file go back to 0. */
  onFileSaved?: (projectIds: readonly string[]) => void
}

/** Exporting a Project (tickets 68, 73, 74, 158, 161, 202; ADR 0020) as a Project file, PNG or PDF, printing the
 * maker's name (ADR 0060). Deps are lazy. */
export function useExportFlow(deps: ExportFlowDeps) {
  const downloadFile = deps.downloadFile ?? browserDownloadFile
  const picturesOf = (ids: readonly string[]): Promise<ReadonlyMap<string, Blob>> => deps.picturesOf?.(ids) ?? Promise.resolve(new Map())
  const quality = useExportQuality()

  /** The open Project's maker's name for the PDF and PNG exports (ADR 0060; CONTEXT.md); empty when none is set. */
  const makerName = computed(() => deps.currentProject()?.makerName ?? '')

  /** Saves the name on the open Project at once; it is not part of Undo (NameOnExports card). */
  function onSaveMakerName(name: string) {
    const project = deps.currentProject()
    if (project) {
      deps.replaceProject(withMakerName(project, name))
    }
  }

  /** Letters on or off (ticket 0573): saved with the Project, no Undo step, like the maker's name. */
  function onSetLetters(on: boolean) {
    const project = deps.currentProject()
    if (project && lettersOn(project) !== on) {
      deps.replaceProject(withLetters(project, on))
    }
  }

  /** Which export is being drawn, if any: the save box says so while it takes a while (ticket 158). Drawing a large
   * Project takes a moment, so the buttons wait until it is done. */
  const exporting = ref<'png' | 'pdf' | undefined>()

  /** Makes a file and hands it over inside the tap, then says it is ready (ticket 523). Safari shares only from a
   * fresh tap, so when it refuses because the build took too long the toast's action is the new tap (ticket 306). */
  async function makeAndHandOver(fileName: string, make: () => Promise<BlobPart>, type: string, toastId: string, ready: string, handed?: () => void): Promise<boolean> {
    const contents = await make()
    const outcome = await downloadFile(fileName, contents, type)
    if (outcome === 'cancelled') {
      return false
    }
    // A refused share hands nothing over until its action does (SaveReminder card: the count stays till then).
    const again = async () => {
      if ((await downloadFile(fileName, contents, type)) !== 'refused') handed?.()
    }
    const retry = outcome === 'refused' ? { label: deps.messages().saveBox.readySave, run: () => void again() } : undefined
    if (outcome !== 'refused') handed?.()
    deps.showToast?.(toastId, ready, 'success', retry)
    return true
  }

  /** `more` are the files made, in order, after the first is handed over (the cover PNG's list pages, ticket 0583, and the
   * Word chart's PNG, ticket 0574): none when there is nothing more to make. */
  async function runExport(make: (project: Project) => Promise<Blob>, extension: 'png' | 'pdf', type: string, more?: (project: Project) => { fileName: string; make: () => Promise<Blob> }[]) {
    const project = deps.currentProject()
    // Exports take the Frame's beads, so with no Frame there is nothing to export (Export asks for one first).
    if (!project || !frameOf(project) || exporting.value) {
      return
    }
    exporting.value = extension
    try {
      const { saveBox } = deps.messages()
      const handed = await makeAndHandOver(
        projectExportFileName(project, extension),
        () => make(project),
        type,
        `export-${extension}`,
        extension === 'png' ? saveBox.readyPng : saveBox.readyPdf,
      )
      for (const next of handed ? (more?.(project) ?? []) : []) {
        if (!(await makeAndHandOver(next.fileName, next.make, type, `export-${extension}-instructions`, saveBox.readyPng))) break
      }
    } finally {
      exporting.value = undefined
    }
  }

  /** The blob type stays JSON though the bytes are gzip: pickers and in-app browsers may grey out an unknown type
   * (ADR 0048). */
  const FILE_TYPE = 'application/json'

  /** Hands a Project file over, and counts the Projects it holds from 0 again once it is handed (ticket 0796). */
  function handOverFile(fileName: string, make: () => Promise<BlobPart>, projectIds: readonly string[]) {
    return makeAndHandOver(fileName, make, FILE_TYPE, 'export-file', deps.messages().saveBox.readyFile, () => deps.onFileSaved?.(projectIds))
  }

  const linking = computed(() => !!deps.fileWriter?.available && !!deps.linkedFiles)
  /** Whether Save as is offered: only where a file can be linked (ADR 0090); elsewhere it is Save. */
  const canSaveAs = linking

  /** The open Project's Linked file's name, for the Project panel's Save row; none without one. */
  const linkedFileName = ref<string>()
  async function readLinkedName(projectId: string | undefined) {
    const file = projectId && linking.value ? await deps.linkedFiles!.get(projectId) : undefined
    if (deps.currentProject()?.id === projectId) linkedFileName.value = file?.name
  }
  watch(() => deps.currentProject()?.id, (id) => void readLinkedName(id), { immediate: true })

  /** The file a Save writes into: the Linked file while it may be written, else one picked in the Save dialog;
   * 'cancelled' when the dialog was closed, 'unavailable' when the browser wouldn't open it. Asked before the file is
   * made, inside the press, as the browser allows a prompt only there. */
  async function fileToWrite(project: Project, again: boolean): Promise<PickedFile | 'cancelled' | 'unavailable'> {
    const current = again ? undefined : await deps.linkedFiles!.get(project.id)
    if (current && (await deps.fileWriter!.ready(current))) return current
    const picked = await deps.fileWriter!.pick(projectFileName(project))
    return picked.kind === 'picked' ? picked.file : picked.kind === 'failed' ? 'unavailable' : 'cancelled'
  }

  /** Save, or with `again` Save as (ADR 0090, ticket 0796), which the Project panel, the save ring and the keys run:
   * into the Linked file where the browser can, else (or if the dialog or write fails) handed over as before. With no
   * Project open it offers the whole library, the way out when a save fails (ticket 158). */
  async function save(again: boolean): Promise<boolean> {
    const project = deps.currentProject()
    if (!project) {
      return onExportLibraryFile()
    }
    const make = async () => packProjectFile(project, await picturesOf([project.id]))
    const target = linking.value ? await fileToWrite(project, again) : 'unavailable'
    if (target === 'cancelled') {
      return false
    }
    if (target !== 'unavailable') {
      const contents = await make()
      if (await deps.fileWriter!.write(target, contents)) {
        await deps.linkedFiles!.put(project.id, target)
        if (deps.currentProject()?.id === project.id) linkedFileName.value = target.name
        deps.onFileSaved?.([project.id])
        deps.showToast?.('export-file', fillBlanks(deps.messages().saveBox.savedFile, { file: target.name }), 'success')
        return true
      }
      return handOverFile(projectFileName(project), async () => contents, [project.id])
    }
    return handOverFile(projectFileName(project), make, [project.id])
  }

  const onSave = () => save(false)
  const onSaveAs = () => save(true)

  // A Project gone from the library takes its Linked file with it; at start, every link of no Project is dropped.
  if (deps.libraryIds && deps.linkedFiles) {
    const store = deps.linkedFiles
    void store.keepOnly(new Set(deps.libraryIds()))
    watch(deps.libraryIds, (now, before) => {
      const kept = new Set(now)
      for (const id of before ?? []) if (!kept.has(id)) void store.remove(id)
    })
  }

  /** Export library: every saved Project in one file, a sealed one from its stored form (ticket 0716). Never linked:
   * it is handed over, and counts every Project from 0 again (ADR 0090). */
  function onExportLibraryFile() {
    const projects = deps.projects()
    const stored = (deps.sealed?.() ?? []).map((project) => project.stored)
    const ids = [...projects.map((project) => project.id), ...(deps.sealed?.() ?? []).map((project) => project.id)]
    return handOverFile(libraryFileName(), async () => packLibraryFile(projects, stored, await picturesOf(ids)), ids)
  }

  /** Export of a sealed Project (the notice's, for the one that didn't open): the file written from its stored form,
   * never decoded (ticket 0716). */
  function onExportSealed(project: SealedProject) {
    return handOverFile(projectFileNameOf(project.name, project.makerName), async () => packStoredProjectFile(project.stored, await picturesOf([project.id])), [project.id])
  }

  function onExportPng() {
    // The words the pictures print (tickets 164, 0583), in the app's language, with the Project's maker's name (ADR 0060).
    // The cover is the first; Beads needed that runs over follows as `_2`, `_3`. The Word chart is PDF pages only (ticket
    // 0586).
    const wordsOf = (project: Project) => printText(project, deps.messages(), deps.locale(), new Date())
    const dpi = pngDpiFor(quality.value)
    return runExport(
      (project) => exportProjectPng(project, wordsOf(project), dpi),
      'png',
      'image/png',
      (project) => {
        const words = wordsOf(project)
        return Array.from({ length: projectPageCount(project, words) - 1 }, (_, index) => ({
          fileName: projectListFileName(project, index + 2),
          make: () => exportProjectPng(project, words, dpi, index + 1),
        }))
      },
    )
  }

  function onExportPdf() {
    // The words the pages print (ticket 162), in the app's language, with the Project's maker's name (ADR 0060).
    return runExport(
      (project) => exportProjectPdf(project, printText(project, deps.messages(), deps.locale(), new Date()), pdfPageDpi()),
      'pdf',
      'application/pdf',
    )
  }

  return { makerName, onSaveMakerName, onSetLetters, exporting, onSave, onSaveAs, canSaveAs, linkedFileName, onExportLibraryFile, onExportSealed, onExportPng, onExportPdf }
}
