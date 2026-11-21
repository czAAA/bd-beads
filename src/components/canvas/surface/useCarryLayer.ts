import { onBeforeUnmount, watch, type Ref } from 'vue'
import { pixelRatioOf } from '../../../composables/ui/cssZoom'
import type { GridPosition } from '../../../domain/grid'
import type { CarriedPieceMove } from '../../../composables/tools/useSelectionGesture'
import { canvasOf } from '../../../domain/layerRecord'
import { shownLetters } from '../../../domain/paletteEdits'
import type { Project } from '../../../domain/project'
import type { ProjectTheme } from '../../../rendering/beadLook'
import { renderProject } from '../../../rendering/projectRenderer'
import type { Space } from '../../../rendering/space'
import type { Scroll, SurfaceView } from '../../../rendering/surfaceView'
import type { Size } from '../../../rendering/cellSize'
import { sizeCanvas } from './useSurfaceDrawing'

interface CarryLayerDeps {
  props: { project: Project; zoom: number; scroll: Scroll }
  canvas: Ref<HTMLCanvasElement | undefined>
  size: Ref<Size>
  space: Ref<Space>
  surface: Ref<SurfaceView>
  theme: Ref<ProjectTheme>
  frameTheme: Ref<ProjectTheme>
  carried: () => CarriedPieceMove | undefined
  oncePerFrame: (draw: () => void) => () => void
}

/** Keeps a carried Piece drawn on a canvas of its own over the beads (ticket 1151): drawn once, then laid where the
 * pointer has brought it by moving the bitmap, so no step draws a bead. The beads' layer meanwhile shows the Project
 * with the Piece lifted out, which it draws once. Drawn again only where the view or the look changes under it. */
export function useCarryLayer({ props, canvas: canvasEl, size, space, surface, theme, frameTheme, carried, oncePerFrame }: CarryLayerDeps): void {
  /** What the bitmap was drawn from, to draw it again only when that changes. */
  let drawn: { piece: Project; project: Project; zoom: number; scroll: Scroll; width: number; height: number; pixelRatio: number; theme: ProjectTheme; frameTheme: ProjectTheme } | undefined

  // The canvas is styled by hand, not through the template: a step only moves it, and must not render the component.
  function update(): void {
    const canvas = canvasEl.value
    if (!canvas) return
    const held = carried()
    if (!held || size.value.width === 0 || size.value.height === 0) {
      drawn = undefined
      canvas.style.display = 'none'
      canvas.style.transform = ''
      return
    }
    const pixelRatio = pixelRatioOf(canvas)
    const { project } = props
    const current = { piece: held.project, project, zoom: props.zoom, scroll: { ...props.scroll }, width: size.value.width, height: size.value.height, pixelRatio, theme: theme.value, frameTheme: frameTheme.value }
    const stale =
      !drawn || (Object.keys(current) as (keyof typeof current)[]).some((key) => (key === 'scroll' ? current.scroll.x !== drawn!.scroll.x || current.scroll.y !== drawn!.scroll.y : current[key] !== drawn![key]))
    if (stale) {
      const region = { x: props.scroll.x, y: props.scroll.y, width: size.value.width, height: size.value.height }
      sizeCanvas(canvas, region.width, region.height, pixelRatio)
      const context = canvas.getContext('2d')
      if (!context) return
      // The Piece's beads in the Project the layers show, so its orientation, Bead and look are theirs.
      const piece = { ...project, layers: [{ ...canvasOf(project), beads: canvasOf(held.project).beads }] } as Project
      renderProject(context, { project: piece, space: space.value, region, zoom: props.zoom, pixelRatio, theme: theme.value, frameTheme: frameTheme.value, rowMarks: false, letters: shownLetters(project, 'frame'), canvasLetters: shownLetters(project, 'canvas'), draftWhenSmall: true, positionMarks: false })
      drawn = current
    }
    canvas.style.display = ''
    const bead = (at: GridPosition) => surface.value.beadBox({ row: at.row, column: at.column, rows: 1, columns: 1 }, 'canvas')
    const from = bead(held.from)
    const to = bead({ row: held.from.row + held.rows, column: held.from.column + held.columns })
    canvas.style.transform = `translate(${to.x - from.x}px, ${to.y - from.y}px)`
  }

  watch([size, () => props.project, () => props.zoom, () => props.scroll, theme, frameTheme, surface, carried], oncePerFrame(update), { flush: 'post' })
  onBeforeUnmount(() => {
    drawn = undefined
  })
}
