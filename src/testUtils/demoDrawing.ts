import { frameIdIn } from './frameId'
import { beadColorAt } from '../domain/layerBeads'
import { frameOf } from '../domain/layerRecord'
import { placeOf as placeOfFrame } from './placeOf'
import type { Project } from '../domain/project'
import { DEMO_COLORS, PEACOCK_COLORS } from '../homepage/inside/demoProjects'
import type { PeacockDrawing } from '../homepage/inside/peacock'

// What's inside's tour read back from the demo's Project (ticket 0831): its Frame's place and its beads as a drawing's
// lines, for comparing with the peacock drawings the tour traces and paints.

/** The feather's colors by part, the demo's own: a barb is the eye's green, the ground deep green. */
const COLORS: Record<string, string> = Object.fromEntries(Object.entries(PEACOCK_COLORS).map(([part, color]) => [part, DEMO_COLORS[color]]))

/** The Frame's size in its own rows and columns, and the Canvas position it starts on (where its centre lies, spec 1234),
 * and nothing else of it. */
export function placeOf(project: Project) {
  const { rows, columns } = frameOf(project)!
  const { row, column } = placeOfFrame(project)
  return { row, column, rows, columns }
}

/** The Frame's beads as lines of parts, as a drawing writes them: a line for each column, a part for each bead along, by the Frame's own rows and columns.
 * A bead of another color reads `?`, an empty one a space. */
export function linesOf(project: Project): string[] {
  const { rows, columns } = frameOf(project)!
  const part = (color: string | null) => (color ? (Object.keys(COLORS).find((key) => COLORS[key] === color.toLowerCase()) ?? '?') : ' ')
  return Array.from({ length: columns }, (_, line) => Array.from({ length: rows }, (_, along) => part(beadColorAt(project, along, line, frameIdIn(project)))).join(''))
}

/** A drawing's lines with barbs read as the green they are painted in. */
export function painted(drawing: PeacockDrawing): string[] {
  return drawing.rows.map((line) => line.replaceAll('g', 'G'))
}
