import { lastEditedFrameId } from '../../domain/layerRecord'
import { watch, type Ref } from 'vue'
import type { FrameRef } from '../../domain/grid'
import type { Project } from '../../domain/project'
import { currentPassRegion } from '../../rendering/passRegion'
import type { Region, SurfaceView } from '../../rendering/surfaceView'

/** What keeping the current row in view needs from the Canvas view (ticket 0934). */
export interface RowInViewDeps {
  currentProject: () => Project | undefined
  bringIntoView: (locate: (surface: SurfaceView) => Region | undefined, how?: { jump?: boolean; frame?: FrameRef }) => void
  /** Whether the view has had its first fit, and whether it still follows the fit. */
  placed: Readonly<Ref<boolean>>
  isAtFit: Readonly<Ref<boolean>>
}

/** Keeps the row the weaver is on in view (ticket 0934): `showRow` pans the shortest way to the current pass, zoom
 * untouched, in the Frame a row move names (ticket 1243). Opening a Project, a reload among them, jumps to the Last
 * edited Frame's once the view is placed, unless an opening address set the view. */
export function useRowInView(deps: RowInViewDeps) {
  function showRow({ frame, ...how }: { frame?: FrameRef; jump?: boolean } = {}): void {
    const project = deps.currentProject()
    if (!project) return
    const shown = frame ?? lastEditedFrameId(project)
    deps.bringIntoView((surface) => currentPassRegion(project, surface, shown), { ...how, frame: shown })
  }

  watch(
    [() => deps.currentProject()?.id, deps.placed],
    ([, placed]) => {
      if (placed && deps.isAtFit.value) showRow({ jump: true })
    },
    { flush: 'post' },
  )

  return { showRow }
}
