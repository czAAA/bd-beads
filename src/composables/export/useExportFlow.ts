import { computed, ref, toRaw } from 'vue'
import { withMakerName } from '../../domain/makerName'
import { withLetters, type Project } from '../../domain/project'
import { libraryFileName, projectExportFileName, projectFileName, projectListFileName } from '../../domain/projectFile'
import type { Locale, Translations } from '../../i18n/translations'
import { pdfPageDpi, pngDpiFor } from '../../rendering/exportDpi'
import { exportProjectPdf, exportProjectPng, projectPageCount } from '../../rendering/projectExport'
import { printText } from '../../rendering/printText'
import { downloadFile as browserDownloadFile, type DownloadFile } from '../../services/fileDownload'
import { packLibraryFile, packProjectFile } from '../../services/projectFileCodec'
import { useExportQuality } from './useExportQuality'
import type { MessageTone, Toast } from '../ui/useToasts'

/** What exporting needs from the app shell: the open Project and the library, and the app's language. */
export interface ExportFlowDeps {
  currentProject: () => Project | undefined
  projects: () => Project[]
  messages: () => Translations
  locale: () => Locale
  /** Saves the open Project with its new maker's name; the name is not an undo step (ADR 0060). */
  replaceProject: (project: Project) => void
  /** How a file is handed over (ADR 0020); the browser's by default. */
  downloadFile?: DownloadFile
  /** Shows a toast with an action (useToasts). */
  showToast?: (id: string, text: string, tone?: MessageTone, action?: Toast['action']) => void
}

/** Exporting a Project (tickets 68, 73, 74, 158, 161, 202; ADR 0020) as a Project file, PNG or PDF, printing the
 * maker's name (ADR 0060). Deps are lazy. */
export function useExportFlow(deps: ExportFlowDeps) {
  const downloadFile = deps.downloadFile ?? browserDownloadFile
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
    if (project && (project.letters === true) !== on) {
      deps.replaceProject(withLetters(project, on))
    }
  }

  /** Which export is being drawn, if any: the save box says so while it takes a while (ticket 158). Drawing a large
   * Project takes a moment, so the buttons wait until it is done. */
  const exporting = ref<'png' | 'pdf' | undefined>()

  /** Makes a file and hands it over inside the tap, then says it is ready (ticket 523). Safari shares only from a
   * fresh tap, so when it refuses because the build took too long the toast's action is the new tap (ticket 306). */
  async function makeAndHandOver(fileName: string, make: () => Promise<BlobPart>, type: string, toastId: string, ready: string): Promise<boolean> {
    const contents = await make()
    const outcome = await downloadFile(fileName, contents, type)
    if (outcome === 'cancelled') {
      return false
    }
    const retry = outcome === 'refused' ? { label: deps.messages().saveBox.readySave, run: () => void downloadFile(fileName, contents, type) } : undefined
    deps.showToast?.(toastId, ready, 'success', retry)
    return true
  }

  /** `more` are the files made, in order, after the first is handed over (the cover PNG's list pages, ticket 0583, and the
   * Word chart's PNG, ticket 0574): none when there is nothing more to make. */
  async function runExport(make: (project: Project) => Promise<Blob>, extension: 'png' | 'pdf', type: string, more?: (project: Project) => { fileName: string; make: () => Promise<Blob> }[]) {
    const project = deps.currentProject()
    // Exports take the Frame's beads, so with no Frame there is nothing to export (Export asks for one first).
    if (!project?.frame || exporting.value) {
      return
    }
    exporting.value = extension
    try {
      // Read as the Project itself: drawing reads every bead.
      const { saveBox } = deps.messages()
      const handed = await makeAndHandOver(
        projectExportFileName(project, extension),
        () => make(toRaw(project)),
        type,
        `export-${extension}`,
        extension === 'png' ? saveBox.readyPng : saveBox.readyPdf,
      )
      for (const next of handed ? (more?.(toRaw(project)) ?? []) : []) {
        if (!(await makeAndHandOver(next.fileName, next.make, type, `export-${extension}-instructions`, saveBox.readyPng))) break
      }
    } finally {
      exporting.value = undefined
    }
  }

  /** The blob type stays JSON though the bytes are gzip: pickers and in-app browsers may grey out an unknown type
   * (ADR 0048). */
  const FILE_TYPE = 'application/json'

  function handOverFile(fileName: string, make: () => Promise<BlobPart>) {
    return makeAndHandOver(fileName, make, FILE_TYPE, 'export-file', deps.messages().saveBox.readyFile)
  }

  /** Export Project as the way out (ticket 158): offered when a save fails; with no Project open, it offers the
   * whole library. */
  function onExportProjectFile() {
    const project = deps.currentProject()
    if (project) {
      return handOverFile(projectFileName(project), () => packProjectFile(project))
    }
    return onExportLibraryFile()
  }

  /** Export library: every saved Project in one file. */
  function onExportLibraryFile() {
    const projects = deps.projects()
    return handOverFile(libraryFileName(), () => packLibraryFile(projects))
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

  return { makerName, onSaveMakerName, onSetLetters, exporting, onExportProjectFile, onExportLibraryFile, onExportPng, onExportPdf }
}
