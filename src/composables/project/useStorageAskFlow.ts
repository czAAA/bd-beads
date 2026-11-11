import { ref } from 'vue'
import type { Translations } from '../../i18n/translations'
import type { DevicePreferences } from '../../services/devicePreferences'
import type { PersistentStorage } from '../../services/persistentStorage'
import { useDialogs, type Dialogs } from '../shell/useDialogs'
import type { MessageTone, Toast } from '../ui/useToasts'

/** What the storage ask needs from the app shell: the browser's storage, the device's preferences, and a way to say
 * the browser's answer and to save the open Project's file after a no. */
export interface StorageAskFlowDeps {
  persistentStorage: PersistentStorage
  devicePreferences: DevicePreferences
  /** The dialog registry its questions open through (ticket 0618); its own when none is given. */
  dialogs?: Dialogs
  messages: () => Translations
  showToast: (id: string, text: string, tone?: MessageTone, action?: Toast['action'], options?: { persistent?: boolean }) => void
  /** The open Project, whose Project file the Message after a no saves; none with none open. */
  openProjectId: () => string | undefined
  /** Save Project file for a Project of the library (useExportFlow's `onSaveFileOf`, ticket 0842). */
  saveFileOf: (id: string) => Promise<boolean>
}

// Asking the browser to keep the library (tickets 399, 0839): never on open or on creating a Project; at the first
// Project file or export, if not already kept, a note asks once, and the browser's answer is said. Nothing here can
// fail a save.
export function useStorageAskFlow(deps: StorageAskFlowDeps) {
  /** Whether the note before the browser's prompt is open. */
  const storageNoteOpen = (deps.dialogs ?? useDialogs()).flag('keep-note')

  const asked = deps.devicePreferences.get('storageNoteSeen')
  /** Whether a check is under way or has found nothing to ask, so later files don't repeat it. */
  let settled = false

  /** Whether the browser keeps the library, for the Menu row; undefined where it can't say, and the row is absent. */
  const kept = ref<boolean | undefined>()
  void deps.persistentStorage.persisted().then((persisted) => void (kept.value ??= persisted))

  /** Called after each Project file or export reaches the device: the first one on a device, with the library not
   * yet kept, opens the note. */
  function onFileReached() {
    if (settled || asked.value) return
    settled = true
    void deps.persistentStorage.persisted().then((persisted) => {
      if (persisted === false) storageNoteOpen.value = true
    })
  }

  /** Asks the browser, now that the person pressed, and says its answer: a toast on yes, a Message on no that stays
   * and saves the open Project's file (ticket 0839). No answer says nothing. */
  async function ask() {
    asked.value = true
    const answer = await deps.persistentStorage.persist()
    if (answer === undefined) return
    kept.value = answer
    const { storage, panels } = deps.messages()
    if (answer) {
      deps.showToast('storage-kept', storage.keptToast, 'success')
      return
    }
    const id = deps.openProjectId()
    const save = id ? { label: panels.project.saveFile, run: () => void deps.saveFileOf(id) } : undefined
    deps.showToast('storage-kept', storage.notKeptMessage, 'warning', save, { persistent: true })
  }

  /** Keep Projects: the note closes and the browser is asked. */
  function onConfirmStorageNote() {
    storageNoteOpen.value = false
    void ask()
  }

  /** Not now: the browser isn't asked, and the note doesn't come back; the Menu row still asks. */
  function onCancelStorageNote() {
    storageNoteOpen.value = false
    asked.value = true
  }

  /** The Menu row "Keep Projects on this device": asks the browser again, whatever it answered before. */
  function onAskToKeep() {
    void ask()
  }

  return { storageNoteOpen, kept, onFileReached, onConfirmStorageNote, onCancelStorageNote, onAskToKeep }
}
