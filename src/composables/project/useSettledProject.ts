import { shallowRef, watch, type Ref } from 'vue'
import type { Project } from '../../domain/project'

/** The open Project as summaries see it (ticket 0680): itself when idle, during a stroke the Project from before it,
 * as painting replaces it per bead and a summary over tens of thousands of beads each time is too costly. A single
 * click is a stroke that ends at once, so it still shows straight away. `busy` is read reactively. */
export function useSettledProject(project: () => Project | undefined, busy: () => boolean): Ref<Project | undefined> {
  const settled = shallowRef(project())

  watch(
    [project, busy],
    ([current, drawing]) => {
      if (!drawing) {
        settled.value = current
      }
    },
    { flush: 'sync' },
  )

  return settled
}
