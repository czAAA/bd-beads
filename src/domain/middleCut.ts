/** The mark that stands for the characters a middle cut leaves out. */
const MARK = '…'

/** `text` as one line that `fits`: whole when it fits, otherwise its start and end kept round "…" with as many characters
 * as fit, so a file name keeps both what it begins with and its extension (ticket 0929). Cuts between code points. */
export function middleCut(text: string, fits: (candidate: string) => boolean): string {
  if (fits(text)) return text
  const chars = Array.from(text)
  const cutTo = (kept: number) => chars.slice(0, Math.ceil(kept / 2)).join('') + MARK + chars.slice(chars.length - Math.floor(kept / 2)).join('')
  let low = 0
  let high = chars.length - 1
  while (low < high) {
    const kept = Math.ceil((low + high) / 2)
    if (fits(cutTo(kept))) low = kept
    else high = kept - 1
  }
  return cutTo(low)
}
