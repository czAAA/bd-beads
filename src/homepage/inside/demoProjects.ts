import { beadsFromColors } from '../../domain/canvas'
import { createProject } from '../../domain/createProject'
import { withLayer } from '../../domain/layerRecord'
import type { Project } from '../../domain/project'
import { starterById } from '../../domain/starters'
import { DEFAULT_TECHNIQUE, type Technique } from '../../domain/weave'
import type { Translations } from '../../i18n/translations'

// The demo's own Projects (Homepage card, What's inside, ticket 0797): "Ring", the one the tour plays on, an open peyote
// Canvas with no Frame on Delica 11/0, and "Heart" and "Bracelet", which only its Saved Projects lists.

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
  K: '#1a1a1a',
  D: '#d4af37',
} as const

export type DemoColor = keyof typeof DEMO_COLORS

/** A drawing in rows of letters, `.` for an empty position. */
function colorsOf(rows: readonly string[]): (string | null)[][] {
  return rows.map((row) => [...row].map((letter) => (letter === '.' ? null : DEMO_COLORS[letter as DemoColor])))
}

/** The ring Starter the tour's Starters row lays in place of the Ring's Frame, the same size; its Technique (peyote) is
 * the one the Ring is woven in. */
export const DEMO_STARTER = 'ringChevrons'
export const DEMO_TECHNIQUE: Technique = starterById(DEMO_STARTER).weave.technique

/** A Project of the demo's, its Frame (if any) holding `frameRows`. */
function demoProject(name: string, frameRows?: readonly string[], technique: Technique = DEFAULT_TECHNIQUE): Project {
  const size = frameRows ? { unit: 'beads' as const, width: frameRows[0].length, height: frameRows.length } : undefined
  const project = createProject({ name, technique, beadId: DEMO_BEAD, size, background: 1 })
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

/** The demo's library, freshly made: Ring with nothing drawn, Heart and Bracelet. Ring is the newest, so it is the one
 * that opens. */
export function demoLibrary(t: Translations): Project[] {
  const { ring, heart, bracelet } = t.homepage.inside.demo
  const earlier = (project: Project, minutes: number) => ({ ...project, updatedAt: project.updatedAt - minutes * 60_000, createdAt: project.createdAt - minutes * 60_000 })
  return [earlier(demoProject(bracelet, BRACELET), 2), earlier(demoProject(heart, HEART), 1), lyingAcross(demoProject(ring, undefined, DEMO_TECHNIQUE))]
}

/** The Ring's Canvas unturned: peyote starts a quarter turn round (its columns upright), and the band reads lying across
 * the demo's wide box, as its size says (7 beads wide, 36 round). */
function lyingAcross(project: Project): Project {
  const [canvas, ...rest] = project.layers
  return { ...project, layers: [{ ...canvas, orientation: 0 }, ...rest] }
}

/** One of the tour's drawings on the open Canvas: its rows, from the position given. */
interface DemoDrawing {
  row: number
  column: number
  rows: readonly string[]
}

/** The Frame the tour sets from a Selection: a peyote ring band, 7 beads wide and 36 round, the size of the Starters'
 * rings at their 54 mm (DEMO_STARTER's among them): where its first bead lies on the Canvas. */
export const DEMO_FRAME = { row: 6, column: 30, rows: 7, columns: 36 } as const

/** The Mirror row's Repeat: 8 Axes across the band cut it into 9 strips, one letter wide, so the beads painted in the
 * first strip go all round the ring: a dot above and below each gap between letters. */
export const DEMO_REPEAT_AXES = 8

/** How wide a letter is with its gap: one strip of the Repeat. */
const LETTER_WIDTH = DEMO_FRAME.columns / (DEMO_REPEAT_AXES + 1)

/** The first row's lettering: nine letters of a flowing, elvish-looking script of our own, in Miyuki gold, a letter
 * every `LETTER_WIDTH` beads (one strip of the Mirror row's Repeat). Each letter is written as a pen would, a stroke or two of
 * neighbouring beads, left to right: [row, column] in the Frame. The Frame round it is then filled black. */
const LETTERS: readonly (readonly (readonly [number, number])[])[][] = [
  // A stem down, its bow to the right, a dot over it.
  [[[4, 0], [3, 0], [2, 0], [1, 0], [1, 1], [2, 2], [3, 1]], [[0, 1]]],
  // An arch.
  [[[3, 0], [2, 0], [1, 1], [2, 2], [3, 2]]],
  // A stem up on the right, its bow to the left.
  [[[0, 2], [1, 2], [2, 2], [3, 2], [3, 1], [2, 0], [1, 1]]],
  // A cup, a dot over it.
  [[[1, 0], [2, 0], [3, 1], [2, 2], [1, 2]], [[0, 1]]],
  // A stem down on the right, its bow to the left.
  [[[4, 2], [3, 2], [2, 2], [1, 2], [1, 1], [2, 0], [3, 1]]],
  // A stem up, its bow to the right.
  [[[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [2, 2], [1, 1]]],
  // An arch, two dots over it.
  [[[3, 0], [2, 0], [1, 1], [2, 2], [3, 2]], [[0, 0]], [[0, 2]]],
  // A stem down, its bow to the right.
  [[[4, 0], [3, 0], [2, 0], [1, 0], [1, 1], [2, 2], [3, 1]]],
  // A cup.
  [[[1, 0], [2, 0], [3, 1], [2, 2], [1, 2]]],
]

/** The lettering's strokes, in the Frame: each letter a strip on, its rows one down from the band's edge. */
export const DEMO_LETTERING: readonly (readonly (readonly [number, number])[])[] = LETTERS.flatMap((letter, index) =>
  letter.map((stroke) => stroke.map(([row, column]) => [row + 1, column + index * LETTER_WIDTH] as const)),
)

/** The lettering as rows of letters, `D` for gold, `.` for empty.
 * @internal Its test checks the lettering's size and color. */
export const DEMO_DRAWING: DemoDrawing = {
  row: DEMO_FRAME.row,
  column: DEMO_FRAME.column,
  rows: Array.from({ length: DEMO_FRAME.rows }, (_, row) =>
    Array.from({ length: DEMO_FRAME.columns }, (_, column) => (DEMO_LETTERING.some((stroke) => stroke.some(([down, across]) => down === row && across === column)) ? 'D' : '.')).join(''),
  ),
}

/** The beads the Mirror row paints in the Repeat's first strip. */
export const DEMO_MIRROR_BEADS: readonly { color: DemoColor; beads: readonly (readonly [number, number])[] }[] = [{ color: 'D', beads: [[0, 3], [6, 3]] }]

/** The Reference image row's panorama (landscape.ts draws it, the ghost traces it): the band's beads across and down,
 * and how much taller a bead's step is than it is wide (Delica 11/0 in peyote). */
export const PANORAMA = { columns: DEMO_FRAME.columns, rows: DEMO_FRAME.rows, cellAspect: 1.23 } as const

/** The ridge's row in each column: the snow line the ghost paints, never below row 4, so the slopes are one Fill. Next
 * columns differ by a row at most, and the stroke steps down its own column first: peyote's half-bead shift leaves the
 * sky's Fill no gap. */
export const RIDGE: readonly number[] = [4, 4, 3, 3, 2, 1, 2, 3, 3, 4, 4, 3, 2, 2, 1, 1, 2, 3, 4, 4, 4, 4, 3, 2, 1, 2, 2, 3, 4, 4, 3, 3, 4, 4, 4, 4]

/** Where the sun is: its top-left bead and size, in the sky right of the last peak. */
export const SUN = { row: 0, column: 29, size: 2 } as const

/** The Canvas the tour's view shows across (ticket 0797): the Frame in its middle, with room for its sheet. The Starter's
 * ring lands where the Frame was, the same size, so nothing needs room beside it. */
export const DEMO_VIEW = { left: DEMO_FRAME.column - 8, right: DEMO_FRAME.column + DEMO_FRAME.columns + 8 } as const
