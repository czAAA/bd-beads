import { onScopeDispose, ref, watch } from 'vue'
import { browserOpeningNote, type OpeningNote, type OpeningNoteStore } from '../../services/openingNote'

export interface SafeStartDeps {
  /** Where the note is kept; this browser's localStorage by default. */
  note?: OpeningNoteStore
  /** Runs `run` at the next frame; requestAnimationFrame by default. */
  nextFrame?: (run: () => void) => void
}

function animationFrame(run: () => void): void {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run)
  else run()
}

/** Safe start (ticket 0716): the editor notes "opening Project X" before it opens one, cleared a frame after its first
 * drawn frame; a load that finds the note still set holds that Project back, opens none, says so and clears the note,
 * so the next load tries again. Call `follow` once the library knows which Project is open. */
export function useSafeStart({ note = browserOpeningNote, nextFrame = animationFrame }: SafeStartDeps = {}) {
  const left = note.read()
  if (left) note.clear()

  /** The Project that didn't open last time, for the notice, until the person deals with it. */
  const missed = ref<OpeningNote | undefined>(left)

  /** The Project being opened whose frame hasn't been drawn yet. */
  let opening: string | undefined

  /** Notes each Project as it is about to open (a change of the open one), and clears the note when none is. */
  function follow(active: () => OpeningNote | undefined): void {
    watch(
      () => active()?.id,
      () => {
        const project = active()
        opening = project?.id
        if (project) note.write({ id: project.id, name: project.name })
        else note.clear()
      },
      { immediate: true, flush: 'sync' },
    )
  }

  /** A frame of the open Project was drawn: whatever else that frame runs (the rulers) has run by the next one. */
  function onDrawn(): void {
    const drawing = opening
    if (drawing === undefined) return
    nextFrame(() => {
      if (opening !== drawing) return
      opening = undefined
      note.clear()
    })
  }

  // A page that goes away normally wasn't frozen; nor was an editor taken down whole.
  const clear = () => {
    opening = undefined
    note.clear()
  }
  window.addEventListener('pagehide', clear)
  onScopeDispose(() => {
    window.removeEventListener('pagehide', clear)
    clear()
  })

  return { held: left?.id, missed, follow, onDrawn }
}
