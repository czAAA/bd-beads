import type { Locale } from './locale'

const formats = new Map<string, Intl.NumberFormat>()

function format(locale: Locale, fractionDigits: number): Intl.NumberFormat {
  const key = `${locale}:${fractionDigits}`
  let found = formats.get(key)
  if (!found) {
    // 'always' groups four-digit numbers too (Spanish and Polish would leave 1200 bare), so "1 200" reads the same everywhere.
    // The TypeScript lib types useGrouping as a boolean only; 'always' is valid in every supported browser.
    const useGrouping = 'always' as unknown as boolean
    found = new Intl.NumberFormat(locale, { useGrouping, minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })
    formats.set(key, found)
  }
  return found
}

/**
 * A count with its thousands grouped the way the language writes them: "1 200" with a no-break space in English (the
 * house rule that `writing.md` set before `Intl`, kept so English reads as it always did), and `Intl`'s own sign in
 * the others: a no-break space in Russian and Polish, a period in Spanish, a comma in Chinese.
 */
export function groupThousands(value: number, locale: Locale = 'en'): string {
  return format(locale, 0)
    .formatToParts(Math.trunc(value) + 0)
    .map((part) => (part.type === 'group' && locale === 'en' ? ' ' : part.value))
    .join('')
}

/** The language's own decimal sign: a comma for Russian, Spanish and Polish, a period for English and Chinese (`writing.md`, Numbers). */
export function decimalSign(locale: Locale): string {
  return format(locale, 1).formatToParts(1.5).find((part) => part.type === 'decimal')?.value ?? '.'
}
