import { ref } from 'vue'
import type { Translations } from '../../i18n/translations'
import type { DevicePreferences } from '../../services/devicePreferences'
import type { PersistentStorage } from '../../services/persistentStorage'
import type { MessageTone } from '../ui/useToasts'

/** What the storage ask needs from the app shell: the browser's storage, the device's preferences, and a way to say
 * the browser's yes. */
export interface StorageAskFlowDeps {
  persistentStorage: PersistentStorage
  devicePreferences: DevicePreferences
  messages: () => Translations
  showToast: (id: string, text: string, tone?: MessageTone) => void
}

// Asking the browser to keep the library (tickets 399, 0839, 0936): never on open or on creating a Project; at the first
// file or export, if not kept, once, with no question of the app's first. A yes is said in a toast; a no says nothing,
// as the Save reminder carries the advice. Nothing here can fail a save.
export function useStorageAskFlow(deps: StorageAskFlowDeps) {
  const asked = deps.devicePreferences.get('storageNoteSeen')
  /** Whether a check is under way or has found nothing to ask, so later files don't repeat it. */
  let settled = false

  /** Whether the browser keeps the library, for the Menu row; undefined where it can't say, and the row is absent. */
  const kept = ref<boolean | undefined>()
  void deps.persistentStorage.persisted().then((persisted) => void (kept.value ??= persisted))

  /** Called after each Project file or export reaches the device: the first one on a device, with the library not
   * yet kept, asks the browser. */
  function onFileReached() {
    if (settled || asked.value) return
    settled = true
    void deps.persistentStorage.persisted().then((persisted) => {
      if (persisted === false) void ask()
    })
  }

  /** Asks the browser and keeps its answer for the Menu row; only a yes is said (ticket 0936). No answer says
   * nothing. */
  async function ask() {
    asked.value = true
    const answer = await deps.persistentStorage.persist()
    if (answer === undefined) return
    kept.value = answer
    if (answer) deps.showToast('storage-kept', deps.messages().storage.keptToast, 'success')
  }

  return { kept, onFileReached }
}
