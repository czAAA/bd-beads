// The Homepage's Winter charms (Homepage card, tickets 1100, 1102): from 1 December to 7 January the page around the box
// holds the card's ten bead charms and three faint X1 marks in place of the two marks.
import file from '../../docs/design/system/components/Homepage/winter-charms.json'
import { beadsFromColors } from '../domain/canvas'
import { createProject } from '../domain/createProject'
import { withLayer } from '../domain/layerRecord'
import type { Project } from '../domain/project'
import type { Technique } from '../domain/weave'
import { CELL_SIZE_PX } from '../rendering/cellSize'
import { spaceOf } from '../rendering/space'
/** The season's last day in January. */
const LAST_JANUARY_DAY = 7
/** December, as `Date.getMonth` counts from January's 0. */
const DECEMBER = 11

/** Whether the Homepage shows its winter, by the device's date; `?winter` previews it in the dev build alone. */
export function winterShown(today: Date, search: string, dev: boolean): boolean {
  if (dev && new URLSearchParams(search).has('winter')) return true
  const month = today.getMonth()
  return month === DECEMBER || (month === 0 && today.getDate() <= LAST_JANUARY_DAY)
}

/** Which side of the box a charm or mark lies on. */
export type Side = 'left' | 'right'

/** The card's arranged layout (`winter-charms.json`): each place a share of the black beside the box (`out`, 0 at the
 * box) and of the screen's height (`down`), a charm's `turn` in degrees clockwise, a mark's `size` in px at 1440. */
export interface WinterLayout {
  charms: { id: string; side: Side; out: number; down: number; turn: number; size: number }[]
  marks: { side: Side; out: number; down: number; size: number; large: boolean }[]
}

/** What the page around the box gives the charms, in CSS px: the screen, the box's edges, a charm's bead
 * (`--winter-charm-bead` grown by `--homepage-scale`), the Homepage's scale, the clear room, the least black that holds
 * charms (`--winter-charm-room`) and how far the charms drift up and down as the box turns. */
export interface WinterRoom {
  width: number
  height: number
  box: { left: number; right: number }
  bead: number
  scale: number
  clear: number
  least: number
  drift: number
}

/** A charm as it lies: its middle, its bead in px (its size and any shrinking counted) and its angle. */
export interface PlacedCharm {
  id: string
  side: Side
  x: number
  y: number
  bead: number
  turn: number
}

/** A mark as it lies: its middle and its size in px. */
export interface PlacedMark {
  side: Side
  x: number
  y: number
  size: number
  large: boolean
}

/** A charm's size in beads: how many bead widths it spans across and down. */
type CharmSizes = Readonly<Record<string, { width: number; height: number }>>

/** How far a charm may shrink to fit before it is left out (Homepage card, Room). */
const LEAST_SHRINK = 0.6
const HALF_TURN_DEGREES = 180

/** Where the winter charms and marks lie around the box: each charm whole on the black, clear of the box and the
 * screen's edge with its angle and drift counted, shrunk to fit down to 0.6 and left out under that; none where the
 * black beside the box is under the least. The marks lie at their places, cut at the edge as it comes. */
export function placeWinter(
  room: WinterRoom,
  layout: WinterLayout = WINTER_LAYOUT,
  sizes: CharmSizes = charmSizes(),
): { charms: PlacedCharm[]; marks: PlacedMark[] } {
  const black = { left: room.box.left, right: room.width - room.box.right }
  const middleX = (side: Side, out: number) =>
    side === 'left' ? room.box.left - out * black.left : room.box.right + out * black.right
  const marks = layout.marks.map(({ side, out, down, size, large }) => ({
    side,
    x: middleX(side, out),
    y: down * room.height,
    size: size * room.scale,
    large,
  }))
  const charms = layout.charms.flatMap(({ id, side, out, down, turn, size }) => {
    const beads = sizes[id]
    if (!beads || !(black[side] >= room.least)) return []
    const x = middleX(side, out)
    const y = down * room.height
    const bead = room.bead * size
    const angle = (turn * Math.PI) / HALF_TURN_DEGREES
    const [cos, sin] = [Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle))]
    const halfWidth = ((beads.width * cos + beads.height * sin) * bead) / 2
    const halfHeight = ((beads.width * sin + beads.height * cos) * bead) / 2
    const [inner, outer] = side === 'left' ? [room.box.left, 0] : [room.box.right, room.width]
    const across = Math.min(Math.abs(x - inner), Math.abs(outer - x)) - room.clear
    const upDown = Math.min(y, room.height - y) - room.clear - room.drift
    const fit = Math.min(1, across / halfWidth, upDown / halfHeight)
    return fit < LEAST_SHRINK ? [] : [{ id, side, x, y, bead: bead * fit, turn }]
  })
  return { charms, marks }
}

/** The signed-off arranged layout, the same every visit. */
const WINTER_LAYOUT = file.layout as WinterLayout

/** No bead at a place in a charm's rows. */
const NO_BEAD = '.'
const charms: Readonly<Record<string, { name: string; technique: string; width: number; rows: string[] }>> = file.charms
const colors: Readonly<Record<string, string>> = file.colors

const projects = new Map<string, Project>()

/** A charm as the Project it is (Homepage card): its painted beads on its Technique and the card's Bead, drawn by the
 * Project renderer as the Welcome piece is. */
export function charmProject(id: string): Project | undefined {
  const charm = charms[id]
  if (!charm) return undefined
  let project = projects.get(id)
  if (!project) {
    const rows = charm.rows.map((row) =>
      [...row.padEnd(charm.width, NO_BEAD)].map((bead) => (bead === NO_BEAD ? null : (colors[bead] ?? null))),
    )
    const technique = charm.technique as Technique
    const size = { unit: 'beads' as const, width: charm.width, height: rows.length }
    const made = createProject({ name: charm.name, technique, beadId: file.bead, size, background: 1 })
    project = withLayer(made, 'frame', { beads: beadsFromColors(rows) })
    projects.set(id, project)
  }
  return project
}

let sizes: CharmSizes | undefined

/** Every charm's size in beads, as the renderer lays it out (a brick row's half-bead shift and a loom bead's height
 * counted). */
function charmSizes(): CharmSizes {
  sizes ??= Object.fromEntries(
    Object.keys(charms).map((id) => {
      const { extent } = spaceOf(charmProject(id)!, false)
      return [id, { width: extent.width / CELL_SIZE_PX, height: extent.height / CELL_SIZE_PX }]
    }),
  )
  return sizes
}
