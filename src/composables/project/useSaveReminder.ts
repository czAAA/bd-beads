import { onScopeDispose, ref, watch } from 'vue'
import { labelStep, SAVE_THRESHOLD, saveThreshold, staleOnOpen, type SinceFile } from '../../domain/beadsSinceFile'
import type { PersistentStorage } from '../../services/persistentStorage'

/** What the save ring needs from the app shell: the open Project's count, whether the browser keeps storage, and
 * whether something is going on that the ring must not interrupt. */
export interface SaveReminderDeps {
  /** The open Project's id and creation time; none with no Project open. */
  project: () => { id: string; createdAt: number } | undefined
  /** The open Project's Beads since last file (useBeadsSinceFile). */
  since: () => SinceFile
  persistentStorage: PersistentStorage
  /** A stroke is under way, or a panel, sheet, dialog or Adjust is open: the ring and its label wait. */
  busy: () => boolean
  /** Said once each time the label opens, in the polite live region. */
  announce: (beads: number) => void
  now?: () => number
}

/** No stroke, Fill or paste has landed for this long before the ring appears or its label opens. */
const IDLE_MS = 3000
/** How long the label stays open (`--save-ring-label-time`). */
const LABEL_MS = 4000
/** How long after the pointer or focus leaves a held label closes. */
const LEAVE_MS = 1000

/** The save ring (SaveReminder card, ticket 0796): shown once the open Project's Beads since last file reaches the
 * threshold (50, or 100 where the browser keeps storage), and its label "Save a copy +n" opened for a moment as it
 * appears, at every further 100 beads and when a Project 7 days behind opens; never mid-stroke or over an open panel. */
export function useSaveReminder(deps: SaveReminderDeps) {
  const now = deps.now ?? Date.now
  const threshold = ref(SAVE_THRESHOLD)
  void deps.persistentStorage.persisted().then((persisted) => void (threshold.value = saveThreshold(persisted === true)))

  const shown = ref(false)
  const labelOpen = ref(false)
  /** The highest label step reached since the Project opened: Undo then Redo past it opens nothing again. */
  let reached = -1
  let lastLanded = -Infinity
  let pendingAppear = false
  let pendingLabel = false
  let held = false
  let idleTimer: ReturnType<typeof setTimeout> | undefined
  let closeTimer: ReturnType<typeof setTimeout> | undefined

  function closeLabel() {
    clearTimeout(closeTimer)
    labelOpen.value = false
  }

  function openLabel() {
    labelOpen.value = true
    deps.announce(deps.since().beads)
    clearTimeout(closeTimer)
    if (!held) closeTimer = setTimeout(closeLabel, LABEL_MS)
  }

  /** Shows the ring and opens the label once nothing has landed for a while and nothing is open; else waits. */
  function settle() {
    clearTimeout(idleTimer)
    if (!pendingAppear && !pendingLabel) return
    const wait = lastLanded + IDLE_MS - now()
    if (wait > 0) {
      idleTimer = setTimeout(settle, wait)
      return
    }
    if (deps.busy()) return
    if (pendingAppear) shown.value = true
    if (pendingLabel) openLabel()
    pendingAppear = pendingLabel = false
  }

  function reset() {
    clearTimeout(idleTimer)
    closeLabel()
    pendingAppear = pendingLabel = false
  }

  watch(
    () => [deps.project()?.id, threshold.value, deps.since().beads] as const,
    ([id, limit, beads], before) => {
      const step = labelStep(beads, limit)
      // A Project opening, or the threshold learnt: the ring shows at once, the label only for a Project long behind.
      if (!before || before[0] !== id || before[1] !== limit) {
        reset()
        const project = deps.project()
        shown.value = project !== undefined && step >= 0
        reached = step
        pendingLabel = project !== undefined && before?.[0] !== id && staleOnOpen(deps.since(), project.createdAt, limit, now())
        settle()
        return
      }
      lastLanded = now()
      if (step < 0) {
        reset()
        shown.value = false
        reached = -1
        return
      }
      if (!shown.value && !pendingAppear) pendingAppear = pendingLabel = true
      else if (step > reached) pendingLabel = true
      reached = Math.max(reached, step)
      settle()
    },
    { immediate: true },
  )

  watch(deps.busy, (busy) => {
    if (!busy) settle()
  })

  /** The pointer or focus is on the ring: an open label stays open, and closes a moment after it leaves. */
  function hold(on: boolean) {
    held = on
    clearTimeout(closeTimer)
    if (!on && labelOpen.value) closeTimer = setTimeout(closeLabel, LEAVE_MS)
  }

  onScopeDispose(() => {
    clearTimeout(idleTimer)
    clearTimeout(closeTimer)
  })

  return { shown, labelOpen, threshold, hold }
}
