import { beadsFromColors } from '../../domain/canvas'
import { createProject } from '../../domain/createProject'
import { withLayer } from '../../domain/layerRecord'
import type { Project } from '../../domain/project'
import type { Translations } from '../../i18n/translations'

// The demo's own Projects (Homepage card, What's inside, ticket 0797): "Kaleidoscope", the one the tour plays on, an
// open Canvas with no Frame on Delica 11/0, and "Heart" and "Bracelet", which only its Saved Projects lists.

/** The Bead every demo Project is on. */
const DEMO_BEAD = 'miyuki/delica/11-0'

/** The colors the tour draws with: Miyuki's own color families, so each is a swatch of the demo's Palette. */
export const DEMO_COLORS = {
  W: '#ffffff',
  Y: '#f2c94c',
  O: '#f2994a',
  R: '#e63746',
  B: '#2f6fed',
  G: '#27ae60',
  P: '#ec5990',
} as const

export type DemoColor = keyof typeof DEMO_COLORS

/** A drawing in rows of letters, `.` for an empty position. */
function colorsOf(rows: readonly string[]): (string | null)[][] {
  return rows.map((row) => [...row].map((letter) => (letter === '.' ? null : DEMO_COLORS[letter as DemoColor])))
}

/** A Project of the demo's, its Frame (if any) holding `frameRows`. */
function demoProject(name: string, frameRows?: readonly string[]): Project {
  const size = frameRows ? { unit: 'beads' as const, width: frameRows[0].length, height: frameRows.length } : undefined
  const project = createProject({ name, technique: 'loom', beadId: DEMO_BEAD, size, background: 1 })
  return frameRows ? withLayer(project, 'frame', { beads: beadsFromColors(colorsOf(frameRows)) }) : project
}

const HEART = [
  '...........',
  '..RR...RR..',
  '.RRRR.RRRR.',
  '.RWRRRRRRR.',
  '.RRRRRRRRR.',
  '..RRRRRRR..',
  '...RRRRR...',
  '....RRR....',
  '.....R.....',
  '...........',
]

const BRACELET = Array.from({ length: 24 }, (_, row) =>
  Array.from({ length: 7 }, (_, column) => (Math.abs(column - 3) === (row % 6 < 3 ? row % 3 : 3 - (row % 3)) ? 'B' : row % 6 === 0 ? 'Y' : 'W')).join(''),
)

/** The demo's library, freshly made: Kaleidoscope with nothing drawn, Heart and Bracelet. Kaleidoscope is the newest,
 * so it is the one that opens. */
export function demoLibrary(t: Translations): Project[] {
  const { kaleidoscope, heart, bracelet } = t.homepage.inside.demo
  const earlier = (project: Project, minutes: number) => ({ ...project, updatedAt: project.updatedAt - minutes * 60_000, createdAt: project.createdAt - minutes * 60_000 })
  return [earlier(demoProject(bracelet, BRACELET), 2), earlier(demoProject(heart, HEART), 1), demoProject(kaleidoscope)]
}

/** One of the tour's drawings on the open Canvas: its rows, from the position given. */
export interface DemoDrawing {
  row: number
  column: number
  rows: readonly string[]
}

/** The Frame the tour sets from a Selection, an 11 × 11 loom Frame: where its first bead lies on the Canvas. */
export const DEMO_FRAME = { row: 6, column: 30, rows: 11, columns: 11 } as const

/** The first row's drawing (ticket 0802): one simple kaleidoscope the size of the Frame, in three colors, the same
 * turned any quarter or mirrored. A Selection round it becomes the Frame. */
export const DEMO_DRAWING: DemoDrawing = {
  row: DEMO_FRAME.row,
  column: DEMO_FRAME.column,
  rows: [
    '...........',
    '...........',
    '.....R.....',
    '....RYR....',
    '...RBYBR...',
    '..RYYBYYR..',
    '...RBYBR...',
    '....RYR....',
    '.....R.....',
    '...........',
    '...........',
  ],
}

/** The beads the Mirror row paints round the drawing, by their place in the Frame, each color in turn (ticket 0802):
 * none on a fold's line, so Radial's four folds on the loom Frame repeat each eightfold round the middle (its quarter
 * turns and its reflection's), completing the kaleidoscope. */
export const DEMO_MIRROR_BEADS: readonly { color: DemoColor; beads: readonly (readonly [number, number])[] }[] = [
  { color: 'P', beads: [[1, 4], [2, 3]] },
  { color: 'G', beads: [[0, 4], [3, 1]] },
]

/** The Canvas the tour's view shows across (ticket 0797): the Frame in its middle, with room on its left for the
 * Starter's Frame to be moved beside the landscape. */
export const DEMO_VIEW = { left: DEMO_FRAME.column - 21, right: DEMO_FRAME.column + 31 } as const
