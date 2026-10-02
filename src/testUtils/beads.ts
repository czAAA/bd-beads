import type { VueWrapper } from '@vue/test-utils'
import PatternSurface from '../components/canvas/PatternSurface.vue'
import { CELL_SIZE_PX, GRID_BORDER_PX, type GridPosition, type PreviewCell, type Rotation } from '../domain/grid'
import type { Selection } from '../domain/selection'
import { patternExtentPx, rowShiftPx, rowTopPx } from '../rendering/patternRenderer'

/**
 * Pressing, hovering and reading beads on the Drawing surface from a test (tickets 109 and 110). The surface is one
 * element and jsdom does no layout, so a bead is found the way a person's pointer finds it: by where it is. These put a
 * pointer event at the coordinates of a bead, which the surface then hit-tests exactly as it does for a real pointer
 * (see rendering/hitTest.ts), and read what the app did from the state it draws from: the Pattern, the Selection, the
 * hover preview, Mirror's axes and the dimmed beads are the props the surface is handed.
 *
 * A bead is named by its row and column, or by its index counting along the rows (row-major), which is how a grid of
 * elements was indexed and how most of the tests that used one count.
 */
export type BeadAt = number | GridPosition

type Anywhere = VueWrapper<never> | VueWrapper

function surfaceRoot(wrapper: Anywhere) {
  const root = wrapper.find('[data-testid="pattern-surface"]')
  if (!root.exists()) {
    throw new Error('No Pattern is drawn: there is no surface to press')
  }
  return root
}

function surface(wrapper: Anywhere) {
  return wrapper.findComponent(PatternSurface)
}

/** What the open Pattern is, as the surface was handed it. */
export function drawnPattern(wrapper: Anywhere) {
  return surface(wrapper).props('pattern')
}

/** A bead's row and column, from either way of naming it. */
function positionOf(wrapper: Anywhere, at: BeadAt): GridPosition {
  if (typeof at !== 'number') {
    return at
  }
  const { columns } = drawnPattern(wrapper)
  return { row: Math.floor(at / columns), column: at % columns }
}

/** Where a bead's centre is in the page, for a surface at the corner of it, whichever Technique, zoom and rotation. */
function beadPoint(wrapper: Anywhere, at: BeadAt): { clientX: number; clientY: number } {
  const root = surfaceRoot(wrapper)
  const technique = root.attributes('data-technique') as 'loom' | 'peyote' | 'brick'
  const columns = Number(root.attributes('data-columns'))
  const rows = Number(root.attributes('data-rows'))
  const rotation = Number(root.attributes('data-rotation')) as Rotation
  const zoom = Number(root.attributes('data-zoom'))
  const { row, column } = positionOf(wrapper, at)

  const x = rowShiftPx(technique, row) + column * CELL_SIZE_PX + CELL_SIZE_PX / 2
  const y = rowTopPx(technique, row) + CELL_SIZE_PX / 2
  const border = GRID_BORDER_PX * zoom
  const extent = patternExtentPx(technique, columns, rows)
  // Each quarter turn clockwise carries the Pattern's own (x, y) to (height − y, x); composing that with itself
  // gives 180° and 270° (ticket 171), the same forward mapping patternRenderer's gridToRegion uses.
  const [dx, dy] = ((): [number, number] => {
    switch (rotation) {
      case 90:
        return [extent.height - y, x]
      case 180:
        return [extent.width - x, extent.height - y]
      case 270:
        return [y, extent.width - x]
      default:
        return [x, y]
    }
  })()
  return { clientX: border + dx * zoom, clientY: border + dy * zoom }
}

/** Presses a bead: the left button by default, `{ button: 2 }` for the right. Whether the press is released is up to the test, as it is up to a hand. */
export async function pressBead(wrapper: Anywhere, at: BeadAt, options: { button?: number; pointerType?: string } = {}): Promise<void> {
  const button = options.button ?? 0
  await surfaceRoot(wrapper).trigger('pointerdown', {
    ...beadPoint(wrapper, at),
    button,
    buttons: button === 2 ? 2 : 1,
    ...(options.pointerType ? { pointerType: options.pointerType } : {}),
  })
}

/** Moves the pointer onto a bead, with a button held to continue a stroke (`{ buttons: 1 }`) or none for a plain hover. */
export async function hoverBead(wrapper: Anywhere, at: BeadAt, options: { buttons?: number; pointerType?: string } = {}): Promise<void> {
  await surfaceRoot(wrapper).trigger('pointermove', {
    ...beadPoint(wrapper, at),
    buttons: options.buttons ?? 0,
    ...(options.pointerType ? { pointerType: options.pointerType } : {}),
  })
}

/** Moves the pointer off the Pattern. */
export async function leaveSurface(wrapper: Anywhere): Promise<void> {
  await surfaceRoot(wrapper).trigger('pointerleave')
}

/** A bead's color as a `#rrggbb`, or null while it is empty. */
export function beadColor(wrapper: Anywhere, at: BeadAt): string | null {
  const { row, column } = positionOf(wrapper, at)
  return drawnPattern(wrapper).grid[row]![column]!.color
}

/** Every bead's color, row by row. */
export function beadColors(wrapper: Anywhere): (string | null)[][] {
  return drawnPattern(wrapper).grid.map((cells) => cells.map((cell) => cell.color))
}

/** The rectangle marked out with the Select tool, if there is one. */
function selection(wrapper: Anywhere): Selection | undefined {
  return surface(wrapper).props('selection')
}

/** How many beads the Selection covers. */
export function selectedBeadCount(wrapper: Anywhere): number {
  const marked = selection(wrapper)
  if (!marked) {
    return 0
  }
  const { rows, columns } = drawnPattern(wrapper)
  return (
    Math.max(0, Math.min(marked.top + marked.rows, rows) - marked.top) *
    Math.max(0, Math.min(marked.left + marked.columns, columns) - marked.left)
  )
}

/** The beads a hover preview shows a color on, each with the color it shows (a pasted block's own, or the paint color); a bead with none is drawn as a plain outline and is left out. */
export function previewedBeads(wrapper: Anywhere): (GridPosition & { color: string })[] {
  const cells: PreviewCell[] = surface(wrapper).props('previewCells') ?? []
  const fallback = surface(wrapper).props('previewColor')
  return cells.flatMap((cell) => {
    const color = cell.color ?? fallback
    return color ? [{ row: cell.row, column: cell.column, color }] : []
  })
}

/** Mirror's axis counts as the surface draws them: a line for each. */
export function mirrorAxes(wrapper: Anywhere): { columns: number; rows: number } {
  return surface(wrapper).props('mirrorAxisCounts') ?? { columns: 0, rows: 0 }
}

/** The beads the "Mirror current" hover dims. */
export function dimmedBeads(wrapper: Anywhere): GridPosition[] {
  return surface(wrapper).props('dimmedCells') ?? []
}

/** How far the weaver has got, as the surface draws it: the rows (or columns) behind the pointer are finished, dimmed; the one at it is outlined. */
export function rowProgressView(wrapper: Anywhere) {
  const { enabled, direction, currentRow, currentColumn } = drawnPattern(wrapper).rowProgress
  const current = direction === 'rows' ? currentRow : currentColumn
  return { enabled, direction, current, finished: enabled ? current : 0, markerShown: enabled }
}
