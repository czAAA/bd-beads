import { computed, ref, watch, type Ref } from 'vue'
import type { FrameId } from '../../domain/grid'
import { firstFrameId, frameById } from '../../domain/layerRecord'
import type { Project } from '../../domain/project'
import { NO_INSETS, sameInsets, type Insets } from '../../domain/toolPill'
import type { Size } from '../../rendering/cellSize'
import { expandedSides, type ExpandedContent } from '../../rendering/expandedSheet'
import { expandedNumberPx, frameOutsetPx } from '../../rendering/rulerScale'
import { frameNumberBands } from '../../rendering/rulers'
import type { ShownView } from './useCanvasView'

/** What Expand the Frame works the view through (`useCanvasView`). */
export interface FrameExpandDeps {
  currentProject: () => Project | undefined
  viewport: Ref<Size>
  zoom: Ref<number>
  scroll: Ref<{ x: number; y: number }>
  isAtFit: Ref<boolean>
  /** Under bp-tablet: the smaller inset (MarginSheet card). */
  compact: Ref<boolean>
  fit: (options?: { glide?: boolean; afresh?: boolean }) => void
  showView: (view: ShownView & { atFit: boolean }) => void
}

/** Expand the Frame (MarginSheet card; tickets 1168, 1169, 1260): the Frame's rows fitted between the sheet's rails and
 * over Row progress, the view before it kept to go back to. Not saved: another Project, a reload or the Frame removed
 * leaves it, the last putting the view back as it was. */
export function useFrameExpand(deps: FrameExpandDeps) {
  /** The Frame expanded, with the Project it is in (ticket 1220): another Project open is not, and the Frames beside it
   * stay as they were. */
  const expandedFor = ref<{ project: string; frame: FrameId }>()
  /** What the rails and Row progress take from the drawing area's sides, with the Tool pill's place (`chrome`) and
   * without it (`round`), as they last measured themselves. */
  const taken = ref({ chrome: NO_INSETS, round: NO_INSETS })
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

  /** What the expanded Frame lies in, while it is: the sheet is drawn and the view fitted from it. */
  const content = computed<ExpandedContent | undefined>(() => {
    const project = deps.currentProject()
    return expanded.value && project ? contentAt(project, expandedNumberPx(fitPitch.value)) : undefined
  })

  /** What the expanded Frame lies in with its numbers at a size. */
  function contentAt(project: Project, fontPx: number): ExpandedContent {
    return { compact: deps.compact.value, ...taken.value, fontPx, numbers: frameNumberBands(project, fontPx, expandedFrame.value ?? firstFrameId(project)) }
  }

  /** The room taken from each side of the drawing area, past the Frame's beads, at a zoom and the bead pitch it makes:
   * the rails, Row progress, the Tool pill's place and the numbers, what a fit leaves clear. */
  function room(zoom: number, pitch: number): Insets {
    const { chrome, ...content } = contentAt(deps.currentProject()!, expandedNumberPx(pitch))
    const sides = expandedSides(content)
    const past = frameOutsetPx(zoom)
    return { top: chrome.top + sides.top + past, right: chrome.right + sides.right + past, bottom: chrome.bottom + sides.bottom + past, left: chrome.left + sides.left + past }
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
    deps.fit({ glide: true, afresh: true })
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

  /** The rails measured themselves: a fit that follows them fits the room they leave. */
  function measured(chrome: Insets, round: Insets): void {
    const now = taken.value
    if (!sameInsets(now.chrome, chrome) || !sameInsets(now.round, round)) taken.value = { chrome, round }
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
