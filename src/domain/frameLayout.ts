import type { GridPosition } from './grid'

// A Custom frame's layout (ADR 0077, spec 0590): its panels and its bead positions, each with a centre and an angle, in
// bead widths from the bounding rectangle's top left. A position is named by its round (row, from the centre) and its
// place in that round (column, round the shape from panel 0), so the beads keep their names when rounds are added.

/** A point of a layout, in bead widths. */
export interface LayoutPoint {
  x: number
  y: number
}

/** One bead position: its name, its panel, its centre and the angle its panel lies at (radians, clockwise on screen). */
export interface LayoutPosition extends GridPosition, LayoutPoint {
  panel: number
  angle: number
}

/** What a kind's panel builder makes of its settings. */
export interface FrameLayout {
  positions: readonly LayoutPosition[]
  panels: number
  /** The bounding rectangle, in bead widths: the Frame's footprint is the rows and columns that cover it. */
  width: number
  height: number
  /** Where the Seams meet. */
  centre: LayoutPoint
  /** The Seams between panels, each a line from the centre towards a corner, as far as the bounding rectangle. */
  seams: readonly (readonly [LayoutPoint, LayoutPoint])[]
  /** How far a bead of it reaches across its panel, in bead widths: rounds that nest close leave less room. */
  beadDepth: number
}

/** Beads whose centres are this close touch: a bead's neighbour in the round next to it, or its corner partner. Two
 * beads of one round on one side sit two widths apart, the rounds either side lying between them. */
const TOUCHING = 1.5

const layouts = new Map<string, FrameLayout>()

/** Geometric peyote in Rounds from the centre (research: custom-frame-beading-order.md): `corners` panels, round n with n
 * beads a side (k × n), a corner pair split between its two sides; a round's beads two widths apart, each round
 * 1 / tan(180° / k) further out so the rounds nest and the sides stay straight. Built once per size. */
export function roundsLayout(corners: number, rounds: number): FrameLayout {
  const key = `${corners}:${rounds}`
  const known = layouts.get(key)
  if (known) return known
  const half = Math.PI / corners
  const pitch = 1 / Math.tan(half)
  // The first round sits far enough out that no bead crosses a Seam.
  const first = pitch / 2 + 0.5
  const radius = (first + (rounds - 1) * pitch + 0.5) / Math.cos(half)
  const sideAngle = (panel: number) => (panel * 2 * Math.PI) / corners
  const beadDepth = Math.min(1, 2 * pitch)

  // Worked out round the centre at 0, 0, then moved so the beads sit in the middle of the box round them.
  const raw: LayoutPosition[] = []
  for (let round = 0; round < rounds; round += 1) {
    const out = first + round * pitch
    for (let panel = 0; panel < corners; panel += 1) {
      const angle = sideAngle(panel)
      const along = { x: Math.cos(angle), y: Math.sin(angle) }
      const normal = { x: -along.y, y: along.x }
      for (let place = 0; place <= round; place += 1) {
        // Placed from the side's end that meets the panel before towards the next, so a round runs on round the shape.
        const offset = round - 2 * place
        raw.push({ row: round, column: panel * (round + 1) + place, panel, angle, x: normal.x * out + along.x * offset, y: normal.y * out + along.y * offset })
      }
    }
  }
  // The box hugs the beads, half a bead's diagonal round their centres, not the empty points of the shape's corners.
  const pad = Math.hypot(0.5, beadDepth / 2)
  const left = Math.min(...raw.map(({ x }) => x)) - pad
  const top = Math.min(...raw.map(({ y }) => y)) - pad
  const width = Math.max(...raw.map(({ x }) => x)) + pad - left
  const height = Math.max(...raw.map(({ y }) => y)) + pad - top
  const centre = { x: -left, y: -top }
  const positions = raw.map((position) => ({ ...position, x: position.x + centre.x, y: position.y + centre.y }))
  // A Seam runs from the centre towards its corner, as far as the box.
  const seamEnd = (panel: number) => {
    const towards = sideAngle(panel) + Math.PI / 2 - half
    const dx = Math.cos(towards)
    const dy = Math.sin(towards)
    const reach = Math.min(radius, dx > 0 ? (width - centre.x) / dx : dx < 0 ? -centre.x / dx : Infinity, dy > 0 ? (height - centre.y) / dy : dy < 0 ? -centre.y / dy : Infinity)
    return { x: centre.x + dx * reach, y: centre.y + dy * reach }
  }

  const layout: FrameLayout = {
    positions,
    panels: corners,
    width,
    height,
    centre,
    seams: Array.from({ length: corners }, (_unused, panel) => [centre, seamEnd(panel)] as const),
    beadDepth,
  }
  layouts.set(key, layout)
  return layout
}

const indexes = new WeakMap<FrameLayout, Map<string, LayoutPosition>>()

/** A position's key in a layout's index. */
const keyOf = ({ row, column }: GridPosition): string => `${row}:${column}`

function indexOf(layout: FrameLayout): Map<string, LayoutPosition> {
  let index = indexes.get(layout)
  if (!index) {
    index = new Map(layout.positions.map((position) => [keyOf(position), position]))
    indexes.set(layout, index)
  }
  return index
}

/** The layout's position of that name, or undefined where it has none (a round it does not reach). */
export function layoutPosition(layout: FrameLayout, position: GridPosition): LayoutPosition | undefined {
  return indexOf(layout).get(keyOf(position))
}

/** The position whose bead covers a point, or undefined on a Seam, the centre or Off-shape. */
export function layoutPositionAt(layout: FrameLayout, x: number, y: number): GridPosition | undefined {
  const depth = layout.beadDepth / 2
  for (const position of layout.positions) {
    const dx = x - position.x
    const dy = y - position.y
    const across = dx * Math.cos(position.angle) + dy * Math.sin(position.angle)
    const out = -dx * Math.sin(position.angle) + dy * Math.cos(position.angle)
    if (Math.abs(across) <= 0.5 && Math.abs(out) <= depth) return { row: position.row, column: position.column }
  }
  return undefined
}

const neighbors = new WeakMap<FrameLayout, Map<string, GridPosition[]>>()

/** The positions whose beads touch this one's, on its panel or across a Seam: where a Fill spreads. */
export function layoutNeighbors(layout: FrameLayout, position: GridPosition): GridPosition[] {
  let lists = neighbors.get(layout)
  if (!lists) {
    lists = new Map()
    // Buckets a touching distance wide, so each bead is measured only against those near it.
    const buckets = new Map<string, LayoutPosition[]>()
    const bucketOf = (x: number, y: number) => `${Math.floor(x / TOUCHING)}:${Math.floor(y / TOUCHING)}`
    for (const each of layout.positions) {
      const key = bucketOf(each.x, each.y)
      buckets.set(key, [...(buckets.get(key) ?? []), each])
    }
    for (const each of layout.positions) {
      const bucketX = Math.floor(each.x / TOUCHING)
      const bucketY = Math.floor(each.y / TOUCHING)
      const near: GridPosition[] = []
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          for (const other of buckets.get(`${bucketX + dx}:${bucketY + dy}`) ?? []) {
            if (other !== each && Math.hypot(other.x - each.x, other.y - each.y) <= TOUCHING) near.push({ row: other.row, column: other.column })
          }
        }
      }
      lists.set(keyOf(each), near)
    }
    neighbors.set(layout, lists)
  }
  return lists.get(keyOf(position)) ?? []
}
