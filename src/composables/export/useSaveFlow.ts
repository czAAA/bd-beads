import type { Project } from '../../domain/project'
import { projectFileName } from '../../domain/projectFile'
import type { Translations } from '../../i18n/translations'
import { packProjectFile } from '../../services/projectFileCodec'
import { downloadFile as browserDownloadFile, type DownloadFile } from '../../services/fileDownload'

/** What saving needs from the app shell: the open Project, the library's write, the language and the toasts. */
export interface SaveFlowDeps {
  currentProject: () => Project | undefined
  saveNow: () => boolean
  messages: () => Translations
  showToast: (id: string, text: string) => void
  dismissToast: (id: string) => void
  /** How the Project file is handed over (ADR 0020); the browser's by default. */
  downloadFile?: DownloadFile
}

/** The "Saved" toast (tickets 115, 76): raised only by a write that landed; a refused one raises the library's
 * saveFailed. */
const SAVED_TOAST = 'save-confirmation'

/** Save and its confirmation (tickets 115, 119, 195; ADR 0020). Deps are read lazily. */
export function useSaveFlow(deps: SaveFlowDeps) {
  const downloadFile = deps.downloadFile ?? browserDownloadFile

  function clearSavedConfirmation() {
    deps.dismissToast(SAVED_TOAST)
  }

  // Save (ticket 115): edits already reach the device (ADR 0012), so this writes what is pending and claims "Saved"
  // only once it got through (else saveFailed). It also hands over the open Project as a file (ticket 119), even when
  // the write is refused: then it is the only surviving copy.
  function onSave() {
    clearSavedConfirmation()
    if (!deps.currentProject()) {
      return
    }

    const saveSucceeded = deps.saveNow()
    // Read again: the write stamps the Project's savedAt, and the file carries it.
    const project = deps.currentProject()!
    void packProjectFile(project).then((bytes) => downloadFile(projectFileName(project), bytes))
    if (!saveSucceeded) {
      return
    }

    deps.showToast(SAVED_TOAST, deps.messages().tools.savedConfirmation)
  }

  return { onSave, clearSavedConfirmation }
}
