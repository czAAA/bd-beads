import { watch } from 'vue'
import { placedFrame } from '../../domain/layerWeave'
import type { Project } from '../../domain/project'
import type { Insets } from '../../domain/toolPill'
import { roomBesidePanel } from '../../rendering/roomBesidePanel'
import type { Region, SurfaceView } from '../../rendering/surfaceView'
import { fitBox, RULER_GUTTER_PX, type ViewMove } from './useCanvasView'

/** What keeping the Frame beside the Frame panel needs from the Canvas view and the shell (ticket 0971). */
export interface FrameBesidePanelDeps {
  currentProject: () => Project | undefined
  bringIntoView: (locate: (surface: SurfaceView) => Region | undefined, how: { clear: Insets }) => ViewMove | undefined
  putBack: (move: ViewMove) => void
  /** Whether the Frame panel is open. */
  panelOpen: () => boolean
  /** The drawing area on the screen, or none until it is laid out. */
  area: () => Region | undefined
  /** The CSS zoom the drawing area is drawn at (ticket 1071): the view moves in its own px, the panel is placed on screen. */
  areaZoom: () => number
}

/** Keeps the Frame clear of the Frame panel (ticket 0971): as the panel is placed over the Frame, the Canvas pans once,
 * the shortest way, so the Frame's sheet (or, where it is too wide, the Frame and its rulers) lies in the free side beside
 * it, as far as that side holds it; as the panel closes, the view goes back, unless the person has moved it since. */
export function useFrameBesidePanel(deps: FrameBesidePanelDeps) {
  /** The move the panel's opening made, and in which Project. */
  let made: { move: ViewMove; project: string } | undefined

  /** The Frame panel has its place on the screen (`panel`, its box). */
  function panelPlaced(panel: Region): void {
    const project = deps.currentProject()
    const area = deps.area()
    const onScreen = area && roomBesidePanel(panel, area)
    if (!project || !onScreen || made) return
    const zoom = deps.areaZoom()
    const clear = { top: onScreen.top / zoom, right: onScreen.right / zoom, bottom: onScreen.bottom / zoom, left: onScreen.left / zoom }
    const room = area.width / zoom - clear.left - clear.right
    const move = deps.bringIntoView((surface) => {
      const sheet = fitBox(project)
      const frame = placedFrame(project)
      if (!sheet || !frame) return undefined
      // The Frame's sheet whole where the side holds it, else the Frame and its rulers, so its first columns show; as
      // much of them as the side holds, from the first, where they are wider still (a fit zoomed in, ticket 0964).
      const whole = surface.beadBox(sheet.box, 'canvas')
      if (whole.width <= room) return whole
      const line = surface.frameBox(frame)
      return { x: line.x - RULER_GUTTER_PX, y: line.y - RULER_GUTTER_PX, width: Math.min(room, line.width + 2 * RULER_GUTTER_PX), height: line.height + 2 * RULER_GUTTER_PX }
    }, { clear })
    made = move && { move, project: project.id }
  }

  watch(deps.panelOpen, (open) => {
    if (open) return
    // Another Project opened (which closes the panel) has a view of its own: nothing to take back there.
    if (made && made.project === deps.currentProject()?.id) deps.putBack(made.move)
    made = undefined
  }, { flush: 'sync' })

  return { panelPlaced }
}
