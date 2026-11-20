import { watch } from 'vue'
import { placedFrame } from '../../domain/layerWeave'
import type { Project } from '../../domain/project'
import type { Insets } from '../../domain/toolPill'
import type { Size } from '../../rendering/cellSize'
import { roomBesidePanel } from '../../rendering/roomBesidePanel'
import type { Region, SurfaceView } from '../../rendering/surfaceView'
import { fitBox, RULER_GUTTER_PX, type ViewMove } from './useCanvasView'

/** What keeping the Frame beside the Frame panel needs from the Canvas view and the shell (ticket 0971). */
export interface FrameBesidePanelDeps {
  currentProject: () => Project | undefined
  bringIntoView: (locate: (surface: SurfaceView) => Region | undefined, how: { clear: Insets; slack: number }) => ViewMove | undefined
  putBack: (move: ViewMove) => void
  /** Whether the Frame panel is open. */
  panelOpen: () => boolean
  /** The drawing area on the screen, or none until it is laid out. */
  area: () => Region | undefined
  /** The CSS zoom the drawing area is drawn at (ticket 1071): the view moves in its own px, the panel is placed on screen. */
  areaZoom: () => number
  /** The drawing area's size as the view knows it, in the area's own px: its observer's, which lags a resize. */
  viewSize: () => Size
}

/** How far on screen the Frame's sheet may reach under the Frame panel (and its air) before the Canvas pans for it: a
 * move this small would only nudge the view, while what lies under the panel is the sheet's margin.
 * @internal Tests check the slack is passed in the drawing area's own px. */
export const FRAME_PANEL_SLACK_PX = 32

/** How far two measures of the drawing area may be apart and still be the same size, in px: rounding's share. */
const SAME_SIZE_PX = 1

const sameSize = (one: Size, other: Size) => Math.abs(one.width - other.width) <= SAME_SIZE_PX && Math.abs(one.height - other.height) <= SAME_SIZE_PX

/** Keeps the Frame clear of the Frame panel (ticket 0971): as the panel is placed over the Frame, the Canvas pans once,
 * the shortest way past a small slack, so the Frame's sheet (or, too wide, the Frame and rulers) lies in the free side;
 * as it closes, the view goes back unless moved since, only as far as keeps in view a Frame the move brought in. */
export function useFrameBesidePanel(deps: FrameBesidePanelDeps) {
  /** The move the panel's opening made, and in which Project. */
  let made: { move: ViewMove; project: string } | undefined
  /** Ends the wait for the view to know the drawing area's size, while there is one. */
  let waiting: (() => void) | undefined

  function stopWaiting(): void {
    waiting?.()
    waiting = undefined
  }

  /** The Frame panel has its place on the screen (`panel`, its box). */
  function panelPlaced(panel: Region): void {
    stopWaiting()
    const project = deps.currentProject()
    const area = deps.area()
    const onScreen = area && roomBesidePanel(panel, area)
    if (!project || !onScreen || made) return
    const zoom = deps.areaZoom()
    // The view pans by the area's size as its observer last told it, which comes after a resize (Convert image closing
    // gives the area its room back): a move worked out by the older size lands wrong and goes back wrong (ticket 1143).
    if (!sameSize(deps.viewSize(), { width: area.width / zoom, height: area.height / zoom })) {
      waiting = watch(deps.viewSize, () => panelPlaced(panel), { flush: 'sync' })
      return
    }
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
    }, { clear, slack: FRAME_PANEL_SLACK_PX / zoom })
    made = move && { move, project: project.id }
  }

  watch(deps.panelOpen, (open) => {
    if (open) return
    stopWaiting()
    // Another Project opened (which closes the panel) has a view of its own: nothing to take back there.
    if (made && made.project === deps.currentProject()?.id) deps.putBack(made.move)
    made = undefined
  }, { flush: 'sync' })

  return { panelPlaced }
}
