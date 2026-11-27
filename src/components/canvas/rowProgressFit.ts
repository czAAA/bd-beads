import { ownLength } from '../../composables/ui/cssZoom'

/** The forms of Row progress's strip, best first (MarginSheet card, Several Frames; tickets 1176, 1223): the whole of it;
 * the counter shortened to "5/30"; the track given up; Back a row's words, then Row done's; last the Reset progress and
 * Show row marks icons (ticket 1256). Row done is never dropped. */
export const STRIP_FITS = ['whole', 'short', 'trackless', 'arrow', 'icons', 'spare'] as const
export type StripFit = (typeof STRIP_FITS)[number]

/** What each form hands the strip's controls. */
export const STRIP_FIT_PROPS: Record<StripFit, { drop: 0 | 1 | 2 | 3 | 4; shortCount: boolean }> = {
  whole: { drop: 0, shortCount: false },
  short: { drop: 0, shortCount: true },
  trackless: { drop: 1, shortCount: true },
  arrow: { drop: 2, shortCount: true },
  icons: { drop: 3, shortCount: true },
  spare: { drop: 4, shortCount: true },
}

/** The strip's width in the element's own px as laid out, its track counted at its least, as it fills the rest: `scale`
 * is what the sheet draws it at (1 on the cuff). 0 where nothing is laid out. */
export function stripWidth(strip: HTMLElement | null | undefined, scale = 1): number {
  if (!strip) return 0
  const style = getComputedStyle(strip)
  const parts = [...strip.children].filter((part): part is HTMLElement => part instanceof HTMLElement && getComputedStyle(part).display !== 'none')
  const gap = (Number.parseFloat(style.columnGap) || 0) * Math.max(0, parts.length - 1)
  const own = (Number.parseFloat(style.paddingLeft) || 0) + (Number.parseFloat(style.paddingRight) || 0) + (Number.parseFloat(style.borderLeftWidth) || 0) + (Number.parseFloat(style.borderRightWidth) || 0)
  const widths = parts.map((part) => {
    const at = getComputedStyle(part)
    const margins = (Number.parseFloat(at.marginLeft) || 0) + (Number.parseFloat(at.marginRight) || 0)
    const filling = part.classList.contains('row-progress__track--strip')
    return margins + (filling ? Number.parseFloat(at.flexBasis) || 0 : ownLength(part, part.getBoundingClientRect().width) / scale)
  })
  const sum = widths.reduce((total, width) => total + width, 0)
  return sum > 0 ? sum + gap + own : 0
}
