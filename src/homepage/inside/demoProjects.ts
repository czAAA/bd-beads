import { beadsFromColors } from '../../domain/canvas'
import { createProject } from '../../domain/createProject'
import { addUsedColor, defaultPalette } from '../../domain/palette'
import { setPalette } from '../../domain/paletteEdits'
import type { GridPosition } from '../../domain/grid'
import { withLayer } from '../../domain/layerRecord'
import type { Project } from '../../domain/project'
import { starterById } from '../../domain/starters'
import { DEFAULT_TECHNIQUE, type Technique } from '../../domain/weave'
import type { Translations } from '../../i18n/translations'
import { PEACOCK_CUFF, PEACOCK_RING, type PeacockDrawing, type PeacockPart } from './peacock'

// The demo's own Projects (Homepage card, What's inside, ticket 0797): "Ring", the one the tour plays on, an open peyote
// Canvas with no Frame on Delica 11/0, and "Heart" and "Bracelet", which only its Saved Projects lists; and where the
// tour's peacock feather (peacock.ts, ticket 0831) lies on Ring's Canvas.

/** The Bead every demo Project is on. */
const DEMO_BEAD = 'miyuki/delica/11-0'

/** The colors the demo draws with: Miyuki's own color families, each a swatch of the demo's Palette, and the three the
 * peacock needs that the families lack (teal, deep blue, deep green), which Ring's Palette starts with. */
export const DEMO_COLORS = {
  W: '#ffffff',
  Y: '#f2c94c',
  R: '#e63746',
  B: '#2f6fed',
  G: '#27ae60',
  D: '#d4af37',
  T: '#17c3c9',
  N: '#1c1f6e',
  E: '#0c4a3a',
} as const

export type DemoColor = keyof typeof DEMO_COLORS

/** Ring's own colors, added to its Palette as Custom color adds them: the eye's teal, its deep blue pupil and the deep
 * green ground. */
const DEMO_OWN_COLORS: readonly DemoColor[] = ['T', 'N', 'E']

/** The color of each part of the feather: a barb is the eye's green, the ground deep green. */
export const PEACOCK_COLORS: Record<PeacockPart, DemoColor> = { G: 'G', D: 'D', T: 'T', B: 'B', N: 'N', g: 'G', '.': 'E' }

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

/** The Project with Ring's own colors in its Palette's last slots. */
function withOwnColors(project: Project): Project {
  const builtIns = defaultPalette(DEMO_BEAD)
  const palette = DEMO_OWN_COLORS.reduce((ids, color) => addUsedColor(ids, DEMO_COLORS[color], builtIns).ids, project.palette)
  return setPalette(project, palette)
}

/** The demo's library, freshly made: Ring with nothing drawn, Heart and Bracelet. Ring is the newest, so it is the one
 * that opens; its Canvas keeps the quarter turn a new peyote Project starts with, so its band lies across the demo's
 * wide box the way a ring is woven (ticket 0831). */
export function demoLibrary(t: Translations): Project[] {
  const { ring, heart, bracelet } = t.homepage.inside.demo
  const earlier = (project: Project, minutes: number) => ({ ...project, updatedAt: project.updatedAt - minutes * 60_000, createdAt: project.createdAt - minutes * 60_000 })
  return [earlier(demoProject(bracelet, BRACELET), 2), earlier(demoProject(heart, HEART), 1), withOwnColors(demoProject(ring, undefined, DEMO_TECHNIQUE))]
}

/** A Frame of the tour's on Ring's turned Canvas: its first bead, its rows (the beads along the piece as it lies
 * across) and its columns (its lines, top to bottom). It starts on an even column, as a peyote Frame must. */
export interface DemoFrame {
  row: number
  column: number
  rows: number
  columns: number
}

/** The Frame the first row sets from a Selection: a peyote ring band, 36 beads long and woven across its 7, the size of
 * the Starters' rings at their 54 mm (DEMO_STARTER's among them). */
export const DEMO_FRAME: DemoFrame = { row: 10, column: 12, rows: PEACOCK_RING.length, columns: PEACOCK_RING.lines }

/** The Frame the Reference image row sets: a cuff 48 long and 23 wide, its middle where the band's is. */
export const DEMO_CUFF: DemoFrame = {
  row: DEMO_FRAME.row - (PEACOCK_CUFF.length - PEACOCK_RING.length) / 2,
  column: DEMO_FRAME.column - (PEACOCK_CUFF.lines - PEACOCK_RING.lines) / 2,
  rows: PEACOCK_CUFF.length,
  columns: PEACOCK_CUFF.lines,
}

/** Where a bead of a drawing lies on Ring's Canvas: its line is the Frame's column, how far along the Frame's row. On
 * the turned Canvas the rows run right to left, so the piece's start is at the right and every eye reads the same. */
export function onCanvas(frame: DemoFrame, line: number, along: number): GridPosition {
  return { row: frame.row + along, column: frame.column + line }
}

/** The Mirror row's Repeat on the ring: 3 Axes cut the band into 4 strips an eye long. */
export const DEMO_RING_AXES = PEACOCK_RING.length / PEACOCK_RING.period - 1

/** The cuff's 2 Axes between its 3 eyes, a strip an eye long each: Colors built in paints a pupil in each. */
export const DEMO_CUFF_AXES = PEACOCK_CUFF.length / PEACOCK_CUFF.period - 1

/** The strip of the ring the first row draws its eye in, and the one the Mirror row draws it in again: the first two
 * from the left as the band lies. */
export const DEMO_FIRST_STRIP = DEMO_RING_AXES
export const DEMO_MIRROR_STRIP = DEMO_RING_AXES - 1

/** Project editing's three gold beads, by line and how far along: on the pupil's line, on the ground beside the first
 * eye, where the second eye leaves ground too. */
export const DEMO_EDIT_BEADS: readonly (readonly [number, number])[] = [[4, 27], [4, 26], [4, 25]]

/** A drawing's colors as its Frame holds them: a row of the Frame for each bead along the piece. */
function frameColors(drawing: PeacockDrawing): string[][] {
  return Array.from({ length: drawing.length }, (_, along) => drawing.rows.map((line) => DEMO_COLORS[PEACOCK_COLORS[line[along] as PeacockPart]]))
}

/** The Welcome section's piece (ticket 0831; Homepage card): the peacock cuff the tour traces, finished as the tour
 * leaves it at the end of Reference image (no purple pupils). A peyote Frame 48 long and 23 wide on a Canvas turned as
 * a new peyote Project's is, so it lies across as it is woven. */
export function finishedCuff(): Project {
  const size = { unit: 'beads' as const, width: PEACOCK_CUFF.lines, height: PEACOCK_CUFF.length }
  const project = createProject({ name: '', technique: DEMO_TECHNIQUE, beadId: DEMO_BEAD, size, background: 1 })
  return withLayer(project, 'frame', { beads: beadsFromColors(frameColors(PEACOCK_CUFF)) })
}

/** The size the Welcome piece's caption names, long by wide. */
export const DEMO_PIECE_SIZE = { long: PEACOCK_CUFF.length, wide: PEACOCK_CUFF.lines } as const

/** How many beads of the Canvas the tour's view shows either side of the cuff's Frame (Homepage card, Its view). */
export const DEMO_VIEW_MARGIN = 4
