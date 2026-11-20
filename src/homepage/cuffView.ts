import { frameOf, layerOf, quarterTurnOf } from '../domain/layerRecord'
import { placedFrame } from '../domain/layerWeave'
import type { Project } from '../domain/project'
import { MARGIN_PX } from '../rendering/marginSizes'
import { rulerLayout, type RulerLayout } from '../rendering/rulers'
import { spaceOf, type Space } from '../rendering/space'
import { surfaceView, type Region, type Scroll, type SurfaceView } from '../rendering/surfaceView'

/** The rulers' numbers at 100%, as the editor sets them off a phone (Rulers card). */
const RULER_FONT_PX = 11
/** Room past the outermost number for the current pass's pill, and a little more for the ring round its beads. */
const RING_PX = 2
const EDGE_PX = MARGIN_PX.pass.pillPad + RING_PX
/** The viewport the first pass lays the view out in, before the drawing's own size is known. */
const FIRST_GUESS = { width: 1000, height: 1000 }
/** Passes until the view and its numbers settle: each one moves them by less than a px after the first two. */
const SETTLE_PASSES = 4

/** The view the Welcome cuff is drawn through (ticket 1157): the editor's own Canvas view of the cuff's Frame, its
 * line and rulers, scrolled so they fill it. */
export interface CuffView {
  zoom: number
  scroll: Scroll
  /** The drawing's size in px: what the Frame and its rulers cover. */
  size: { width: number; height: number }
  space: Space
  surface: SurfaceView
  rulers: RulerLayout
}

/** The editor's view of the Project at a zoom and scroll, with its rulers laid out for it as the Drawing surface lays
 * them (ProjectSurface): the Frame's numbers on, a Piece's off, as the cuff has none. */
function viewAt(project: Project, zoom: number, fontPx: number, scroll: Scroll, viewport: { width: number; height: number }) {
  const space = spaceOf(project, true)
  const { weave } = layerOf(project, 'canvas')
  const surface = surfaceView({ space, technique: weave.technique, techniqueSettings: weave.techniqueSettings, cell: weave.cell, frame: placedFrame(project), rotation: quarterTurnOf(project), zoom, scroll, viewport })
  return { space, surface, rulers: rulerLayout(project, surface, { fontPx, numbers: false }) }
}

/** What the Frame, its line and its numbers cover in a view, with room for the pill. */
function drawnBox(project: Project, surface: SurfaceView, rulers: RulerLayout): Region {
  const frame = surface.frameBox(frameOf(project)!)
  let [left, top, right, bottom] = [frame.x, frame.y, frame.x + frame.width, frame.y + frame.height]
  for (const label of rulers.labels) {
    left = Math.min(left, label.x - label.width / 2)
    right = Math.max(right, label.x + label.width / 2)
    top = Math.min(top, label.y - label.height / 2)
    bottom = Math.max(bottom, label.y + label.height / 2)
  }
  return { x: left - EDGE_PX, y: top - EDGE_PX, width: right - left + EDGE_PX * 2, height: bottom - top + EDGE_PX * 2 }
}

/** The view of the cuff's Frame and its rulers at `zoom`, numbers `fontPx` at 100%, as big as they cover; its scroll is
 * found against that size in a few passes, as the view lays its numbers by its edges.
 * @internal Its test draws the editor's Canvas through it too. */
export function cuffView(project: Project, zoom: number, fontPx = RULER_FONT_PX): CuffView {
  let size = FIRST_GUESS
  let scroll = { x: 0, y: 0 }
  for (let pass = 0; pass < SETTLE_PASSES; pass++) {
    const { surface, rulers } = viewAt(project, zoom, fontPx, scroll, size)
    const box = drawnBox(project, surface, rulers)
    scroll = { x: scroll.x + box.x, y: scroll.y + box.y }
    size = { width: Math.ceil(box.width), height: Math.ceil(box.height) }
  }
  return { zoom, scroll, size, ...viewAt(project, zoom, fontPx, scroll, size) }
}

/** The view drawn at `zoom` and shown `shownWidth` px wide: its numbers drawn larger by as much as it is shown smaller,
 * so they read at the editor's size and its rulers choose their step for the size they are seen at. */
export function shownCuffView(project: Project, zoom: number, shownWidth: number): CuffView {
  let view = cuffView(project, zoom)
  if (shownWidth <= 0) return view
  for (let pass = 0; pass < SETTLE_PASSES; pass++) view = cuffView(project, zoom, (RULER_FONT_PX * view.size.width) / shownWidth)
  return view
}
