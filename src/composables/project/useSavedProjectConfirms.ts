import { ref } from 'vue'
import type { Project } from '../../domain/project'

/** What the Saved Projects confirmations need from the app shell: the library's lookup, open, remove and manual save. */
export interface SavedProjectConfirmsDeps {
  currentProject: () => Project | undefined
  findProject: (id: string) => Project | undefined
  openProject: (id: string) => void
  removeProject: (id: string) => void
  /** Writes the library now; false when the device refused it. */
  saveNow: () => boolean
}

/**
 * The questions Saved Projects asks before acting on a thumbnail (ticket 232): remove asks "Remove this Project?" and
 * picking a different one asks "Switch?", the same confirmation Import uses (ticket 154). Nothing changes until the
 * person confirms. Deps are read lazily.
 */
export function useSavedProjectConfirms(deps: SavedProjectConfirmsDeps) {
  /** The Project whose × was pressed, until the person answers. */
  const pendingRemove = ref<Project | undefined>()

  /** The Project a thumbnail pick would open, until the person answers. */
  const pendingSwitch = ref<Project | undefined>()

  /** What to do once a confirmed switch has opened its Project (the phone drawer puts its sheets away). */
  let afterSwitch: (() => void) | undefined

  /** Whether Save first was tried and the device refused it too. */
  const switchSaveRefused = ref(false)

  function onRequestRemove(id: string) {
    pendingRemove.value = deps.findProject(id)
  }

  function onCancelRemove() {
    pendingRemove.value = undefined
  }

  function onConfirmRemove() {
    const project = pendingRemove.value
    pendingRemove.value = undefined
    if (project) {
      deps.removeProject(project.id)
    }
  }

  /** A thumbnail pick: the open Project does nothing, no open Project opens at once, anything else asks. `opened` runs once the Project is showing (or already was). */
  function onRequestSwitch(id: string, opened?: () => void) {
    const current = deps.currentProject()
    if (current?.id === id) {
      opened?.()
      return
    }
    if (!current) {
      deps.openProject(id)
      opened?.()
      return
    }
    const picked = deps.findProject(id)
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
      deps.openProject(picked.id)
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
