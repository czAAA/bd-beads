import { fillBlanks } from '../../domain/fillBlanks'
import type { Translations } from '../../i18n/translations'
import type { MessageTone, Toast } from '../ui/useToasts'

/** The id every saved-file toast shows under, so a new save replaces the last one's toast. */
export const SAVED_FILE_TOAST = 'saved-file'

/** The id of a further page's toast (a PNG's list pages, `_2`, `_3`), so it stacks under the cover's. */
export const savedPageToast = (page: number) => `${SAVED_FILE_TOAST}-${page}`

type ShowToast = (id: string, text: string, tone?: MessageTone, action?: Toast['action']) => void

/** The one toast every file that reaches the device shows (ticket 0859): a Project file, a PNG or a PDF, by download,
 * share or into a picked file, named the same way ("Saved: sunflower.png"). One maker, so no save words its own. A
 * share refused for want of a fresh tap names the file with Save as its action, and says Saved once that tap lands. */
export function savedFileToast(show: ShowToast | undefined, messages: () => Translations) {
  function saved(fileName: string, id = SAVED_FILE_TOAST) {
    show?.(id, fillBlanks(messages().saveBox.savedFile, { file: fileName }), 'success')
  }

  function readyToSave(fileName: string, save: () => Promise<boolean>, id = SAVED_FILE_TOAST) {
    const run = () => void save().then((done) => done && saved(fileName, id))
    show?.(id, fillBlanks(messages().saveBox.readyToSave, { file: fileName }), 'success', { label: messages().saveBox.readySave, run })
  }

  return { saved, readyToSave }
}
