import type { Locale } from './locale'

/** A count with its thousands grouped by a no-break space, "1 200", the same in both languages (`writing.md`, Numbers). */
export function groupThousands(value: number): string {
  return String(Math.trunc(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/** The language's own decimal sign: a comma for Russian, a period otherwise (`writing.md`, Numbers). */
export function decimalSign(locale: Locale): string {
  return locale === 'ru' ? ',' : '.'
}
