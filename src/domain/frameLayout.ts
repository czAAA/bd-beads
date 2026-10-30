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

/** A panel of a layout: the part it belongs to and that part's place in the making order (0 first). A part is beaded on
 * its own, all its panels at once (a round goes round every side), before the joins put the parts together. */
interface LayoutPanel {
  part: number
  order: number
  /** A Fringe earring's strand (ticket 0597): strung top to bottom in one pass, not in rows. */
  strand?: true
}

/** A join between parts, in making order: a zip of two parts' edges, a hinge laced between them, or the join that
 * closes the piece, made last. A zip of one part closes it on itself or into the strip it belongs to. */
export interface LayoutJoin {
  step: 'zip' | 'hinge' | 'close'
  parts: readonly number[]
}

/** A layout's own symmetry (ticket 0706), what Mirror finds a Custom frame's counterparts by: how many turns about its
 * centre map it onto itself (a round shape's side count; one for a Kite or Fringe earring, which only reflect), and its
 * first mirror line through the centre (a Seam's or the spine's) in radians clockwise from straight up on screen. */
export interface LayoutSymmetry {
  fold: number
  line: number
}

/** The angle of a ray from the origin to a point, clockwise from straight up on screen (y down). */
function angleTo({ x, y }: LayoutPoint): number {
  return Math.atan2(x, -y)
}

/** What a Frame shape's panel builder makes of its settings. */
export interface FrameLayout {
  positions: readonly LayoutPosition[]
  panels: readonly LayoutPanel[]
  /** The joins that put its parts together once they are beaded, in making order; none for a shape of one part. */
  joins: readonly LayoutJoin[]
  /** The bounding rectangle, in bead widths: the Frame's footprint is the rows and columns that cover it. */
  width: number
  height: number
  /** The middle of the shape: where a Triangle's Seams meet, a Star's arms, a Kaleidocycle's hole. */
  centre: LayoutPoint
  /** The Seams between panels and parts, each a line, as far as the bounding rectangle. */
  seams: readonly (readonly [LayoutPoint, LayoutPoint])[]
  /** Its symmetry about its centre (ticket 0706); none for a layout with no mirror line, a turned grid's. */
  symmetry?: LayoutSymmetry
  /** How far a bead of it reaches out across its panel, in bead widths: a round shape's Bead's depth (ticket 0723). */
  beadDepth: number
  /** Beads that touch though the chart draws them apart, as pairs of indexes into `positions`: a peyote bead and those
   * of the round before that it sits between, which a steep Seam lifts off a corner pair (ticket 0723). */
  links?: readonly (readonly [number, number])[]
}

/** Beads whose outlines lie this close touch, in bead widths (ticket 0723): side by side, end to end, a corner pair at
 * its corner, or a Fringe earring's strand a quarter bead under the top. A packed round shape's column lies over half a
 * bead off the next but for the beads that touch, so those are not reached by distance alone. */
const TOUCHING = 0.3

const layouts = new Map<string, FrameLayout>()

/** A layout built once per kind and size. */
function remembered(key: string, build: () => FrameLayout): FrameLayout {
  const known = layouts.get(key)
  if (known) return known
  const layout = build()
  layouts.set(key, layout)
  return layout
}

/** One part worked in Rounds from its own centre, at 0, 0: its positions (columns counted within the part, panels
 * within it) and the corners of its outline. */
interface RoundsPart {
  positions: LayoutPosition[]
  corners: LayoutPoint[]
  beadDepth: number
  links: [number, number][]
}

/** Geometric peyote in Rounds from the centre (research: custom-frame-beading-order.md) on a polygon of equal sides,
 * its corners at these angles, charted as a bead artist charts it (ticket 0723): a panel a side, round n with n beads a
 * side, each bead a width along it and `depth` out, stacked end to end in columns from the Seam at their end. */
function roundsPart(angles: readonly number[], rounds: number, depth: number): RoundsPart {
  const sides = angles.length
  const cot = (angle: number) => 1 / Math.tan(angle / 2)
  // How far a Seam from the centre to a corner of this angle runs out from a side for each width along it.
  const slope = (angle: number) => Math.tan(angle / 2)
  // Each side turns from the one before by the corner between them; side i runs from the corner it shares with side
  // i - 1 (along +) to the one it shares with side i + 1 (along -).
  const sideAngles = [0]
  for (let side = 1; side < sides; side += 1) sideAngles.push(sideAngles[side - 1]! + Math.PI - angles[side - 1]!)
  const frame = (side: number) => {
    const angle = sideAngles[side]!
    return { angle, along: { x: Math.cos(angle), y: Math.sin(angle) }, normal: { x: -Math.sin(angle), y: Math.cos(angle) } }
  }
  const positions: LayoutPosition[] = []
  const links: [number, number][] = []
  // Where each bead is in `positions`, by round, side and column: a bead sits between the two of the round before.
  const indexOf = new Map<string, number>()
  let outline = 0
  for (let round = 0; round < rounds; round += 1) {
    for (let side = 0; side < sides; side += 1) {
      const { angle, along, normal } = frame(side)
      const [ahead, behind] = [slope(angles[(side + sides - 1) % sides]!), slope(angles[side]!)]
      // The middle column stands where its first bead touches both Seams: off the side's middle on a rhombus.
      const middle = (behind - ahead) / (2 * (ahead + behind))
      for (let place = 0; place <= round; place += 1) {
        // Placed from the side's end that meets the panel before towards the next, so a round runs on round the shape.
        const column = round - 2 * place
        const offset = middle + column
        const first = depth / 2 + (column < 0 ? (0.5 - offset) * behind : (0.5 + offset) * ahead)
        const out = first + ((round - Math.abs(column)) / 2) * depth
        outline = Math.max(outline, out + depth / 2)
        for (const before of [column - 1, column + 1]) {
          const under = indexOf.get(`${round - 1}:${side}:${before}`)
          if (under !== undefined) links.push([under, positions.length])
        }
        indexOf.set(`${round}:${side}:${column}`, positions.length)
        positions.push({ row: round, column: side * (round + 1) + place, panel: side, angle, x: normal.x * out + along.x * offset, y: normal.y * out + along.y * offset })
      }
    }
  }
  // The outline's sides touch the outermost beads, its corners where the Seams reach them.
  const corners = angles.map((angle, side) => {
    const { along, normal } = frame(side)
    return { x: normal.x * outline - along.x * outline * cot(angle), y: normal.y * outline - along.y * outline * cot(angle) }
  })
  return { positions, corners, beadDepth: depth, links }
}

/** A part turned so that one of its corners points back to a point, the part lying out from it at an angle: its centre
 * that far from the point, or as far as the corner reaches, so the corner lands on it. */
function placedPart(part: RoundsPart, corner: number, at: LayoutPoint, outwards: number, distance?: number): RoundsPart {
  const reach = part.corners[corner]!
  const turn = outwards + Math.PI - Math.atan2(reach.y, reach.x)
  const away = distance ?? Math.hypot(reach.x, reach.y)
  const centre = { x: at.x + away * Math.cos(outwards), y: at.y + away * Math.sin(outwards) }
  const moved = ({ x, y }: LayoutPoint) => ({ x: centre.x + x * Math.cos(turn) - y * Math.sin(turn), y: centre.y + x * Math.sin(turn) + y * Math.cos(turn) })
  return {
    positions: part.positions.map((position) => ({ ...position, ...moved(position), angle: position.angle + turn })),
    corners: part.corners.map(moved),
    beadDepth: part.beadDepth,
    links: part.links,
  }
}

/** A part's Seams: from its centre to each corner. */
function partSeams(part: RoundsPart, centre: LayoutPoint): [LayoutPoint, LayoutPoint][] {
  return part.corners.map((corner) => [centre, corner])
}

/** Parts put together: their positions named on, part after part (column = the part's place × its round's beads + the
 * bead's column in the part), so a bead keeps its name when the Part size changes. */
function joinedParts(parts: readonly RoundsPart[]): { positions: LayoutPosition[]; panels: LayoutPanel[]; links: [number, number][] } {
  const positions: LayoutPosition[] = []
  const panels: LayoutPanel[] = []
  const links: [number, number][] = []
  parts.forEach((part, index) => {
    const sides = part.corners.length
    const firstPanel = panels.length
    links.push(...part.links.map(([a, b]): [number, number] => [positions.length + a, positions.length + b]))
    for (let side = 0; side < sides; side += 1) panels.push({ part: index, order: index })
    for (const position of part.positions) {
      positions.push({ ...position, column: index * sides * (position.row + 1) + position.column, panel: firstPanel + position.panel })
    }
  })
  return { positions, panels, links }
}

/** A layout worked out round 0, 0, moved so its beads sit in the middle of a box hugging them: half a bead's diagonal
 * round their centres, not the empty points of the shape's corners. Its Seams stop at the box. */
function boxed(
  raw: Pick<FrameLayout, 'positions' | 'panels' | 'seams' | 'beadDepth' | 'links' | 'symmetry'> & { joins?: readonly LayoutJoin[] },
  middle: LayoutPoint = { x: 0, y: 0 },
): FrameLayout {
  const pad = Math.hypot(0.5, raw.beadDepth / 2)
  const left = Math.min(...raw.positions.map(({ x }) => x)) - pad
  const top = Math.min(...raw.positions.map(({ y }) => y)) - pad
  const width = Math.max(...raw.positions.map(({ x }) => x)) + pad - left
  const height = Math.max(...raw.positions.map(({ y }) => y)) + pad - top
  const shift = ({ x, y }: LayoutPoint) => ({ x: x - left, y: y - top })
  // A Seam runs from its first point, inside the box, towards its second, as far as the box.
  const clipped = (from: LayoutPoint, to: LayoutPoint): LayoutPoint => {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const reach = Math.min(1, dx > 0 ? (width - from.x) / dx : dx < 0 ? -from.x / dx : Infinity, dy > 0 ? (height - from.y) / dy : dy < 0 ? -from.y / dy : Infinity)
    return { x: from.x + dx * reach, y: from.y + dy * reach }
  }
  return {
    positions: raw.positions.map((position) => ({ ...position, ...shift(position) })),
    panels: raw.panels,
    joins: raw.joins ?? [],
    width,
    height,
    centre: shift(middle),
    seams: raw.seams.map(([from, to]) => [shift(from), clipped(shift(from), shift(to))] as const),
    beadDepth: raw.beadDepth,
    ...(raw.links ? { links: raw.links } : {}),
    ...(raw.symmetry ? { symmetry: raw.symmetry } : {}),
  }
}

/** A Triangle (3 corners) or Warped Square (4) in Rounds from the centre: one part, a panel a side, round n with
 * k × n beads, a Seam from the centre to each corner, its beads packed by the Bead's `depth` (ticket 0723). */
export function roundsLayout(corners: number, rounds: number, depth: number): FrameLayout {
  return remembered(`rounds:${corners}:${rounds}:${depth}`, () => {
    const part = roundsPart(Array.from({ length: corners }, () => Math.PI - (2 * Math.PI) / corners), rounds, depth)
    // A Seam to a corner is a mirror line of a regular polygon.
    const symmetry = { fold: corners, line: angleTo(part.corners[0]!) }
    return boxed({ ...joinedParts([part]), seams: partSeams(part, { x: 0, y: 0 }), beadDepth: part.beadDepth, symmetry })
  })
}

/** A Star's five arms meet at its centre with this angle each. */
const STAR_ARM = (2 * Math.PI) / 5

/** A bead's outline: one width across its panel and `depth` out from the centre, turned to its panel. */
function outlineOf({ x, y, angle }: LayoutPosition, depth: number): LayoutPoint[] {
  const along = { x: Math.cos(angle) / 2, y: Math.sin(angle) / 2 }
  const out = { x: (-Math.sin(angle) * depth) / 2, y: (Math.cos(angle) * depth) / 2 }
  return [1, -1].flatMap((a) => [1, -1].map((o) => ({ x: x + a * along.x + o * out.x, y: y + a * along.y + o * out.y })))
}

/** How far from a point beads reach in a direction (a unit vector): the farthest corner of their outlines, of those
 * within a bead of the line from the point, or of all when `near` is not asked. */
function reachFrom(points: readonly LayoutPoint[], from: LayoutPoint, direction: LayoutPoint, near?: true): number {
  let farthest = 0
  for (const { x, y } of points) {
    const [dx, dy] = [x - from.x, y - from.y]
    if (!near || Math.abs(dx * direction.y - dy * direction.x) <= 1) farthest = Math.max(farthest, dx * direction.x + dy * direction.y)
  }
  return farthest
}

/** A Star (research: the MiniStar): five Warped Squares, each beaded on its own in Part size rounds, then zipped
 * together one pair at a time, the last to the first closed last. Drawn flat, each square's packed beads (ticket 0723)
 * make a rhombus with 72° tips at the centre and out, each arm as near the centre as its fifth of the Star lets it. */
export function starLayout(partSize: number, depth: number): FrameLayout {
  return remembered(`star:${partSize}:${depth}`, () => {
    // Packed, a square's beads reach farther along a Seam the wider its panels' corner: they make a 72° tip where the
    // panels meet at 108°.
    const square = roundsPart([Math.PI - STAR_ARM, STAR_ARM, Math.PI - STAR_ARM, STAR_ARM], partSize, depth)
    const centre = { x: 0, y: 0 }
    // The arm's axis, out from the Star's centre through its own, and across it.
    const tip = square.corners[0]!
    const axis = { x: -tip.x / Math.hypot(tip.x, tip.y), y: -tip.y / Math.hypot(tip.x, tip.y) }
    const points = square.positions.flatMap((position) => outlineOf(position, depth))
    const distance = Math.max(...points.map(({ x, y }) => Math.abs(x * axis.y - y * axis.x) / Math.tan(STAR_ARM / 2) - (x * axis.x + y * axis.y)))
    // The first arm points up, the rest round clockwise.
    const outwards = (arm: number) => -Math.PI / 2 + arm * STAR_ARM
    const arms = Array.from({ length: 5 }, (_unused, arm) => placedPart(square, 0, centre, outwards(arm), distance))
    const outlines = arms.map((arm) => arm.positions.flatMap((position) => outlineOf(position, depth)))
    const ray = (from: LayoutPoint, angle: number, points: readonly LayoutPoint[], near?: true): [LayoutPoint, LayoutPoint] => {
      const direction = { x: Math.cos(angle), y: Math.sin(angle) }
      const length = reachFrom(points, from, direction, near)
      return [from, { x: from.x + direction.x * length, y: from.y + direction.y * length }]
    }
    const seams = arms.flatMap((arm, index) => {
      const middle = { x: centre.x + distance * Math.cos(outwards(index)), y: centre.y + distance * Math.sin(outwards(index)) }
      return [
        ...arm.corners.map((corner) => ray(middle, Math.atan2(corner.y - middle.y, corner.x - middle.x), outlines[index]!)),
        // The edge it shares with the next arm, from the centre as far as their beads.
        ray(centre, outwards(index) + STAR_ARM / 2, [...outlines[index]!, ...outlines[(index + 1) % 5]!], true),
      ]
    })
    const joins: LayoutJoin[] = [
      ...[0, 1, 2, 3].map((arm): LayoutJoin => ({ step: 'zip', parts: [arm, arm + 1] })),
      { step: 'close', parts: [4, 0] },
    ]
    // The Seam between two arms is a mirror line of the Star, through the arm across from it.
    const symmetry = { fold: arms.length, line: STAR_ARM / 2 }
    return boxed({ ...joinedParts(arms), joins, seams, beadDepth: square.beadDepth, symmetry }, centre)
  })
}

/** The centre of a placed part: the middle of its corners (a rhombus's and a triangle's centres are their corners'). */
function middleOf(part: RoundsPart): LayoutPoint {
  return { x: part.corners.reduce((sum, { x }) => sum + x, 0) / part.corners.length, y: part.corners.reduce((sum, { y }) => sum + y, 0) / part.corners.length }
}

/** How far a Kaleidocycle's triangles stand from the middle, in bead widths: the hole, and the gap between triangles. */
const KALEIDOCYCLE_HOLE = 1

/** A Kaleidocycle (research: the CGB Kali Primer) drawn as its finished face: six peyote Triangles of Part size beads a
 * side round a hole, each beaded on its own, then (inferred: the face shows one triangle of each tetrahedron) each zipped
 * into its strip and tetrahedron, mirror tetrahedra hinged in pairs, and the pairs joined into the ring. */
export function kaleidocycleLayout(partSize: number, depth: number): FrameLayout {
  return remembered(`kaleidocycle:${partSize}:${depth}`, () => {
    const triangle = roundsPart([Math.PI / 3, Math.PI / 3, Math.PI / 3], partSize, depth)
    const centre = { x: 0, y: 0 }
    const outwards = (part: number) => -Math.PI / 2 + (part * Math.PI) / 3
    const apex = (part: number) => ({ x: KALEIDOCYCLE_HOLE * Math.cos(outwards(part)), y: KALEIDOCYCLE_HOLE * Math.sin(outwards(part)) })
    const parts = Array.from({ length: 6 }, (_unused, part) => placedPart(triangle, 0, apex(part), outwards(part)))
    const side = Math.hypot(triangle.corners[0]!.x - triangle.corners[1]!.x, triangle.corners[0]!.y - triangle.corners[1]!.y)
    const gaps = parts.map((_part, part): [LayoutPoint, LayoutPoint] => {
      // Down the middle of the gap to the next triangle, from the hole out as far as the triangles' sides.
      const from = { x: (apex(part).x + apex((part + 1) % 6).x) / 2, y: (apex(part).y + apex((part + 1) % 6).y) / 2 }
      const towards = outwards(part) + Math.PI / 6
      return [from, { x: from.x + side * Math.cos(towards), y: from.y + side * Math.sin(towards) }]
    })
    const joins: LayoutJoin[] = [
      ...parts.map((_part, part): LayoutJoin => ({ step: 'zip', parts: [part] })),
      ...[0, 2, 4].map((part): LayoutJoin => ({ step: 'hinge', parts: [part, part + 1] })),
      { step: 'close', parts: [1, 2] },
      { step: 'close', parts: [3, 4] },
      { step: 'close', parts: [5, 0] },
    ]
    // The gap between two triangles is a mirror line of the ring, through the gap across from it.
    const symmetry = { fold: parts.length, line: Math.PI / 6 }
    return boxed({ ...joinedParts(parts), joins, seams: [...parts.flatMap((part) => partSeams(part, middleOf(part))), ...gaps], beadDepth: triangle.beadDepth, symmetry }, centre)
  })
}

/** A Kite row's single beads a wing, besides its half of the centre pair (inferred; the reference gives no counts): two
 * rows of the pair alone, a bead more a row to the widest row a fifth down, a bead fewer every fourth row to the tail.
 * @internal Tests check the Kite's wing counts row by row. */
export function kiteWingBeads(row: number, rows: number): number {
  // Growing a bead a row for a fifth of the rows and shrinking one every fourth row for the rest ends on the pair.
  const widest = Math.max(1, Math.floor((rows + KITE_SHRINK_EVERY - 1) / (KITE_SHRINK_EVERY + 1)))
  if (row <= widest) return Math.max(0, row - 1)
  return Math.max(0, widest - 1 - Math.floor((row - widest) / KITE_SHRINK_EVERY))
}

/** How many rows below its widest a Kite's wings take to lose a bead each. */
const KITE_SHRINK_EVERY = 4

/** A Kite (the maintainer's reference): two peyote wings at 90 degrees meeting at a herringbone spine, worked in Rows
 * from its point, each row a chevron of peyote out from a two-bead pair at the centre. A bead is named by its row and its
 * place out from the spine, the left wing's even and the right's odd, so it keeps its name when Rows change. */
export function kiteLayout(rows: number): FrameLayout {
  return remembered(`kite:${rows}`, () => {
    const wings = [
      { angle: (3 * Math.PI) / 4, side: 0 },
      { angle: Math.PI / 4, side: 1 },
    ] as const
    const positions: LayoutPosition[] = []
    for (let row = 0; row < rows; row += 1) {
      // The chevron's point on the spine moves one row's depth down it.
      const point = { x: 0, y: (row + 1) * Math.SQRT2 }
      for (const { angle, side } of wings) {
        for (let place = 0; place <= kiteWingBeads(row, rows); place += 1) {
          const out = 1 + 2 * place
          positions.push({ row, column: 2 * place + side, panel: side, angle, x: point.x + out * Math.cos(angle), y: point.y + out * Math.sin(angle) })
        }
      }
    }
    // The spine runs from the first row's point down past the last row's pair.
    const spine: [LayoutPoint, LayoutPoint] = [{ x: 0, y: Math.SQRT2 }, { x: 0, y: (rows + 1) * Math.SQRT2 }]
    return boxed({ positions, panels: wings.map(() => ({ part: 0, order: 0 })), seams: [spine], beadDepth: 1, symmetry: MIRRORED_ACROSS }, { x: 0, y: ((rows + 2) * Math.SQRT2) / 2 })
  })
}

/** The symmetry of a shape that only reflects across its upright middle (ticket 0706): a Kite about its spine, a Fringe
 * earring about the middle of its top. */
const MIRRORED_ACROSS: LayoutSymmetry = { fold: 1, line: 0 }

/** A Fringe earring's settings (ticket 0597): its brick-stitch top's base row and rows, and its strands' style and
 * length. */
export interface FringeSettings {
  topWidth: number
  topRows: number
  fringeStyle: 'straight' | 'v'
  fringeLength: number
}

/** A strand's beads are named from this row down, and by their strand as the column, so neither the top's rows nor a
 * strand's beads are renamed when Top rows or Fringe length change. */
const STRAND_ROW = 1000

/** How far below the base row the strands hang, past touching, so the Seam between them shows. */
const FRINGE_GAP = 0.25

/** How long a strand is (StarterGallery card): the Fringe length straight; in a V the middle one or pair the Fringe
 * length, two beads shorter a strand out from the middle, and never less than one bead. */
function strandLength({ topWidth, fringeStyle, fringeLength }: FringeSettings, strand: number): number {
  if (fringeStyle === 'straight') return fringeLength
  return Math.max(1, fringeLength - 2 * Math.floor(Math.abs(strand - (topWidth - 1) / 2)))
}

/** A Fringe earring (ticket 0597): a brick-stitch triangle worked from its base row of Top width beads upwards, each
 * row one bead shorter and half a bead in, and a strand hanging under each bead of the base row, a Seam between the top
 * and the strands. Every bead lies upright, as brick stitch and a strung strand hold it. */
export function fringeLayout(settings: FringeSettings): FrameLayout {
  const { topWidth, topRows, fringeStyle, fringeLength } = settings
  return remembered(`fringe:${topWidth}:${topRows}:${fringeStyle}:${fringeLength}`, () => {
    const positions: LayoutPosition[] = []
    for (let row = 0; row < Math.min(topRows, topWidth - 1); row += 1) {
      for (let column = 0; column < topWidth - row; column += 1) positions.push({ row, column, panel: 0, angle: 0, x: row / 2 + column, y: -row })
    }
    for (let strand = 0; strand < topWidth; strand += 1) {
      for (let bead = 0; bead < strandLength(settings, strand); bead += 1) {
        positions.push({ row: STRAND_ROW + bead, column: strand, panel: strand + 1, angle: 0, x: strand, y: 1 + FRINGE_GAP + bead })
      }
    }
    const panels: LayoutPanel[] = [{ part: 0, order: 0 }, ...Array.from({ length: topWidth }, (_unused, strand) => ({ part: strand + 1, order: strand + 1, strand: true as const }))]
    const seam: [LayoutPoint, LayoutPoint] = [{ x: -0.5, y: (1 + FRINGE_GAP) / 2 }, { x: topWidth - 0.5, y: (1 + FRINGE_GAP) / 2 }]
    return boxed({ positions, panels, seams: [seam], beadDepth: 1, symmetry: MIRRORED_ACROSS }, { x: (topWidth - 1) / 2, y: 0 })
  })
}

const turnedLayouts = new WeakMap<FrameLayout, FrameLayout[]>()

/** A layout turned a quarter clockwise on screen `turns` times (Rotate Frame, ticket 0594): every bead keeps its name and
 * panel and turns with its panel, and the bounding rectangle's sides swap at each turn. */
export function turnedLayout(layout: FrameLayout, turns: number): FrameLayout {
  const quarter = ((turns % 4) + 4) % 4
  if (quarter === 0) return layout
  const known = turnedLayouts.get(layout) ?? []
  if (known[quarter]) return known[quarter]!
  const once = (from: FrameLayout): FrameLayout => {
    // A quarter turn clockwise with y down: right becomes down, and what was at the bottom comes to the left.
    const turn = ({ x, y }: LayoutPoint): LayoutPoint => ({ x: from.height - y, y: x })
    return {
      ...from,
      positions: from.positions.map((position) => ({ ...position, ...turn(position), angle: position.angle + Math.PI / 2 })),
      width: from.height,
      height: from.width,
      centre: turn(from.centre),
      seams: from.seams.map(([start, end]) => [turn(start), turn(end)] as const),
      ...(from.symmetry ? { symmetry: { ...from.symmetry, line: from.symmetry.line + Math.PI / 2 } } : {}),
    }
  }
  let turned = layout
  for (let step = 0; step < quarter; step += 1) turned = once(turned)
  known[quarter] = turned
  turnedLayouts.set(layout, known)
  return turned
}

const indexes = new WeakMap<FrameLayout, Map<string, LayoutPosition>>()

/** A position's key in a layout's index, and in what is keyed by layout position (Row order, a Paste's landings). */
export const keyOf = ({ row, column }: GridPosition): string => `${row}:${column}`

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

/** The bead a point of a layout is on, as a press finds it (its outline holds the point, so a packed bead between two
 * Seams can be aimed at, ticket 0723), else the one a bead put there lands on (`landingAt`); none on a Seam or Off-shape. */
export function beadUnder(layout: FrameLayout, x: number, y: number): LayoutPosition | undefined {
  const pressed = layoutPositionAt(layout, x, y)
  return (pressed && layoutPosition(layout, pressed)) ?? landingAt(layout, x, y)
}

/** How far a point may lie from the nearest bead's centre and still be on the shape, in bead widths: the gaps peyote
 * leaves open, along a round shape's Seams (ticket 0723) or between a Kite's beads, lie a bead from a neighbour. */
const ON_SHAPE = 1.05

/** How near a Seam a bead's centre may not lie, in bead widths: its bead would cross it. */
const SEAM_CLEARANCE = 0.45

/** The distance from a point to a Seam's line. */
function seamDistance({ x, y }: LayoutPoint, [from, to]: readonly [LayoutPoint, LayoutPoint]): number {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const along = Math.max(0, Math.min(1, ((x - from.x) * dx + (y - from.y) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(x - from.x - along * dx, y - from.y - along * dy)
}

/** The position a bead put down at a point lands on (Paste and Rotate on a Custom frame, ticket 0594): the nearest one,
 * whose panel is the one under it; none on a Seam, or Off-shape where no bead is near. */
export function landingAt(layout: FrameLayout, x: number, y: number): LayoutPosition | undefined {
  const point = { x, y }
  if (layout.seams.some((seam) => seamDistance(point, seam) < SEAM_CLEARANCE)) return undefined
  let nearest: LayoutPosition | undefined
  let distance = Infinity
  for (const position of layout.positions) {
    const to = Math.hypot(position.x - x, position.y - y)
    if (to < distance) {
      nearest = position
      distance = to
    }
  }
  return distance <= ON_SHAPE ? nearest : undefined
}

const neighbors = new WeakMap<FrameLayout, Map<string, GridPosition[]>>()

/** Whether two beads of a layout touch: their outlines, one width across and the bead depth out, each turned to its
 * panel, lie no more than the touching distance apart along every axis of either. */
function touching(a: LayoutPosition, b: LayoutPosition, depth: number): boolean {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return [a.angle, b.angle].every((angle) =>
    [angle, angle + Math.PI / 2].every((axis) => {
      const [x, y] = [Math.cos(axis), Math.sin(axis)]
      // Each outline's half reach along the axis, from its own half width and half depth turned to it.
      const reach = (bead: LayoutPosition) => (Math.abs(Math.cos(bead.angle) * x + Math.sin(bead.angle) * y) + depth * Math.abs(-Math.sin(bead.angle) * x + Math.cos(bead.angle) * y)) / 2
      return Math.abs(dx * x + dy * y) <= reach(a) + reach(b) + TOUCHING
    }),
  )
}

/** The positions whose beads touch this one's, on its panel or across a Seam: where a Fill spreads. */
export function layoutNeighbors(layout: FrameLayout, position: GridPosition): GridPosition[] {
  let lists = neighbors.get(layout)
  if (!lists) {
    lists = new Map()
    // Buckets wider than two touching beads' centres may lie apart, so each bead is measured only against those near it.
    const size = 1.5 * (1 + layout.beadDepth) + TOUCHING
    const buckets = new Map<string, LayoutPosition[]>()
    const bucketOf = (x: number, y: number) => `${Math.floor(x / size)}:${Math.floor(y / size)}`
    for (const each of layout.positions) {
      const key = bucketOf(each.x, each.y)
      buckets.set(key, [...(buckets.get(key) ?? []), each])
    }
    for (const each of layout.positions) {
      const bucketX = Math.floor(each.x / size)
      const bucketY = Math.floor(each.y / size)
      const near: GridPosition[] = []
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          for (const other of buckets.get(`${bucketX + dx}:${bucketY + dy}`) ?? []) {
            if (other !== each && touching(each, other, layout.beadDepth)) near.push({ row: other.row, column: other.column })
          }
        }
      }
      lists.set(keyOf(each), near)
    }
    for (const pair of layout.links ?? []) {
      const [a, b] = pair.map((index) => layout.positions[index]!)
      for (const [from, to] of [[a!, b!], [b!, a!]]) {
        const near = lists.get(keyOf(from!))!
        if (!near.some(({ row, column }) => row === to!.row && column === to!.column)) near.push({ row: to!.row, column: to!.column })
      }
    }
    neighbors.set(layout, lists)
  }
  return lists.get(keyOf(position)) ?? []
}
