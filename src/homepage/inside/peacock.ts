// The peacock feather What's inside draws (Homepage card, ticket 0831): an eye on the ring by hand, three on the cuff
// traced from the reference picture. Each bead takes the picture's color at its centre, so the drawing is data the
// tests check, and the picture is made from the same data.

/** What a bead of the feather is: the eye's green ring, gold, teal, blue and deep blue pupil (`N`), a barb (`g`, green
 * over the ground) or the ground (`.`). */
export type PeacockPart = 'G' | 'D' | 'T' | 'B' | 'N' | 'g' | '.'

/** A bead of Delica 11/0 on the piece lying across, in mm: along the piece and across it. */
const BEAD_MM = { along: 1.6, across: 1.3 }

/** A piece of the feather as it lies across: `lines` beads wide, `length` long, an eye every `period` beads; the cuff's
 * eyes are smaller in their piece and have barbs. */
interface PeacockShape {
  lines: number
  length: number
  period: number
  barbs: boolean
}

/** A drawn piece: its shape and its beads as `lines` rows of parts, top to bottom, every other line half a bead on. */
export interface PeacockDrawing extends PeacockShape {
  rows: readonly string[]
}

function mod(value: number, by: number): number {
  return ((value % by) + by) % by
}

/** The feather at a point of the piece lying across: `x` mm along it, `y` mm down it. */
export function peacockAt(x: number, y: number, { lines, period, barbs }: PeacockShape): PeacockPart {
  const height = lines * BEAD_MM.across
  const pitch = period * BEAD_MM.along
  const size = (barbs ? 0.41 : 0.5) * height
  const dx = mod(x, pitch) - pitch / 2
  const dy = y - 0.54 * height
  const d = Math.hypot(dx / 1.15, dy < 0 ? dy / 1.22 : dy) / size
  const inner = Math.hypot(dx / 1.15, dy - 0.14 * size) / size
  if (inner < 0.16) return 'N'
  if (inner < 0.34) return 'B'
  if (d < 0.52) return 'T'
  if (d < 0.7) return 'D'
  if (d < 0.86) return 'G'
  const angle = Math.atan2(dy, dx)
  return barbs && mod(Math.floor((angle * 18) / Math.PI), 3) === 0 && d < 1.3 ? 'g' : '.'
}

/** A bead's centre on the piece lying across, in mm: odd lines lie half a bead on. */
export function peacockCentre(line: number, along: number): { x: number; y: number } {
  return { x: (along + 0.5 + (line % 2 ? 0.5 : 0)) * BEAD_MM.along, y: (line + 0.5) * BEAD_MM.across }
}

/** The feather's part at a bead: its line from the top, and how far along the piece. Every eye is read as the first,
 * so they are the same bead for bead (the Mirror's Repeat lays one in all).
 * @internal Its test reads the pupil's bead through it. */
export function peacockPart({ line, along }: { line: number; along: number }, shape: PeacockShape): PeacockPart {
  const { x, y } = peacockCentre(line, along % shape.period)
  return peacockAt(x, y, shape)
}

function drawn(shape: PeacockShape): PeacockDrawing {
  const rows = Array.from({ length: shape.lines }, (_, line) => Array.from({ length: shape.length }, (_, along) => peacockPart({ line, along }, shape)).join(''))
  return { ...shape, rows }
}

/** How many beads of one eye are drawn: everything but the ground. */
function eyeBeads({ rows, period }: PeacockDrawing): number {
  return rows.reduce((sum, row) => sum + [...row.slice(0, period)].filter((part) => part !== '.').length, 0)
}

/** The ring's band, 36 long and 7 wide: four eyes, 9 beads each, no barbs. */
export const PEACOCK_RING: PeacockDrawing = drawn({ lines: 7, length: 36, period: 9, barbs: false })

/** The cuff, 48 long and 23 wide: three eyes, 16 beads each, with their barbs. */
export const PEACOCK_CUFF: PeacockDrawing = drawn({ lines: 23, length: 48, period: 16, barbs: true })

/** @internal Its test checks an eye's size against the ticket's counts. */
export const RING_EYE_BEADS = eyeBeads(PEACOCK_RING)
/** @internal As `RING_EYE_BEADS`. */
export const CUFF_EYE_BEADS = eyeBeads(PEACOCK_CUFF)
