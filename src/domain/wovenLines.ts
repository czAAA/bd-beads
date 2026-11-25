import type { FrameRef } from './grid'
import { frameShapeOf, rowOrderOf } from './frameShape'
import { type Layered, frameById } from './layerRecord'
import { frameWeave } from './layerWeave'
import type { RowProgress } from './project'
import type { RowOrder } from './rowOrder'
import { currentPass, frameRowOrder, ownRowWayOf, ROW_WAYS, rowProgressOf, rowProgressStarted } from './rowProgress'
import type { SeenWay } from './rowWays'
import type { Technique } from './weave'

// The rows already woven when a Frame change would alter what they are (spec 1182, ticket 1184): Rotate Frame and a
// change of the Frame's Technique ask first once a pass is done. The questions and what keeping the rows means live
// here; the flows know only the prompt.

/** What the weaver chose to do with the rows woven: start over, or keep them. */
export type WovenChoice = 'start-over' | 'keep'

/** What the question about the rows woven tells: how many whole lines are marked done, and the way they run as seen. */
export interface WovenLines {
  lines: number
  way: SeenWay
}

/** Rotate Frame's question (ticket 1184): start over in the way as seen, or keep the rows with the way turned along. */
export type RotateFrameQuestion = WovenLines

/** A Frame Technique change's question (ticket 1184): start over for the new Technique, or keep the whole lines. */
export interface TechniqueChangeQuestion extends WovenLines {
  technique: Technique
}

/** How many whole lines the passes before `pass` weave, worked by `order`: a line with only some of its passes done (a
 * peyote line's first half) counts as not done. @internal Its test checks the count on its own. */
export function wholeLinesDone(order: RowOrder, pass: number): number {
  const done = Math.min(Math.max(pass, 0), order.count)
  let lines = 0
  let last: number | undefined
  for (let each = 0; each < done; each += 1) {
    const line = order.lineOf(each)
    if (line !== last) {
      lines += 1
      last = line
    }
  }
  return done < order.count && done > 0 && order.lineOf(done) === last ? lines - 1 : lines
}

/** The first pass of the line after the first `lines` whole lines, worked by `order`: where the pointer stands once
 * those lines are done; one past the last pass once every line is. @internal Its test checks it on its own. */
export function firstPassAfterLines(order: RowOrder, lines: number): number {
  let started = 0
  let last: number | undefined
  for (let pass = 0; pass < order.count; pass += 1) {
    const line = order.lineOf(pass)
    if (line === last) continue
    if (started === lines) return pass
    started += 1
    last = line
  }
  return order.count
}

/** The whole lines done the way the rows run now, and that way as seen: what both questions tell. Nothing with no pass
 * done, or on a Custom frame, which keeps its own rules (its order turns with its layout and its pointer stays). */
function wovenLinesOf(project: Layered, ref: FrameRef): WovenLines | undefined {
  const frame = frameById(project, ref)
  if (!frame || frameShapeOf(frame) || !rowProgressStarted(project, ref)) return undefined
  const rowProgress = rowProgressOf(project, ref)
  return { lines: wholeLinesDone(frameRowOrder(project, ref), currentPass(rowProgress)), way: rowProgress.way }
}

/** What Rotate Frame asks first (ticket 1184), or nothing where it just turns: no pass done, or a Custom frame. The
 * one place the rule lives. */
export function rotateFrameQuestion(project: Layered, ref: FrameRef): RotateFrameQuestion | undefined {
  return wovenLinesOf(project, ref)
}

/** What a change of the Frame's Technique to `technique` asks first (ticket 1184), or nothing where it goes at once:
 * no pass done, the same Technique, or a Custom frame (whose Technique waits once a pass is done). The one place the
 * rule lives. */
export function techniqueChangeQuestion(project: Layered, technique: Technique, ref: FrameRef): TechniqueChangeQuestion | undefined {
  if (frameWeave(project, ref).technique === technique) return undefined
  const woven = wovenLinesOf(project, ref)
  return woven && { ...woven, technique }
}

/** The Frame's Row order the rows run `way` as seen. */
function orderFor(project: Layered, way: SeenWay, ref: FrameRef): RowOrder {
  const { rows = 0, columns = 0 } = frameById(project, ref) ?? {}
  return rowOrderOf({ ...frameWeave(project, ref), rows, columns }, ownRowWayOf(project, way, ref))
}

/** `before`'s Row progress kept in `after`'s Technique (ticket 1184): the way stays, and each pointer becomes the first
 * pass of the line after the whole lines it had done, counted in the new Technique's passes; a peyote line with only
 * one of its two passes done goes back to its start. */
export function linesKeptIn(before: Layered, after: Layered, ref: FrameRef): RowProgress {
  const rowProgress = rowProgressOf(before, ref)
  const kept: RowProgress = { way: rowProgress.way }
  for (const way of ROW_WAYS) {
    const pass = rowProgress[way]
    if (!pass) continue
    const at = firstPassAfterLines(orderFor(after, way, ref), wholeLinesDone(orderFor(before, way, ref), pass))
    if (at > 0) kept[way] = at
  }
  return kept
}

/** Whether the Frame's Technique waits (its control off) once a pass is done: a Custom frame's only, which keeps its
 * own rules (ticket 1184); any other Frame's asks instead (techniqueChangeQuestion). */
export function frameTechniqueWaits(project: Layered, ref: FrameRef): boolean {
  const frame = frameById(project, ref)
  return !!frame && !!frameShapeOf(frame) && rowProgressStarted(project, ref)
}
