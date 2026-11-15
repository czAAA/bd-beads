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

/** What the announcer says after a move of the row pointer (ticket 0934; ScreenReaders card), in the counter's own
 * words: "Row 7 of 10", "Column 4 of 16", "Pass 3 of 27, row 2" on peyote, "Round 3 of 9" on a Custom frame, and
 * "Pattern done" once every pass is. The one place these words are put together, for every move that says them. */
export function rowProgressAnnouncement(words: Translations['rowProgress'], project: Layered): string {
  const { current, total } = rowProgressPosition(project)
  if (current >= total) return words.patternDone
  const shown = current + 1
  const custom = customPassWords(words, project, shown)
  if (custom) return `${custom.label} ${custom.of}`
  const columns = rowProgressOf(project).direction === 'columns'
  const line = passLine(project)
  if (line) return fillBlanks(columns ? words.announceColumnPass : words.announcePass, { current: shown, total, line: line.line })
  return fillBlanks(words.announcePosition, { unit: columns ? words.columnLabel : words.positionLabel, current: shown, total })
}
