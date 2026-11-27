/** A one-line row's width in its own px, its parts side by side, the part matching `flexible` counted at the width
 * `keep` gives its text instead of what it shows now: the margin sheet fits its rows by it (ticket 1258). 0 where
 * nothing is laid out (jsdom). */
export function rowWidth(row: HTMLElement | undefined, flexible: string, keep: (text: HTMLElement, chrome: number) => number): number {
  if (!row) return 0
  // Laid out at its natural width while it is read: squeezed into its room, a part's own width says nothing.
  const { maxWidth, width, flexShrink } = row.style
  Object.assign(row.style, { maxWidth: 'none', width: 'max-content', flexShrink: '0' })
  const natural = naturalRowWidth(row, flexible, keep)
  Object.assign(row.style, { maxWidth, width, flexShrink })
  return natural
}

function naturalRowWidth(row: HTMLElement, flexible: string, keep: (text: HTMLElement, chrome: number) => number): number {
  const parts = [...row.children].filter((part): part is HTMLElement => part instanceof HTMLElement && part.offsetWidth > 0)
  const px = (value: string) => Number.parseFloat(value) || 0
  const widths = parts.map((part) => {
    const style = getComputedStyle(part)
    const margins = px(style.marginLeft) + px(style.marginRight)
    const text = part.matches(flexible) ? part.querySelector<HTMLElement>('.margin-chip__text') : null
    if (!text) return part.offsetWidth + margins
    // What the part holds round its text: padding, the gap and the pencil.
    const chrome = part.offsetWidth - text.offsetWidth
    return chrome + keep(text, chrome) + margins
  })
  return Math.ceil(widths.reduce((sum, width) => sum + width, 0) + px(getComputedStyle(row).columnGap) * Math.max(0, parts.length - 1))
}
