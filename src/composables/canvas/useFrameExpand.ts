import { computed, ref, watch, type Ref } from 'vue'
import { nearestQuarterTurn } from '../../domain/canvasOrientation'
import { frameOf } from '../../domain/layerRecord'
import type { Project } from '../../domain/project'
import type { Insets } from '../../domain/toolPill'
import type { Size } from '../../rendering/cellSize'
import { MARGIN_PX } from '../../rendering/marginSizes'
import { frameOutsetPx, rulerFontAtFull } from '../../rendering/rulerScale'
import { frameNumberBands } from '../../rendering/rulers'
import { slimSheetSides, type SlimContent } from '../../rendering/slimSheet'
import type { ShownView } from './useCanvasView'

/** What the slim sheet's own controls measure on the page (MarginSheet card, Expand the Frame), in screen px: the
 * band's row, the title block (0 with none) and the narrowest row it shows (0 until it has had to show it). */
export interface SlimMeasures {
  row: number
  title: number
  rowWidth: number
}

/** Until the sheet measures itself: the full row and the two-row title block, the tallest it holds. */
const UNMEASURED: SlimMeasures = { row: MARGIN_PX.tool, title: 2 * 23 + 1, rowWidth: 0 }

/** What Expand the Frame works the view through (`useCanvasView`). */
export interface FrameExpandDeps {
  currentProject: () => Project | undefined
  viewport: Ref<Size>
  zoom: Ref<number>
  scroll: Ref<{ x: number; y: number }>
  isAtFit: Ref<boolean>
  orientation: Ref<number>
  /** Under bp-tablet: the smaller insets and gap, and the 12px numbers of a phone (Rulers card). */
  compact: Ref<boolean>
  fit: (options?: { glide?: boolean }) => void
  showView: (view: ShownView & { atFit: boolean }) => void
}

/** Expand the Frame (MarginSheet card; tickets 1168, 1169): the Frame fitted to the whole drawing area with its sheet
 * slimmed to what it holds, the view before it kept to go back to. Not saved: another Project, a reload or the Frame
 * removed leaves it, the last putting the view back as it was. */
export function useFrameExpand(deps: FrameExpandDeps) {
  /** The Project expanded, by id: another one open is not. */
  const expandedFor = ref<string>()
  const measures = ref<SlimMeasures>(UNMEASURED)
  let before: (ShownView & { atFit: boolean }) | undefined

  const expanded = computed(() => {
    const project = deps.currentProject()
    return !!project && expandedFor.value === project.id && !!frameOf(project)
  })

  /** What the slim sheet holds, while the Frame is expanded: the sheet is laid round the Frame's line from it. */
  const content = computed<SlimContent | undefined>(() => {
    const project = deps.currentProject()
    if (!expanded.value || !project) return undefined
    const across = nearestQuarterTurn(deps.orientation.value) % 180 !== 0
    const fontPx = rulerFontAtFull(deps.compact.value)
    const { row, title, rowWidth } = measures.value
    return { compact: deps.compact.value, row, title, rowWidth, numbers: frameNumberBands(project, across, fontPx) }
  })

  /** The room the slim sheet and the gap round it take from each side of the drawing area, past the Frame's beads, at
   * a zoom: what a fit leaves clear. A Frame narrower than its row widens the sheet, which a fit does not count. */
  function room(zoom: number): Insets {
    const held = content.value!
    const sides = slimSheetSides({ ...held, rowWidth: 0 }, 0)
    const gap = MARGIN_PX.expanded.gap[held.compact ? 'compact' : 'full']
    const past = frameOutsetPx(zoom) + gap
    return { top: sides.top + past, right: sides.right + past, bottom: sides.bottom + past, left: sides.left + past }
  }

  /** Expand the Frame, or Back to the Canvas: whether it is now expanded. */
  function toggle(): boolean {
    const project = deps.currentProject()
    if (expanded.value) {
      collapse()
      return false
    }
    if (!project || !frameOf(project)) return false
    before = { zoom: deps.zoom.value, scroll: { ...deps.scroll.value }, atFit: deps.isAtFit.value }
    expandedFor.value = project.id
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
    () => !!frameOf(deps.currentProject()),
    (framed) => {
      if (framed || expandedFor.value === undefined) return
      expandedFor.value = undefined
      if (before) deps.showView(before)
      before = undefined
    },
  )

  return { expanded, content, room, toggle, collapse, measured }
}
