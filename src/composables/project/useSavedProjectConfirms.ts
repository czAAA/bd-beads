import { ref } from 'vue'
import type { Project } from '../../domain/project'
import { useDialogs, type Dialogs } from '../shell/useDialogs'
import { fillBlanks } from '../../domain/fillBlanks'
import type { Translations } from '../../i18n/translations'
import type { MessageTone } from '../ui/useToasts'

/** A Project of the library as the confirmations name it: decoded or sealed (ticket 0716). */
export interface LibraryEntry {
  id: string
  name: string
  /** Its bead count, when it is over the size gate: picking it warns first (ticket 0716). */
  gatedBeads?: number
}

/** What the Saved Projects confirmations need from the app shell: the library's lookup, open and manual save. */
export interface SavedProjectConfirmsDeps {
  currentProject: () => Project | undefined
  findProject: (id: string) => LibraryEntry | undefined
  openProject: (id: string) => void
  /** Whether the library's last write was refused: only then does a switch ask first (ticket 0860). */
  saveFailed: () => boolean
  /** Writes the library now; false when the device refused it. */
  saveNow: () => Promise<boolean>
  /** Whether the strip shows no Project name (under 1024px): then an open says the name in a toast (ticket 0986). */
  nameHidden: () => boolean
  showToast: (id: string, text: string, tone?: MessageTone) => void
  messages: () => Translations
  /** The dialog registry its questions open through (ticket 0618); its own when none is given. */
  dialogs?: Dialogs
}

/** The questions Saved Projects asks before opening a thumbnail's Project (ticket 232): a pick opens at once, and asks
 * "Switch Project?" only when the last save failed, as nothing else can be lost (ticket 0860). Its × asks
 * useDeleteProjectFlow's question (ticket 0842). Deps are lazy. */
export function useSavedProjectConfirms(deps: SavedProjectConfirmsDeps) {
  const dialogs = deps.dialogs ?? useDialogs()

  /** The Project a thumbnail pick would open while the last save failed, until the person answers. */
  const pendingSwitch = dialogs.question<LibraryEntry>('switch-project')

  /** A Project over the size gate that was picked, until the person opens it anyway or not (ticket 0716). */
  const pendingLargeOpen = dialogs.question<LibraryEntry>('open-large-project')

  /** What to do once a confirmed switch has opened its Project (the phone drawer puts its sheets away). */
  let afterSwitch: (() => void) | undefined

  /** Opens the picked Project and, where the strip shows no name, says which one is open now (ticket 0986). */
  function open(entry: LibraryEntry) {
    deps.openProject(entry.id)
    if (deps.nameHidden()) deps.showToast('opened', fillBlanks(deps.messages().panels.project.openedToast, { name: entry.name }), 'info')
  }

  /** Whether Save first was tried and the device refused it too. */
  const switchSaveRefused = ref(false)

  /** A thumbnail pick: the open Project does nothing, another opens at once unless the last save failed, which asks
   * first; a Project over the size gate asks whether to open it anyway in place of that (ticket 0716). `opened` runs
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
    if (!entry) {
      if (current) return
      deps.openProject(id)
      opened?.()
      return
    }
    if (!current || !deps.saveFailed()) {
      open(entry)
      opened?.()
      return
    }
    switchSaveRefused.value = false
    afterSwitch = opened
    pendingSwitch.value = entry
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
      open(picked)
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
      open(picked)
      opened?.()
    }
  }

  /** Save first, the question's side action: once the save gets through the switch goes ahead, as a pick does when
   * nothing can be lost; otherwise the question says it didn't. */
  async function onSaveBeforeSwitch() {
    switchSaveRefused.value = !(await deps.saveNow())
    if (!switchSaveRefused.value) onConfirmSwitch()
  }

  return {
    pendingSwitch,
    pendingLargeOpen,
    switchSaveRefused,
    onRequestSwitch,
    onCancelSwitch,
    onConfirmSwitch,
    onSaveBeforeSwitch,
    onCancelLargeOpen,
    onConfirmLargeOpen,
  }
}
