import { computed, ref, watch, type Ref } from 'vue'
import type { FrameId } from '../../domain/grid'
import { firstFrameId, frameById } from '../../domain/layerRecord'
import type { Project } from '../../domain/project'
import type { Insets } from '../../domain/toolPill'
import type { Size } from '../../rendering/cellSize'
import { MARGIN_PX } from '../../rendering/marginSizes'
import { expandedNumberPx, frameOutsetPx } from '../../rendering/rulerScale'
import { frameNumberBands } from '../../rendering/rulers'
import { slimSheetSides, type SlimContent } from '../../rendering/slimSheet'
import type { ShownView } from './useCanvasView'

/** What the slim sheet's own controls measure on the page (MarginSheet card, Expand the Frame), in screen px: the
 * band's row, the foot under the Frame (the title block and Row progress's strip; ticket 1176) and the narrowest row it
 * shows (0 until it has had to show it). */
export interface SlimMeasures {
  row: number
  title: number
  rowWidth: number
}

/** Until the sheet measures itself: the full row, and the foot at its tallest, the facts over Row progress's strip
 * (tickets 1176, 1258). */
const UNMEASURED: SlimMeasures = { row: MARGIN_PX.tool, title: MARGIN_PX.factsRow + MARGIN_PX.footGap + MARGIN_PX.strip, rowWidth: 0 }

/** What Expand the Frame works the view through (`useCanvasView`). */
export interface FrameExpandDeps {
  currentProject: () => Project | undefined
  viewport: Ref<Size>
  zoom: Ref<number>
  scroll: Ref<{ x: number; y: number }>
  isAtFit: Ref<boolean>
  /** Under bp-tablet: the smaller insets and gap (MarginSheet card). */
  compact: Ref<boolean>
  /** What lies over the drawing area's edges (the Tool pill): the sheet fills the room it leaves (ticket 1194). */
  covered: () => Insets
  fit: (options?: { glide?: boolean }) => void
  showView: (view: ShownView & { atFit: boolean }) => void
}

/** Expand the Frame (MarginSheet card; tickets 1168, 1169): the Frame fitted to the whole drawing area with its sheet
 * slimmed to what it holds, the view before it kept to go back to. Not saved: another Project, a reload or the Frame
 * removed leaves it, the last putting the view back as it was. */
export function useFrameExpand(deps: FrameExpandDeps) {
  /** The Frame expanded, with the Project it is in (ticket 1220): another Project open is not, and the Frames beside it
   * stay as they were. */
  const expandedFor = ref<{ project: string; frame: FrameId }>()
  const measures = ref<SlimMeasures>(UNMEASURED)
  /** The bead pitch on screen of the last expanded fit, in px: the numbers' size follows it and stays while zooming
   * (ticket 1194). */
  const fitPitch = ref(0)
  let before: (ShownView & { atFit: boolean }) | undefined

  /** The Frame expanded, none while none is. */
  const expandedFrame = computed<FrameId | undefined>(() => {
    const project = deps.currentProject()
    const held = expandedFor.value
    return project && held?.project === project.id && frameById(project, held.frame) ? held.frame : undefined
  })
  const expanded = computed(() => expandedFrame.value !== undefined)

  /** What the slim sheet holds, while the Frame is expanded: the sheet is laid round the Frame's line from it. */
  const content = computed<SlimContent | undefined>(() => {
    const project = deps.currentProject()
    if (!expanded.value || !project) return undefined
    const { width, height } = deps.viewport.value
    const pill = deps.covered()
    const fill = { width: width - pill.left - pill.right, height: height - pill.top - pill.bottom }
    return { ...contentAt(project, expandedNumberPx(fitPitch.value)), fill }
  })

  /** What the slim sheet holds with its numbers at a size, no room to fill. */
  function contentAt(project: Project, fontPx: number): SlimContent {
    const { row, title, rowWidth } = measures.value
    return { compact: deps.compact.value, row, title, rowWidth, fontPx, numbers: frameNumberBands(project, fontPx, expandedFrame.value ?? firstFrameId(project)) }
  }

  /** The room the slim sheet takes from each side of the drawing area, past the Frame's beads, at a zoom and the bead
   * pitch it makes: what a fit leaves clear. No gap round it (ticket 1176): the sheet is the margin. It fills the rest
   * of the room itself, so the fit leaves it only what it needs (ticket 1194). */
  function room(zoom: number, pitch: number): Insets {
    const project = deps.currentProject()!
    const sides = slimSheetSides({ ...contentAt(project, expandedNumberPx(pitch)), rowWidth: 0 }, 0)
    const past = frameOutsetPx(zoom)
    return { top: sides.top + past, right: sides.right + past, bottom: sides.bottom + past, left: sides.left + past }
  }

  /** Expand the Frame whose sheet asked, or Back to the Canvas: whether it is now expanded. Pressed on another Frame's
   * sheet while one is expanded, it goes back first and that Frame is the one expanded. */
  function toggle(frame: FrameId = firstFrameId(deps.currentProject())): boolean {
    const project = deps.currentProject()
    if (expandedFrame.value === frame) {
      collapse()
      return false
    }
    if (!project || !frameById(project, frame)) return false
    // Another Frame's expand takes the view over from the one before it, which kept the Canvas's own to go back to.
    before ??= { zoom: deps.zoom.value, scroll: { ...deps.scroll.value }, atFit: deps.isAtFit.value }
    expandedFor.value = { project: project.id, frame }
    deps.fit({ glide: true })
    return true
  }

  /** Back to the Canvas, the view as it was before the press; Escape's, when nothing else took it. Whether it was
   * expanded. */
  function collapse(): boolean {
    if (!expanded.value) return false
    expandedFor.value = undefined
    if (before) deps.showView(before)
    before = undefined
    return true
  }

  /** The slim sheet measured itself: a fit that follows it fits its new size. */
  function measured(next: SlimMeasures): void {
    const now = measures.value
    if (now.row !== next.row || now.title !== next.title || now.rowWidth !== next.rowWidth) measures.value = next
  }

  const roomKey = () => (expanded.value ? JSON.stringify(content.value) : '')
  watch(roomKey, (key) => {
    if (key && deps.isAtFit.value) deps.fit({ glide: true })
  })
  // A window resized or an iPad turned fits again, the view moved by hand or not.
  watch(deps.viewport, () => {
    if (expanded.value && !deps.isAtFit.value) deps.fit()
  })
  // Removing the Frame goes back; another Project opens unexpanded, at its own fit.
  watch(
    () => deps.currentProject()?.id,
    () => {
      expandedFor.value = undefined
      before = undefined
    },
  )
  watch(
    () => !expandedFor.value || !!frameById(deps.currentProject(), expandedFor.value.frame),
    (present) => {
      if (present || expandedFor.value === undefined) return
      expandedFor.value = undefined
      if (before) deps.showView(before)
      before = undefined
    },
  )

  /** The expanded fit worked out its bead pitch: the numbers grow to it. */
  function fitted(pitch: number): void {
    fitPitch.value = pitch
  }

  return { expanded, expandedFrame, content, room, toggle, collapse, measured, fitted }
}
