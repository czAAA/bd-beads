import type { Layer } from '../../domain/grid'
import { backgroundOf, withBackground, withStartBackground } from '../../domain/layerRecord'
import { touch, type Background, type Project } from '../../domain/project'

/** What setting a Background needs from the app shell: the open Project, its write path and the device's last pick. */
export interface BackgroundFlowDeps {
  currentProject: () => Project | undefined
  replaceProject: (project: Project) => void
  /** Keeps the pick on the device, as the Background a new Project starts with. */
  remember: (background: Background) => void
  /** The device's last pick, which a layer saved without a Background shows. */
  start: () => Background
}

/** A layer's Background (ADR 0079, ticket 0666), picked in the Project panel's Canvas section or the Frame panel: a
 * view saved with the Project, like the Canvas's orientation, so no Edit, no Undo step and no Row progress lock. */
export function useBackgroundFlow(deps: BackgroundFlowDeps) {
  function setBackground(layer: Layer, background: Background): void {
    const open = deps.currentProject()
    if (!open) return
    // A layer saved without one shows the device's pick, which this pick moves: it keeps what it showed.
    const project = withStartBackground(open, deps.start())
    deps.remember(background)
    if (project === open && backgroundOf(project, layer) === background) return
    deps.replaceProject(touch(withBackground(project, layer, background), {}))
  }

  return { setBackground }
}
