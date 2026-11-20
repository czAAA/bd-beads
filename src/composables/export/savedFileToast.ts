import { fillBlanks } from '../../domain/fillBlanks'
import type { Translations } from '../../i18n/translations'
import type { HandOver } from '../../services/fileDownload'
import type { MessageTone, Toast } from '../ui/useToasts'

/** The id every saved-file toast shows under, so a new save replaces the last one's toast. */
const SAVED_FILE_TOAST = 'saved-file'

/** How a file reached the device, which the toast says since the page never learns the folder (ticket 1139): by a
 * download link, through the share sheet, or written into a picked or Linked file. */
export type SavedRoute = Extract<HandOver, 'downloaded' | 'shared'> | 'written'

type ShowToast = (id: string, text: string, tone?: MessageTone, action?: Toast['action']) => void

/** The one toast every file that reaches the device shows (ticket 0859), naming it and where it went by its route
 * ("Saved to Downloads: sunflower.png", ticket 1139). One maker, so no save words its own. A share refused for want of a
 * fresh tap names the file with Save as its action, and says where once that tap lands. */
export function savedFileToast(show: ShowToast | undefined, messages: () => Translations) {
  function saved(fileName: string, route: SavedRoute) {
    show?.(SAVED_FILE_TOAST, fillBlanks(messages().saveBox.savedFile[route], { file: fileName }), 'success')
  }

  /** `save` hands the file over again and answers its route, or nothing when it was refused or cancelled. */
  function readyToSave(fileName: string, save: () => Promise<SavedRoute | undefined>) {
    const run = () => void save().then((route) => route && saved(fileName, route))
    show?.(SAVED_FILE_TOAST, fillBlanks(messages().saveBox.readyToSave, { file: fileName }), 'success', { label: messages().saveBox.readySave, run })
  }

  return { saved, readyToSave }
}
