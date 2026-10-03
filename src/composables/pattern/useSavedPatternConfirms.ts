import { ref } from 'vue'
import type { Pattern } from '../../domain/pattern'

/** What the Saved Patterns confirmations need from the app shell: the library's lookup, open, remove and manual save. */
export interface SavedPatternConfirmsDeps {
  currentPattern: () => Pattern | undefined
  findPattern: (id: string) => Pattern | undefined
  openPattern: (id: string) => void
  removePattern: (id: string) => void
  /** Writes the library now; false when the device refused it. */
  saveNow: () => boolean
}

/**
 * The questions Saved Patterns asks before acting on a thumbnail (ticket 232): remove asks "Remove this Pattern?" and
 * picking a different one asks "Switch?", the same confirmation Import uses (ticket 154). Nothing changes until the
 * person confirms. Deps are read lazily.
 */
export function useSavedPatternConfirms(deps: SavedPatternConfirmsDeps) {
  /** The Pattern whose × was pressed, until the person answers. */
  const pendingRemove = ref<Pattern | undefined>()

  /** The Pattern a thumbnail pick would open, until the person answers. */
  const pendingSwitch = ref<Pattern | undefined>()

  /** What to do once a confirmed switch has opened its Pattern (the phone drawer puts its sheets away). */
  let afterSwitch: (() => void) | undefined

  /** Whether Save first was tried and the device refused it too. */
  const switchSaveRefused = ref(false)

  function onRequestRemove(id: string) {
    pendingRemove.value = deps.findPattern(id)
  }

  function onCancelRemove() {
    pendingRemove.value = undefined
  }

  function onConfirmRemove() {
    const pattern = pendingRemove.value
    pendingRemove.value = undefined
    if (pattern) {
      deps.removePattern(pattern.id)
    }
  }

  /** A thumbnail pick: the open Pattern does nothing, no open Pattern opens at once, anything else asks. `opened` runs once the Pattern is showing (or already was). */
  function onRequestSwitch(id: string, opened?: () => void) {
    const current = deps.currentPattern()
    if (current?.id === id) {
      opened?.()
      return
    }
    if (!current) {
      deps.openPattern(id)
      opened?.()
      return
    }
    const picked = deps.findPattern(id)
    if (!picked) {
      return
    }
    switchSaveRefused.value = false
    afterSwitch = opened
    pendingSwitch.value = picked
  }

  function onCancelSwitch() {
    pendingSwitch.value = undefined
    afterSwitch = undefined
  }

  function onConfirmSwitch() {
    const picked = pendingSwitch.value
    const opened = afterSwitch
    pendingSwitch.value = undefined
    afterSwitch = undefined
    if (picked) {
      deps.openPattern(picked.id)
      opened?.()
    }
  }

  /** Save first, offered when the last save failed: the modal turns to the plain question once it gets through, or says so if it didn't. */
  function onSaveBeforeSwitch() {
    switchSaveRefused.value = !deps.saveNow()
  }

  return {
    pendingRemove,
    pendingSwitch,
    switchSaveRefused,
    onRequestRemove,
    onCancelRemove,
    onConfirmRemove,
    onRequestSwitch,
    onCancelSwitch,
    onConfirmSwitch,
    onSaveBeforeSwitch,
  }
}
