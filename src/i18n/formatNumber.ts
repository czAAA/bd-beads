/** A count with its thousands grouped by a no-break space, "1 200", the same in both languages (`writing.md`, Numbers). */
export function groupThousands(value: number): string {
  return String(Math.trunc(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}
