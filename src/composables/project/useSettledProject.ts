import { shallowRef, watch, type Ref } from 'vue'
import type { Project } from '../../domain/project'

/** How often, while a stroke is going on, what only summarises the Project looks at it again. */
export const SUMMARY_INTERVAL_MS = 250

// The open Project as summaries should see it (ticket 106): itself when idle, and during a stroke only every 250 ms,
// since painting replaces it per bead and a summary over tens of thousands of beads each time is too costly. The first
// change follows at once; Infinity waits for the stroke's end; `busy` is read reactively.
export function useSettledProject(
  project: () => Project | undefined,
  busy: () => boolean,
  intervalMs: number = SUMMARY_INTERVAL_MS,
): Ref<Project | undefined> {
  const settled = shallowRef(project())
  let followedAt = Number.NEGATIVE_INFINITY
  let timer: ReturnType<typeof setTimeout> | undefined

  function follow(): void {
    clearTimeout(timer)
    timer = undefined
    const current = project()
    // A stroke beginning is not yet a change to follow: the first bead it changes is followed at once.
    if (current !== settled.value) {
      settled.value = current
      followedAt = Date.now()
    }
  }

  watch(
    [project, busy],
    ([, drawing]) => {
      if (!drawing) {
        follow()
        // Nothing is being drawn, so the first change of the next stroke is followed at once again.
        followedAt = Number.NEGATIVE_INFINITY
        return
      }
      if (!Number.isFinite(intervalMs)) {
        return
      }
      const wait = followedAt + intervalMs - Date.now()
      if (wait <= 0) {
        follow()
      } else if (timer === undefined) {
        timer = setTimeout(follow, wait)
      }
    },
    { flush: 'sync' },
  )

  return settled
}
