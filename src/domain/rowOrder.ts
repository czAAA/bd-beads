import { keyOf, type FrameLayout, type LayoutJoin, type LayoutPosition } from './frameLayout'
import type { GridPosition } from './grid'
import { describeWeave, type Weave } from './weave'
import type { PassDirection } from './weaveGeometry'

/** The way the weaver works through a Frame (ticket 0589): along its rows or down its columns, from its far end when
 * reversed. Row progress keeps a pointer for each. */
export interface RowWay {
  direction: PassDirection
  reversed?: boolean
}

/** A Row order (spec 0590, ADR 0077): how Row progress steps through a Frame's beads, pass by pass from pass 0, worked
 * one way. Row progress asks it and never the Technique. A Custom frame chains one per panel, each one's passes counted
 * on from the passes before it, so a (panel, step) pointer is still one number. */
export interface RowOrder {
  /** Whether the weaver may turn the way the rows run (Turn row direction). */
  turns: boolean
  /** How many passes the Frame takes; a pointer at `count` means every pass is done (ticket 411). */
  count: number
  /** The pass that weaves the bead at a position counted from the Frame's first row and column. */
  passAt(position: GridPosition): number
  /** The positions a pass weaves, from the Frame's first row and column, in order along each line; none past the
   * last pass. What the current-row marker rings and the Word chart reads. */
  positionsOf(pass: number): GridPosition[]
  /** The Frame line (row or column, the way the rows run) a pass works on, as the rulers mark it; none where a pass is
   * not on one line. */
  lineOf(pass: number): number | undefined
  /** What a pass of a Custom frame is, for the Word chart: a round or row (of a part, where there are several), or a
   * join; none for a Frame without a shape, whose passes are its lines. */
  stepOf?(pass: number): OrderStep | undefined
  /** A round's sides in the order `positionsOf` lists its beads (ticket 0873), for the Word chart; none for a ring, a
   * row, a strand, a join or a Frame without a shape. */
  sidesOf?(pass: number): readonly RoundSide[] | undefined
  /** A row worked across a spine (ticket 0874): the end it starts from and where its spine pair is, for the Word chart;
   * none for any other pass. */
  spineOf?(pass: number): SpineRow | undefined
}

/** One side of a round as it is beaded (ticket 0873): the beads picked up together at its corner (a corner pair's two,
 * one either side of a Seam), then its single beads. */
export interface RoundSide {
  corner: number
  singles: number
}

/** A Kite row as it is beaded (ticket 0874): the wing's end it starts from, as the shape stands upright, and where among
 * the beads `positionsOf` lists its spine pair comes, the two beads picked up together. */
export interface SpineRow {
  from: 'left' | 'right'
  pair: number
}

/** A pass of a Custom frame's Row order (ticket 0594), numbered from 1 as a pattern counts: a round from the centre or a
 * row from the point, of one part of several, a Fringe earring's strand from the first (ticket 0597), or a join between
 * parts. */
export type OrderStep =
  | { kind: 'round' | 'row'; number: number; part?: number }
  | { kind: 'strand'; number: number }
  | { kind: 'join'; step: LayoutJoin['step']; parts: readonly number[] }

/** A line's index counted from the Frame's far end when the way is reversed, so every pass rule keeps working on lines
 * counted in weaving order (ticket 0589). */
function mirrorLine(line: number, lines: number, reversed: boolean | undefined): number {
  return reversed ? lines - 1 - line : line
}

/** The rows Row order (ticket 347): a Frame without a shape woven line by line in its Weave's passes, loom and brick stitch
 * one pass a line, peyote two after the first. */
export function rowsOrder(weave: Weave & { rows: number; columns: number }, { direction, reversed }: RowWay): RowOrder {
  const columnWise = direction === 'columns'
  const lines = columnWise ? weave.columns : weave.rows
  const length = columnWise ? weave.rows : weave.columns
  const description = describeWeave(weave)
  const passes = description.passes
  const count = passes.count(lines, direction)
  return {
    turns: true,
    count,
    passAt: ({ row, column }) => (columnWise ? passes.of(mirrorLine(column, lines, reversed), row, direction) : passes.of(mirrorLine(row, lines, reversed), column, direction)),
    positionsOf: (pass) => {
      if (pass < 0 || pass >= count) {
        return []
      }
      const positions: GridPosition[] = []
      for (const line of passes.lines(pass, direction)) {
        const at = mirrorLine(line, lines, reversed)
        for (let along = 0; along < length; along += 1) {
          if (passes.of(line, along, direction) === pass) {
            positions.push(columnWise ? { row: along, column: at } : { row: at, column: along })
          }
        }
      }
      return positions
    },
    lineOf: (pass) => mirrorLine(passes.lineOf(pass, direction), lines, reversed),
  }
}

/** One pass of a Custom frame: what it is and the positions it weaves. */
interface LayoutPass {
  step: OrderStep
  positions: GridPosition[]
  sides?: RoundSide[]
  spine?: SpineRow
}

/** A round as it is beaded (ticket 0873): the step-up leads into the corner pair across the Seam into its first panel,
 * so its last panel's last bead comes first; then side by side, a pair wherever the next bead is on another panel, its
 * singles up to the next pair. A ring, a bead a panel, has no pairs. */
function fromCornerPair(round: readonly LayoutPosition[]): { positions: LayoutPosition[]; sides?: RoundSide[] } {
  const positions = [...round.slice(-1), ...round.slice(0, -1)]
  if (new Set(round.map(({ panel }) => panel)).size === round.length) return { positions }
  const pairAt = (at: number) => at + 1 < positions.length && positions[at]!.panel !== positions[at + 1]!.panel
  const sides: RoundSide[] = []
  let at = 0
  while (at < positions.length) {
    const corner = pairAt(at) ? 2 : 1
    let singles = 0
    for (at += corner; at < positions.length && !pairAt(at); at += 1) singles += 1
    sides.push({ corner, singles })
  }
  return { positions, sides }
}

/** A Kite row as it is beaded (ticket 0874): an odd row from the left wing's end in to the spine pair, the beads named 0
 * and 1, and out along the right wing; an even row back. */
function acrossSpine(row: readonly LayoutPosition[], number: number): { positions: LayoutPosition[]; spine: SpineRow } {
  const wing = (side: number) => row.filter(({ column }) => column % 2 === side).sort((a, b) => a.column - b.column)
  const fromLeft = number % 2 === 1
  const leftToRight = [...wing(0).reverse(), ...wing(1)]
  return { positions: fromLeft ? leftToRight : leftToRight.reverse(), spine: { from: fromLeft ? 'left' : 'right', pair: wing(fromLeft ? 0 : 1).length - 1 } }
}

/** The beads of a part's last round that face another part: those within a bead of the nearest, where a zip or hinge
 * runs. */
function facingEdge(last: readonly LayoutPosition[], other: readonly LayoutPosition[]): LayoutPosition[] {
  const gap = (bead: LayoutPosition) => Math.min(...other.map((each) => Math.hypot(each.x - bead.x, each.y - bead.y)))
  const nearest = Math.min(...last.map(gap))
  return last.filter((bead) => gap(bead) <= nearest + 1)
}

/** The passes of a Custom frame (spec 0590, ADR 0077): each part in making order, round by round from its centre, each
 * from its corner pair (ticket 0873), row by row from a Kite's point back and forth across its spine (ticket 0874), or
 * row by row from a Fringe earring's base, read left to right; a strand in one pass strung from the top down; then its joins, each ringing the edges it puts together. */
function layoutPasses(layout: FrameLayout, lines: 'round' | 'row'): LayoutPass[] {
  const parts = [...new Set(layout.panels.map(({ part }) => part))].sort((a, b) => layout.panels.find((panel) => panel.part === a)!.order - layout.panels.find((panel) => panel.part === b)!.order)
  const strandOf = (part: number) => layout.panels.find((panel) => panel.part === part)!.strand === true
  const several = parts.filter((part) => !strandOf(part)).length > 1
  let strands = 0
  const ofPart = (part: number) => layout.positions.filter(({ panel }) => layout.panels[panel]!.part === part)
  const lastRound = (part: number) => {
    const beads = ofPart(part)
    const last = Math.max(...beads.map(({ row }) => row))
    return beads.filter(({ row }) => row === last)
  }
  const passes: LayoutPass[] = []
  for (const part of parts) {
    const beads = ofPart(part)
    if (strandOf(part)) {
      strands += 1
      // By name, from the top down, so a strand turned by Rotate Frame is still strung from the top.
      passes.push({ step: { kind: 'strand', number: strands }, positions: [...beads].sort((a, b) => a.row - b.row).map(({ row, column }) => ({ row, column })) })
      continue
    }
    // Its lines in the order of their names: a Fringe earring's body is named below its point (ticket 0814). A peyote
    // top weaves each line after the first in two passes, as a peyote Frame does: its higher columns' beads, then the
    // lower ones'.
    const names = [...new Set(beads.map(({ row }) => row))].sort((a, b) => a - b)
    const first = passes.length
    for (const [index, line] of names.entries()) {
      const positions = beads.filter(({ row }) => row === line).sort((a, b) => (lines === 'row' ? a.x - b.x : a.column - b.column))
      const lower = new Set(layout.twoPasses?.lower)
      const halves = layout.twoPasses && index > 0 ? [false, true].map((low) => positions.filter(({ column }) => lower.has(column) === low)) : [positions]
      for (const half of halves.filter((each) => each.length > 0)) {
        const number = passes.length - first + 1
        const worked: Omit<LayoutPass, 'step'> = lines === 'round' ? fromCornerPair(half) : layout.acrossSpine ? acrossSpine(half, number) : { positions: half }
        const step: OrderStep = { kind: lines, number, ...(several ? { part: part + 1 } : {}) }
        passes.push({ ...worked, step, positions: worked.positions.map(({ row, column }) => ({ row, column })) })
      }
    }
  }
  for (const join of layout.joins) {
    const [first, second] = join.parts
    // A part zipped on itself, or into what the face does not show, rings nothing.
    const positions = second === undefined ? [] : [...facingEdge(lastRound(first!), lastRound(second)), ...facingEdge(lastRound(second), lastRound(first!))]
    passes.push({ step: { kind: 'join', step: join.step, parts: join.parts.map((part) => part + 1) }, positions: positions.map(({ row, column }) => ({ row, column })) })
  }
  return passes
}

const layoutOrders = new WeakMap<FrameLayout, RowOrder>()

/** A Custom frame's Row order (ticket 0594): its passes chained part after part, then its joins, so a (part, step)
 * pointer is one number. Worked one way only, whichever way the rows were set to run. */
export function layoutOrder(layout: FrameLayout, lines: 'round' | 'row'): RowOrder {
  const known = layoutOrders.get(layout)
  if (known) return known
  const passes = layoutPasses(layout, lines)
  const passOfBead = new Map<string, number>()
  passes.forEach(({ step, positions }, pass) => {
    if (step.kind !== 'join') for (const position of positions) passOfBead.set(keyOf(position), pass)
  })
  const order: RowOrder = {
    turns: false,
    count: passes.length,
    passAt: (position) => passOfBead.get(keyOf(position)) ?? Number.POSITIVE_INFINITY,
    positionsOf: (pass) => passes[pass]?.positions ?? [],
    lineOf: () => undefined,
    stepOf: (pass) => passes[pass]?.step,
    sidesOf: (pass) => passes[pass]?.sides,
    spineOf: (pass) => passes[pass]?.spine,
  }
  layoutOrders.set(layout, order)
  return order
}
