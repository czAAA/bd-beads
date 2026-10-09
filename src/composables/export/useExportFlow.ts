import { ref, toRaw } from 'vue'
import type { Project } from '../../domain/project'
import { libraryFileName, projectExportFileName, projectFileName, serializeLibrary, serializeProject } from '../../domain/projectFile'
import type { Locale, Translations } from '../../i18n/translations'
import { exportProjectPdf, exportProjectPng } from '../../rendering/projectExport'
import { printText } from '../../rendering/printText'
import { downloadFile as browserDownloadFile, sharesFromTap as browserSharesFromTap, type DownloadFile } from '../../services/fileDownload'
import { browserMakerNameStore, type MakerNameStore } from '../../services/makerNameStore'
import type { MessageTone, Toast } from '../ui/useToasts'
import { useQrExport } from './useQrExport'

/** What exporting needs from the app shell: the open Project and the library, the code's settled Project, and the app's language. */
export interface ExportFlowDeps {
  currentProject: () => Project | undefined
  projects: () => Project[]
  /** The open Project for the QR code, which waits for a stroke to end (see useSettledProject). */
  shareableProject: () => Project | undefined
  messages: () => Translations
  locale: () => Locale
  /** How a file is handed over, and where the maker's name is kept (ADR 0020); the browser's by default. */
  downloadFile?: DownloadFile
  makerNameStore?: MakerNameStore
  /** Whether handing over this file opens a share sheet, which only a fresh tap may start (ticket 306); the browser's by default. */
  sharesFromTap?: (fileName: string, type: string) => boolean
  /** Shows a toast with an action (useToasts). */
  showToast?: (id: string, text: string, tone?: MessageTone, action?: Toast['action']) => void
}

/**
 * Exporting a Project (tickets 68, 73, 74, 158, 161, 202; ADR 0020): as a Project file, a PNG, a PDF or a QR code, and
 * the maker's name the PNG and PDF print. QR is useQrExport's own; this composable builds on it. Deps are read lazily.
 */
export function useExportFlow(deps: ExportFlowDeps) {
  const downloadFile = deps.downloadFile ?? browserDownloadFile
  const sharesFromTap = deps.sharesFromTap ?? browserSharesFromTap
  const makerNameStore = deps.makerNameStore ?? browserMakerNameStore

  /**
   * QR export (ticket 68, 116): the Toolbox's Edit group opens the panel and App shows it, so its state lives outside
   * either. The code reads every bead of the Project, so it waits for a stroke to end rather than being worked out on
   * each step of it.
   */
  const qrExport = useQrExport(deps.shareableProject)

  /**
   * The maker's name for the PDF and PNG exports (ticket 161; CONTEXT.md): kept on this device like the theme, set from
   * the Export menu's last row through its modal.
   */
  const makerName = ref(makerNameStore.load())
  const nameOnExportsOpen = ref(false)

  function onSaveMakerName(name: string) {
    makerName.value = makerNameStore.save(name)
    nameOnExportsOpen.value = false
  }

  /** Which export is being drawn, if any: the save box says so while it takes a while (ticket 158). Drawing a large Project takes a moment, so the buttons wait until it is done. */
  const exporting = ref<'png' | 'pdf' | undefined>()

  async function runExport(make: (project: Project) => Promise<Blob>, extension: 'png' | 'pdf', type: string) {
    const project = deps.currentProject()
    // Exports take the Frame's beads, so with no Frame there is nothing to export (Export asks for one first).
    if (!project?.frame || exporting.value) {
      return
    }
    exporting.value = extension
    try {
      // Read as the Project itself, as the QR export does: drawing reads every bead.
      const fileName = projectExportFileName(project, extension)
      const blob = await make(toRaw(project))
      if (deps.showToast && sharesFromTap(fileName, type)) {
        // Drawing took the tap that began the export, and Safari shares only from a tap: so the toast's action is the new tap.
        const { saveBox } = deps.messages()
        deps.showToast(`export-${extension}`, extension === 'png' ? saveBox.readyPng : saveBox.readyPdf, 'success', {
          label: saveBox.readySave,
          run: () => downloadFile(fileName, blob, type),
        })
      } else {
        downloadFile(fileName, blob, type)
      }
    } finally {
      exporting.value = undefined
    }
  }

  /**
   * Export Project as the way out (ticket 158; forms-and-states.md): the open Project as a Project file, offered when a
   * save fails and when a Project is too large for a QR code. With none open, a failed save offers the whole library.
   */
  function onExportProjectFile() {
    const project = deps.currentProject()
    if (project) {
      downloadFile(projectFileName(project), serializeProject(project))
    } else {
      downloadFile(libraryFileName(), serializeLibrary(deps.projects()))
    }
  }

  /** Export library: every saved Project in one file. */
  function onExportLibraryFile() {
    downloadFile(libraryFileName(), serializeLibrary(deps.projects()))
  }

  function onExportPng() {
    // The words the picture prints (ticket 164), in the app's language, with the maker's name (ticket 161).
    return runExport(
      (project) => exportProjectPng(project, printText(project, deps.messages(), deps.locale(), makerName.value, new Date())),
      'png',
      'image/png',
    )
  }

  function onExportPdf() {
    // The words the pages print (ticket 162), in the app's language, with the maker's name (ticket 161).
    return runExport(
      (project) => exportProjectPdf(project, printText(project, deps.messages(), deps.locale(), makerName.value, new Date())),
      'pdf',
      'application/pdf',
    )
  }

  return { qrExport, makerName, nameOnExportsOpen, onSaveMakerName, exporting, onExportProjectFile, onExportLibraryFile, onExportPng, onExportPdf }
}
