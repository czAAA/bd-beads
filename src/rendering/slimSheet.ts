import type { Insets } from '../domain/toolPill'
import type { Size } from './cellSize'
import { MARGIN_PX } from './marginSizes'

/** What the expanded Frame's slim sheet holds (MarginSheet card, Expand the Frame; tickets 1169, 1194), in screen px: the
 * row, the title block, how thick the numbers stand on the left and top as seen (0 where none), the row's width, the
 * numbers' size and the room to fill (none: as small as it can be). `compact` is under bp-tablet. */
export interface SlimContent {
  compact: boolean
  row: number
  title: number
  numbers: { left: number; top: number }
  rowWidth: number
  fontPx: number
  fill?: Size
}

/** The slim sheet's row and title block in from its edge, and a side's least width: smaller under bp-tablet. */
export function slimInset(compact: boolean): number {
  return MARGIN_PX.expanded.inset[compact ? 'compact' : 'full']
}

/** The slim sheet's sides out from the Frame's line, in screen px: row and column numbers on top, row numbers left,
 * title block below, else the inset; widened evenly to hold its row (1169) and to fill its room, the spare height shared
 * by the top band and the bottom strip (1194). */
export function slimSheetSides({ compact, row, title, numbers, rowWidth, fill }: SlimContent, lineWidth: number, lineHeight = 0): Insets {
  const inset = slimInset(compact)
  const gap = MARGIN_PX.expanded.numbers
  const left = numbers.left ? inset + numbers.left + gap : inset
  const right = inset
  const top = inset + row + (numbers.top ? gap + numbers.top + gap : inset)
  const bottom = title ? inset + title + inset : inset
  const short = Math.max(0, Math.max(rowWidth + 2 * inset, fill?.width ?? 0) - (lineWidth + left + right)) / 2
  const spare = fill ? Math.max(0, fill.height - (lineHeight + top + bottom)) / 2 : 0
  return { top: top + spare, left: left + short, right: right + short, bottom: bottom + spare }
}
