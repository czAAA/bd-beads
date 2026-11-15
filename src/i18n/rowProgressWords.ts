import { fillBlanks } from '../domain/fillBlanks'
import type { Layered } from '../domain/layerRecord'
import { frameRowOrder, passLine, rowProgressOf, rowProgressPosition } from '../domain/rowProgress'
import { orderStepLabel } from './orderStep'
import type { Translations } from './translations'

/** A Custom frame's pass in words in place of "Row 3 of 20" (ticket 0594): "Round 3" and "of 9", or where its passes
 * are of several sorts, parts, joins or a Fringe earring's strands, "Part 2, round 3" and "· 8 of 20". `shown` is the
 * pass from 1. None for a Frame without a Frame shape. */
export function customPassWords(words: Translations['rowProgress'], project: Layered, shown: number): { label: string; of: string } | undefined {
  const order = frameRowOrder(project)
  const step = order.stepOf?.(shown - 1)
  if (!step) return undefined
  // The last pass is a join or a strand wherever the passes are not all rounds or rows of one part.
  const last = order.stepOf!(order.count - 1)!
  const single = last.kind !== 'join' && last.kind !== 'strand' && last.part === undefined
  const total = order.count
  const of = single ? fillBlanks(words.ofSteps, { total }) : fillBlanks(words.stepOfSteps, { current: shown, total })
  return { label: orderStepLabel(words, step), of }
}

/** The Progress bar's counter in words (ticket 0972): `step` names it, "Row 7 of 10", "Column 4 of 16", "Pass 3 of 27"
 * on peyote with the rulers' `line` "· row 2" after it, a Custom frame's "Round 3 of 9", or Pattern done once every pass
 * is; `short` is "7/10" for a narrow bar; `spoken` is what the announcer says, the same words read as one sentence. */
export interface RowProgressCount {
  step: string
  line?: string
  short: string
  spoken: string
}

/** The one place the counter's words are put together, for the bar's counter and for every move the announcer says
 * (tickets 0934, 0972; ScreenReaders card). */
export function rowProgressCount(words: Translations['rowProgress'], project: Layered): RowProgressCount {
  const { current, total } = rowProgressPosition(project)
  if (current >= total) return { step: words.patternDone, short: words.patternDone, spoken: words.patternDone }
  const shown = current + 1
  const short = `${shown}/${total}`
  const custom = customPassWords(words, project, shown)
  if (custom) {
    const step = `${custom.label} ${custom.of}`
    return { step, short, spoken: step }
  }
  const columns = rowProgressOf(project).direction === 'columns'
  const line = passLine(project)
  const unit = line ? words.passLabel : columns ? words.columnLabel : words.positionLabel
  const step = fillBlanks(words.announcePosition, { unit, current: shown, total })
  if (!line) return { step, short, spoken: step }
  return {
    step,
    line: fillBlanks(columns ? words.columnPassLine : words.passLine, { line: line.line }),
    short,
    spoken: fillBlanks(columns ? words.announceColumnPass : words.announcePass, { step, line: line.line }),
  }
}

/** What the announcer says after a move of the row pointer (ticket 0934; ScreenReaders card): the counter's words. */
export function rowProgressAnnouncement(words: Translations['rowProgress'], project: Layered): string {
  return rowProgressCount(words, project).spoken
}
