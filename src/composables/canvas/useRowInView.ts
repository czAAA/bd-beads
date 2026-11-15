import { watch, type Ref } from 'vue'
import type { Project } from '../../domain/project'
import { currentPassRegion } from '../../rendering/passRegion'
import type { Region, SurfaceView } from '../../rendering/surfaceView'

/** What keeping the current row in view needs from the Canvas view (ticket 0934). */
export interface RowInViewDeps {
  currentProject: () => Project | undefined
  bringIntoView: (locate: (surface: SurfaceView) => Region | undefined, how?: { jump?: boolean }) => void
  /** Whether the view has had its first fit, and whether it still follows the fit. */
  placed: Readonly<Ref<boolean>>
  isAtFit: Readonly<Ref<boolean>>
}

/** Keeps the row the weaver is on in view (ticket 0934): `showRow` pans the shortest way that brings the current pass,
 * with a row of context, into the visible Canvas, zoom untouched. A row move and Go to row's Show row call it; opening a
 * Project, a reload among them, jumps to it once the view is placed, unless an opening address set the view. */
export function useRowInView(deps: RowInViewDeps) {
  function showRow(how: { jump?: boolean } = {}): void {
    const project = deps.currentProject()
    if (project) deps.bringIntoView((surface) => currentPassRegion(project, surface), how)
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
