import { beadColorAt, frameGrid, projectDimensions } from '../domain/project'
import type { VueWrapper } from '@vue/test-utils'
import ProjectSurface from '../components/canvas/ProjectSurface.vue'
import { type GridPosition, type PreviewCell, type Rotation, type Technique } from '../domain/grid'
import type { Selection } from '../domain/selection'
import { OPEN_SPACE } from '../rendering/space'
import type { RulerLabel } from '../rendering/rulers'
import { surfaceView } from '../rendering/surfaceView'

/**
 * Pressing, hovering and reading beads on the Drawing surface from a test (tickets 109 and 110). The surface is one
 * element and jsdom does no layout, so a bead is found the way a person's pointer finds it: by where it is. These put a
 * pointer event at the coordinates of a bead, which the surface then hit-tests exactly as it does for a real pointer
 * (see the Surface view's pointToBead), and read what the app did from the state it draws from: the Project, the Selection, the
 * hover preview, Mirror's axes and the dimmed beads are the props the surface is handed.
 *
 * A bead is named by its row and column, or by its index counting along the rows (row-major), which is how a grid of
 * elements was indexed and how most of the tests that used one count.
 */
export type BeadAt = number | GridPosition

type Anywhere = VueWrapper<never> | VueWrapper

function surfaceRoot(wrapper: Anywhere) {
  const root = wrapper.find('[data-testid="project-surface"]')
  if (!root.exists()) {
    throw new Error('No Project is drawn: there is no surface to press')
  }
  return root
}

function surface(wrapper: Anywhere) {
  return wrapper.findComponent(ProjectSurface)
}

/** What the open Project is, as the surface was handed it. */
export function drawnProject(wrapper: Anywhere) {
  return surface(wrapper).props('project')
}

/** A bead's row and column, from either way of naming it. */
function positionOf(wrapper: Anywhere, at: BeadAt): GridPosition {
  if (typeof at !== 'number') {
    return at
  }
  const { columns } = projectDimensions(drawnProject(wrapper))
  return { row: Math.floor(at / columns), column: at % columns }
}

/** Where a bead's centre is in the page, for a surface at the corner of it, whichever Technique, zoom, rotation and scroll. */
function beadPoint(wrapper: Anywhere, at: BeadAt): { clientX: number; clientY: number } {
  const root = surfaceRoot(wrapper)
  const technique = root.attributes('data-technique') as Technique
  const rotation = Number(root.attributes('data-rotation')) as Rotation
  const zoom = Number(root.attributes('data-zoom'))
  const scrollX = Number(root.attributes('data-scroll-x'))
  const scrollY = Number(root.attributes('data-scroll-y'))
  const { row, column } = positionOf(wrapper, at)

  const point = surfaceView({ space: OPEN_SPACE, technique, rotation, zoom, scroll: { x: scrollX, y: scrollY } }).beadToPoint({ row, column })
  return { clientX: point.x, clientY: point.y }
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

/** Moves the pointer off the Project. */
export async function leaveSurface(wrapper: Anywhere): Promise<void> {
  await surfaceRoot(wrapper).trigger('pointerleave')
}

/** A bead's color as a `#rrggbb`, or null while it is empty. */
export function beadColor(wrapper: Anywhere, at: BeadAt): string | null {
  const { row, column } = positionOf(wrapper, at)
  return beadColorAt(drawnProject(wrapper), row, column)
}

/** Every bead's color, row by row. */
export function beadColors(wrapper: Anywhere): (string | null)[][] {
  return frameGrid(drawnProject(wrapper)).map((cells) => cells.map((cell) => cell.color))
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
  const { rows, columns } = projectDimensions(drawnProject(wrapper))
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
  const { enabled, direction, currentRow, currentColumn } = drawnProject(wrapper).rowProgress
  const current = direction === 'rows' ? currentRow : currentColumn
  return { enabled, direction, current, finished: enabled ? current : 0, markerShown: enabled }
}

/** Every ruler number the surface drew: the numbers of the Ruler layout it built for its view. */
export function rulerNumbers(wrapper: Anywhere): RulerLabel[] {
  return surface(wrapper).vm.rulerLayout.labels
}

/**
 * Presses the number of a row or column on a ruler, as a pointer does: `index` counts from the first (0), and `edge` is
 * the side it is on — the left or top ruler (start) or the right or bottom one (end), which only a Frame has.
 */
export async function pressRulerNumber(wrapper: Anywhere, axis: 'row' | 'column', index: number, edge: 'start' | 'end' = 'start'): Promise<void> {
  const matches = rulerNumbers(wrapper)
    .filter((label) => label.axis === axis && label.index === index)
    .sort((a, b) => (axis === 'row' ? a.x - b.x : a.y - b.y))
  const label = edge === 'start' ? matches[0] : matches.at(-1)
  if (!label || (edge === 'end' && matches.length < 2)) {
    throw new Error(`No ${edge} ${axis} ruler number ${index + 1} to press`)
  }
  await surfaceRoot(wrapper).trigger('pointerdown', { clientX: label.x, clientY: label.y, button: 0, buttons: 1 })
}
