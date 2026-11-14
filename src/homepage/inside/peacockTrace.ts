import { PEACOCK_CUFF, PEACOCK_RING, type PeacockDrawing, type PeacockPart } from './peacock'

// How the ghost draws the peacock feather (Homepage card, ticket 0831): the ring's eye by hand, color by color, and the
// cuff's eye traced over the reference picture, a ring's outer edge painted and its inside filled. Worked out from the
// drawing itself, so what is drawn is the drawing, bead for bead.

/** A bead of a drawing: its line from the top, and how far along the piece. */
export type TraceBead = readonly [line: number, along: number]

/** The eye's parts from the outside in. */
const EYE_PARTS: readonly PeacockPart[] = ['G', 'D', 'T', 'B', 'N']

/** The six beads round a bead as peyote lays them: two on its line, two on each line beside it (odd lines lie half a
 * bead on).
 * @internal Its test fills by them, as the editor's Fill does. */
export function beadsRound([line, along]: TraceBead): TraceBead[] {
  const beside = line % 2 ? [along, along + 1] : [along - 1, along]
  return [[line, along - 1], [line, along + 1], ...beside.flatMap((each): TraceBead[] => [[line - 1, each], [line + 1, each]])]
}

const keyOf = ([line, along]: TraceBead) => `${line},${along}`

/** Strokes through `beads`, each of neighbouring beads, as a hand draws them: on to a next bead while there is one, to
 * the one with the fewest ways on first, so no bead is left behind alone; then a new stroke from the nearest left.
 * @internal Its test draws a small shape through it. */
export function strokesThrough(beads: readonly TraceBead[]): TraceBead[][] {
  const left = new Map(beads.map((bead) => [keyOf(bead), bead]))
  const waysOn = (bead: TraceBead) => beadsRound(bead).filter((next) => left.has(keyOf(next)))
  const strokes: TraceBead[][] = []
  let at: TraceBead | undefined = beads[0]
  let stroke: TraceBead[] = []
  while (at) {
    left.delete(keyOf(at))
    stroke.push(at)
    const here: TraceBead = at
    const next = waysOn(here).sort((a, b) => waysOn(a).length - waysOn(b).length)[0]
    if (next) {
      at = next
      continue
    }
    strokes.push(stroke)
    stroke = []
    at = [...left.values()].sort((a, b) => Math.hypot(a[0] - here[0], a[1] - here[1]) - Math.hypot(b[0] - here[0], b[1] - here[1]))[0]
  }
  return strokes
}

/** The beads of a drawing that `own` holds, as a lookup. */
function beadsWhere(drawing: PeacockDrawing, own: (part: PeacockPart) => boolean): Map<string, TraceBead> {
  const found = new Map<string, TraceBead>()
  drawing.rows.forEach((row, line) => [...row].forEach((part, along) => own(part as PeacockPart) && found.set(keyOf([line, along]), [line, along])))
  return found
}

/** The groups of `beads` that touch, each a Fill's reach. */
function reaches(beads: Map<string, TraceBead>): TraceBead[][] {
  const left = new Map(beads)
  const groups: TraceBead[][] = []
  for (const [key, first] of beads) {
    if (!left.delete(key)) continue
    const group = [first]
    for (let at = 0; at < group.length; at++) {
      for (const next of beadsRound(group[at]!)) if (left.delete(keyOf(next))) group.push(next)
    }
    groups.push(group)
  }
  return groups
}

/** The bead of `group` in the strip nearest the group's middle there: where a Fill is pressed (none when it lies outside the strip). */
function fillPress(group: readonly TraceBead[], inStrip: (bead: TraceBead) => boolean): TraceBead[] {
  const own = group.filter(inStrip)
  const middle = [0, 1].map((axis) => own.reduce((sum, bead) => sum + bead[axis]!, 0) / own.length)
  return [...own].sort((a, b) => Math.hypot(a[0] - middle[0]!, a[1] - middle[1]!) - Math.hypot(b[0] - middle[0]!, b[1] - middle[1]!)).slice(0, 1)
}

/** One color of a trace: what is painted in it, stroke by stroke, then where Fill is pressed in it. */
export interface TraceStep {
  part: PeacockPart
  strokes: TraceBead[][]
  fills: TraceBead[]
}

/** The fewest beads inside an edge worth a Fill: fewer are painted with the edge. */
const WORTH_A_FILL = 3

/** How the eye in `strip` of a drawing is traced (the Mirror's Repeat lays it in the other strips): from the outside in,
 * each ring's outer edge painted and its inside filled, so the next ring is drawn over it; then the ground filled where
 * it is left open (a bead or two shut in between two eyes, or at the piece's end, is painted); then the barbs over the ground. */
export function eyeTrace(drawing: PeacockDrawing, strip: number): TraceStep[] {
  const inStrip = ([, along]: TraceBead) => Math.floor(along / drawing.period) === strip
  const steps: TraceStep[] = EYE_PARTS.map((part, depth) => {
    const within = beadsWhere(drawing, (each) => EYE_PARTS.indexOf(each) >= depth)
    const inside = new Map([...within].filter(([, bead]) => beadsRound(bead).every((next) => within.has(keyOf(next)))))
    const groups = reaches(inside).filter((group) => group.length >= WORTH_A_FILL)
    const filled = new Set(groups.flat().map(keyOf))
    const painted = [...within.values()].filter((bead) => inStrip(bead) && !filled.has(keyOf(bead)))
    return { part, strokes: strokesThrough(painted), fills: groups.flatMap((group) => fillPress(group, inStrip)) }
  })
  const ground = reaches(beadsWhere(drawing, (part) => part === '.' || part === 'g'))
  const open = ground.filter((group) => group.length >= WORTH_A_FILL)
  const small = ground.filter((group) => group.length < WORTH_A_FILL).flat()
  const shut = [...new Map(small.map(([line, along]): TraceBead => [line, (along % drawing.period) + strip * drawing.period]).map((bead) => [keyOf(bead), bead])).values()]
  steps.push({ part: '.', strokes: strokesThrough(shut), fills: open.flatMap((group) => fillPress(group, inStrip)) })
  const barbs = [...beadsWhere(drawing, (part) => part === 'g').values()].filter(inStrip)
  if (barbs.length > 0) steps.push({ part: 'g', strokes: strokesThrough(barbs), fills: [] })
  return steps
}

/** The start of a trace's first color, `beads` beads of its strokes: what the ghost draws by hand before the rest of
 * the piece appears at once (ticket 0949). */
export function traceStart({ part, strokes }: TraceStep, beads: number): TraceStep {
  let left = beads
  const kept = strokes.flatMap((stroke) => {
    const start = stroke.slice(0, left)
    left -= start.length
    return start.length > 0 ? [start] : []
  })
  return { part, strokes: kept, fills: [] }
}

/** The whole of a drawing color by color, each color's beads as strokes: what appears at once after the ghost traced
 * the start of it (ticket 0949). */
export function wholeDrawing(drawing: PeacockDrawing): TraceStep[] {
  const parts = [...new Set(drawing.rows.join(''))] as PeacockPart[]
  return parts.map((part) => ({ part, strokes: strokesThrough([...beadsWhere(drawing, (each) => each === part).values()]), fills: [] }))
}

/** The ring's eye drawn by hand in `strip`: each color's own beads, from the green ring in to the pupil. */
export function eyeByHand(strip: number): TraceStep[] {
  const beads = (part: PeacockPart) => [...beadsWhere(PEACOCK_RING, (each) => each === part).values()].filter(([, along]) => Math.floor(along / PEACOCK_RING.period) === strip)
  return EYE_PARTS.map((part) => ({ part, strokes: strokesThrough(beads(part)), fills: [] }))
}

/** Where Fill is pressed for the ring's ground once the first eye is drawn in `strip`: once each side of the eye, which
 * reaches both edges of the band. */
export function ringGroundFills(strip: number): TraceBead[] {
  const eye = new Set(eyeByHand(strip).flatMap((step) => step.strokes.flat().map(keyOf)))
  const ground = beadsWhere(PEACOCK_RING, () => true)
  for (const key of eye) ground.delete(key)
  const nearEye = ([, along]: TraceBead) => Math.abs(along - (strip + 0.5) * PEACOCK_RING.period) <= PEACOCK_RING.period
  return reaches(ground).flatMap((group) => fillPress(group, nearEye))
}

/** The middle line of the pupil of the cuff's eye in `strip`: what Colors built in paints. */
export function pupilMiddle(strip: number): TraceBead[] {
  const pupil = [...beadsWhere(PEACOCK_CUFF, (part) => part === 'N').values()].filter(([, along]) => Math.floor(along / PEACOCK_CUFF.period) === strip)
  const lines = [...new Set(pupil.map(([line]) => line))].sort((a, b) => a - b)
  const middle = lines[Math.floor(lines.length / 2)]
  return pupil.filter(([line]) => line === middle)
}
