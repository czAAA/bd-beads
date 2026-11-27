import { lastEditedFrameId } from '../../domain/layerRecord'
import type { FrameRef } from '../../domain/grid'
import { watch, type Ref } from 'vue'
import type { Project } from '../../domain/project'
import { currentPassRegion } from '../../rendering/passRegion'
import type { Region, SurfaceView } from '../../rendering/surfaceView'

/** What opening on the current row needs from the Canvas view (ticket 0934). */
export interface RowInViewDeps {
  currentProject: () => Project | undefined
  bringIntoView: (locate: (surface: SurfaceView) => Region | undefined, how: { jump: boolean; frame: FrameRef }) => void
  /** Whether the view has had its first fit, and whether it still follows the fit. */
  placed: Readonly<Ref<boolean>>
  isAtFit: Readonly<Ref<boolean>>
}

/** Opening a Project, a reload among them, jumps to the Last edited Frame's current pass once the view is placed, zoom
 * untouched, unless an opening address set the view (ticket 0934). A Row progress press moves no view (ticket 1249). */
export function useRowInView(deps: RowInViewDeps) {
  watch(
    [() => deps.currentProject()?.id, deps.placed],
    ([, placed]) => {
      const project = deps.currentProject()
      if (!project || !placed || !deps.isAtFit.value) return
      const frame = lastEditedFrameId(project)
      deps.bringIntoView((surface) => currentPassRegion(project, surface, frame), { jump: true, frame })
    },
    { flush: 'post' },
  )
}
