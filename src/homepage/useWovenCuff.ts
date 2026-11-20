import { onScopeDispose, shallowRef, watch, type ShallowRef } from 'vue'
import { moveToRow, rowProgressPosition } from '../domain/rowProgress'
import type { Project } from '../domain/project'
import { useRowOps, type RowPress } from '../composables/project/useRowOps'
import type { Translations } from '../i18n/translations'
import { wovenCuff } from './inside/demoProjects'

/** Passes shown done under reduced motion, where the cuff doesn't weave by itself (Homepage card): pass 7, row 4. */
const STILL_PASSES = 6

/** What the woven cuff needs: its timing (the `--welcome-cuff-*` values), whether motion is reduced, whether its section
 * is the one shown, and the announcer with the language it speaks. */
export interface WovenCuffDeps {
  timing: () => { stepMs: number; holdMs: number; passes: number }
  reducedMotion: () => boolean
  shown: () => boolean
  announce: (text: string) => void
  messages: () => Translations
}

/** The cuff the Welcome tile weaves (ticket 1157; Homepage card), stepped by the editor's own Row progress (`useRowOps`):
 * a pass every step while its section is shown, until a press takes over for the visit. A Project of its own, never
 * saved: nothing it does reaches the library or the device's settings. */
export function useWovenCuff(deps: WovenCuffDeps): { project: ShallowRef<Project>; rowPress: ShallowRef<RowPress | undefined>; moveRow: (delta: number) => void } {
  const start = wovenCuff()
  const project = shallowRef(deps.reducedMotion() ? moveToRow(start, STILL_PASSES) : start)
  /** Only a press is said aloud: the weaving by itself is not news (ScreenReaders card). */
  let pressing = false
  const rows = useRowOps({
    currentProject: () => project.value,
    replaceProject: (next) => (project.value = next),
    showToast: () => undefined,
    messages: deps.messages,
    announce: (text) => {
      if (pressing) deps.announce(text)
    },
  })

  /** A press has taken over: the cuff no longer weaves by itself this visit. */
  let taken = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const done = () => rowProgressPosition(project.value).current

  function halt(): void {
    clearTimeout(timer)
    timer = undefined
  }

  /** The next step by itself: a pass marked done, or once the last is, a rest and then back to the first. */
  function schedule(): void {
    halt()
    const { stepMs, holdMs, passes } = deps.timing()
    if (taken || deps.reducedMotion() || !deps.shown() || stepMs <= 0) return
    const resting = done() >= passes
    timer = setTimeout(() => {
      if (resting) rows.onGoToRow(0)
      else rows.onMoveRow(1)
      schedule()
    }, resting ? holdMs : stepMs)
  }

  watch(deps.shown, schedule, { immediate: true })
  onScopeDispose(halt)

  /** Row done (1) or Back a row (-1), pressed: as in the editor, never past the last of the cuff's passes. */
  function moveRow(delta: number): void {
    taken = true
    halt()
    if (delta > 0 && done() >= deps.timing().passes) return
    pressing = true
    rows.onMoveRow(delta)
    pressing = false
  }

  return { project, rowPress: rows.rowPress, moveRow }
}
