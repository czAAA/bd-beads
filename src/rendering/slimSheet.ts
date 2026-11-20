import type { Insets } from '../domain/toolPill'
import { MARGIN_PX } from './marginSizes'

/** What the expanded Frame's slim sheet holds (MarginSheet card, Expand the Frame; ticket 1169), in screen px at scale
 * 1: the band's row, the title block (0 where none shows), how thick the numbers stand on the left and the top as seen
 * (0 where none), and the row's width. `compact` is under bp-tablet, where the insets are smaller. */
export interface SlimContent {
  compact: boolean
  row: number
  title: number
  numbers: { left: number; top: number }
  rowWidth: number
}

/** The slim sheet's row and title block in from its edge, and a side's least width: smaller under bp-tablet. */
export function slimInset(compact: boolean): number {
  return MARGIN_PX.expanded.inset[compact ? 'compact' : 'full']
}

/** The slim sheet's sides out from the Frame's line, in screen px: the row and the column numbers on top, the row
 * numbers on the left, the title block below, a side with none of them the inset alone; widened evenly where the Frame
 * is narrower than the row, so the row stays whole (ticket 1169). */
export function slimSheetSides({ compact, row, title, numbers, rowWidth }: SlimContent, lineWidth: number): Insets {
  const inset = slimInset(compact)
  const gap = MARGIN_PX.expanded.numbers
  const left = numbers.left ? inset + numbers.left + gap : inset
  const right = inset
  const short = Math.max(0, rowWidth + 2 * inset - (lineWidth + left + right)) / 2
  return {
    top: inset + row + (numbers.top ? gap + numbers.top + gap : inset),
    left: left + short,
    right: right + short,
    bottom: title ? inset + title + inset : inset,
  }
}
