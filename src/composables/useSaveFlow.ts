import type { Pattern } from '../domain/pattern'
import { patternFileName, serializePattern } from '../domain/patternFile'
import type { Translations } from '../i18n/translations'
import { downloadFile as browserDownloadFile, type DownloadFile } from '../services/fileDownload'

/** What saving needs from the app shell: the open Pattern, the library's write, the language and the toasts. */
export interface SaveFlowDeps {
  currentPattern: () => Pattern | undefined
  saveNow: () => boolean
  messages: () => Translations
  showToast: (id: string, text: string) => void
  dismissToast: (id: string) => void
  /** How the Pattern file is handed over (ADR 0020); the browser's by default. */
  downloadFile?: DownloadFile
}

/**
 * The "Saved" toast (tickets 115, 76; SaveStates card). Only ever raised by a write that landed; a refused one raises
 * the library's saveFailed instead.
 */
const SAVED_TOAST = 'save-confirmation'

/** Save and its confirmation (tickets 115, 119, 195; ADR 0023). Deps are read lazily. */
export function useSaveFlow(deps: SaveFlowDeps) {
  const downloadFile = deps.downloadFile ?? browserDownloadFile

  function clearSavedConfirmation() {
    deps.dismissToast(SAVED_TOAST)
  }

  /**
   * Save (ticket 115): edits already reach this device as they land (ADR 0012), so the write to this device is
   * reassurance rather than a new kind of storage — it writes whatever is pending now and says so. "Saved" is only
   * claimed once the write got through; if the device refuses it the library's own "couldn't save" notice shows instead
   * (saveFailed). A second press starts the confirmation's clock over.
   *
   * Save also hands over the open Pattern as a Pattern file (ticket 119), so it can be opened on another device. The
   * file goes out even when the device refuses the write: it is then the only copy that survives.
   */
  function onSave() {
    clearSavedConfirmation()
    if (!deps.currentPattern()) {
      return
    }

    const saveSucceeded = deps.saveNow()
    // Read again: the write stamps the Pattern's savedAt, and the file carries it.
    const pattern = deps.currentPattern()!
    downloadFile(patternFileName(pattern), serializePattern(pattern))
    if (!saveSucceeded) {
      return
    }

    deps.showToast(SAVED_TOAST, deps.messages().tools.savedConfirmation)
  }

  return { onSave, clearSavedConfirmation }
}
