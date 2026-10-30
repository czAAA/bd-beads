import { ref } from 'vue'
import type { Project } from '../../domain/project'
import { useDialogs, type Dialogs } from '../shell/useDialogs'

/** A Project of the library as the confirmations name it: decoded or sealed (ticket 0716). */
export interface LibraryEntry {
  id: string
  name: string
  /** Its bead count, when it is over the size gate: picking it warns first (ticket 0716). */
  gatedBeads?: number
}

/** What the Saved Projects confirmations need from the app shell: the library's lookup, open, remove and manual
 * save. */
export interface SavedProjectConfirmsDeps {
  currentProject: () => Project | undefined
  findProject: (id: string) => LibraryEntry | undefined
  openProject: (id: string) => void
  removeProject: (id: string) => void
  /** Writes the library now; false when the device refused it. */
  saveNow: () => boolean
  /** The dialog registry its questions open through (ticket 0618); its own when none is given. */
  dialogs?: Dialogs
}

/** The questions Saved Projects asks before acting on a thumbnail (ticket 232): remove, or "Switch?" like Import
 * (ticket 154). Nothing changes until confirmed. Deps are lazy. */
export function useSavedProjectConfirms(deps: SavedProjectConfirmsDeps) {
  /** The Project whose × was pressed, until the person answers. */
  const dialogs = deps.dialogs ?? useDialogs()
  const pendingRemove = dialogs.question<LibraryEntry>('remove-project')

  /** The Project a thumbnail pick would open, until the person answers. */
  const pendingSwitch = dialogs.question<LibraryEntry>('switch-project')

  /** A Project over the size gate that was picked, until the person opens it anyway or not (ticket 0716). */
  const pendingLargeOpen = dialogs.question<LibraryEntry>('open-large-project')

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

  /** A thumbnail pick: the open Project does nothing, no open Project opens at once, anything else asks; a Project
   * over the size gate asks whether to open it anyway in place of the switch question (ticket 0716). `opened` runs
   * once the Project is showing (or already was). */
  function onRequestSwitch(id: string, opened?: () => void) {
    const current = deps.currentProject()
    if (current?.id === id) {
      opened?.()
      return
    }
    const entry = deps.findProject(id)
    if (entry?.gatedBeads !== undefined) {
      afterSwitch = opened
      pendingLargeOpen.value = entry
      return
    }
    if (!current) {
      deps.openProject(id)
      opened?.()
      return
    }
    if (!entry) {
      return
    }
    const picked = entry
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

  function onCancelLargeOpen() {
    pendingLargeOpen.value = undefined
    afterSwitch = undefined
  }

  /** Open anyway: the gated Project is decoded and opened now. */
  function onConfirmLargeOpen() {
    const picked = pendingLargeOpen.value
    const opened = afterSwitch
    pendingLargeOpen.value = undefined
    afterSwitch = undefined
    if (picked) {
      deps.openProject(picked.id)
      opened?.()
    }
  }

  /** Save first, offered when the last save failed: the modal turns to the plain question once it gets through, or
   * says so if it didn't. */
  function onSaveBeforeSwitch() {
    switchSaveRefused.value = !deps.saveNow()
  }

  return {
    pendingRemove,
    pendingSwitch,
    pendingLargeOpen,
    switchSaveRefused,
    onRequestRemove,
    onCancelRemove,
    onConfirmRemove,
    onRequestSwitch,
    onCancelSwitch,
    onConfirmSwitch,
    onSaveBeforeSwitch,
    onCancelLargeOpen,
    onConfirmLargeOpen,
  }
}
