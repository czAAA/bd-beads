import { MARGIN_PX } from './marginSizes'

// Which of the Frame's tools stand on the margin sheet's band and which go under the Frame tools button (MarginSheet
// card, Zoom forms, ticket 1195): one rule by the band's width, for every form and pointer.

/** A Frame tool of the band, by its id. */
export type BandToolId = 'mirror' | 'rotate' | 'edit' | 'export' | 'color' | 'remove'

/** The band's tools in the order they stand on it, left to right. */
export const BAND_ORDER: readonly BandToolId[] = ['mirror', 'rotate', 'edit', 'export', 'color', 'remove']

/** The order the tools leave the band for the menu where the width runs out: the least used first, Edit Frame last. */
const OVERFLOW_ORDER: readonly BandToolId[] = ['remove', 'export', 'color', 'mirror', 'rotate', 'edit']

/** The band's row: tools of 28px (full) or 24px (compact and folded). */
export type BandRow = 'full' | 'compact' | 'folded'

/** What a fit puts where: the row, the tools on the band in their order, and the tools in the menu. */
export interface BandFit {
  row: BandRow
  onBand: readonly BandToolId[]
  overflow: readonly BandToolId[]
}

export interface BandToolsDeps {
  /** The tools the Frame offers now (Mirror and Rotate only where the Frame can be turned, and so on), in any order. */
  tools: readonly BandToolId[]
  /** The rows to try, widest first. */
  rows: readonly BandRow[]
  /** The band's room, in the sheet's drafting px (on screen over the scale). */
  room: number
  /** A coarse pointer: 44px hit areas, so the tools stand further apart. */
  touch: boolean
  /** Expanded, Expand the Frame and the tools stand side by side, with no Move bar between them (ticket 1169). */
  expanded: boolean
}

const TOUCH_TARGET = 44
const TOOL_GAP = 2
/** The divider before Remove Frame: 1px with 2px each side. */
const DIVIDER = 1 + 2 * TOOL_GAP
const toolSize = (row: BandRow) => (row === 'full' ? MARGIN_PX.tool : MARGIN_PX.tab)

/** The width of the tools' end of the row with `shown` tools and, where some are left, the menu button. */
function toolsWidth(row: BandRow, shown: readonly BandToolId[], menu: boolean, touch: boolean): number {
  const size = toolSize(row)
  const items = shown.length + (menu ? 1 : 0)
  if (items === 0) return 0
  // A finger: the tools stand apart by what their hit areas reach past them, and half of it before the first.
  const gap = touch ? TOUCH_TARGET - size : TOOL_GAP
  const divider = !touch && shown.length > 1 && shown.includes('remove') ? DIVIDER + 2 * gap : 0
  return items * size + (items - 1) * gap + divider + (touch ? (TOUCH_TARGET - size) / 2 : 0)
}

/** The band row's width in drafting px with `shown` tools: the Move bar centred, with room on each side for the wider
 * of Expand the Frame and the tools; expanded, the two side by side. */
export function bandRowWidth(row: BandRow, shown: readonly BandToolId[], menu: boolean, touch: boolean, expanded: boolean): number {
  const start = toolSize(row)
  const end = toolsWidth(row, shown, menu, touch)
  if (expanded) return start + end + 2 * MARGIN_PX.gap + (touch ? (TOUCH_TARGET - start) / 2 : 0)
  return MARGIN_PX.moveWidth + 2 * Math.max(start, end) + 2 * MARGIN_PX.gap
}

/** The first row that holds every tool; where none does, the last row with as many tools as fit, the rest under the
 * menu button in `OVERFLOW_ORDER`. None where not even the row with the menu button alone fits. */
export function bandTools({ tools, rows, room, touch, expanded }: BandToolsDeps): BandFit | undefined {
  const all = BAND_ORDER.filter((id) => tools.includes(id))
  const fits = (row: BandRow, shown: readonly BandToolId[]) => bandRowWidth(row, shown, shown.length < all.length, touch, expanded) <= room
  const whole = rows.find((row) => fits(row, all))
  if (whole) return { row: whole, onBand: all, overflow: [] }
  const row = rows.at(-1)
  if (!row) return undefined
  const leaving = OVERFLOW_ORDER.filter((id) => all.includes(id))
  for (let gone = 1; gone <= leaving.length; gone++) {
    const overflow = leaving.slice(0, gone)
    const onBand = all.filter((id) => !overflow.includes(id))
    if (fits(row, onBand)) return { row, onBand, overflow: BAND_ORDER.filter((id) => overflow.includes(id)) }
  }
  return undefined
}
