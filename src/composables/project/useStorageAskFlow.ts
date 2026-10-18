import { ref } from 'vue'
import type { DevicePreferences } from '../../services/devicePreferences'
import type { PersistentStorage } from '../../services/persistentStorage'

/** What the storage ask needs from the app shell: the browser's storage and the device's preferences. */
export interface StorageAskFlowDeps {
  persistentStorage: PersistentStorage
  devicePreferences: DevicePreferences
}

// Asking the browser to keep the library (ticket 399): never on open; on the first write, if not already kept, a note
// explains and its button triggers the prompt. Shown once whatever the answer; nothing here can fail a save.
export function useStorageAskFlow(deps: StorageAskFlowDeps) {
  /** Whether the note before the browser's prompt is open. */
  const storageNoteOpen = ref(false)

  const asked = deps.devicePreferences.get('storageNoteSeen')
  /** Whether a check is under way or has found nothing to ask, so later saves don't repeat it. */
  let settled = false

  /** Called after each write of the library: the first one on a device, with the library not yet kept, opens the
   * note. */
  function onLibrarySaved() {
    if (settled || asked.value) return
    settled = true
    void deps.persistentStorage.persisted().then((persisted) => {
      if (persisted === false) storageNoteOpen.value = true
    })
  }

  /** The note's button: remembers the note was shown, and now the browser may show its own prompt. */
  function onConfirmStorageNote() {
    storageNoteOpen.value = false
    asked.value = true
    void deps.persistentStorage.persist()
  }

  /** Skip: the browser isn't asked, and the note doesn't come back. */
  function onCancelStorageNote() {
    storageNoteOpen.value = false
    asked.value = true
  }

  return { storageNoteOpen, onLibrarySaved, onConfirmStorageNote, onCancelStorageNote }
}
