import type { Locale } from './locale'

const formats = new Map<string, Intl.NumberFormat>()

function numberFormat(locale: Locale, fractionDigits: number): Intl.NumberFormat {
  const key = `${locale}:${fractionDigits}`
  let found = formats.get(key)
  if (!found) {
    // 'always' groups four-digit numbers too (Spanish and Polish would leave 1200 bare), so "1 200" reads the same
    // everywhere. The TypeScript lib types useGrouping as a boolean only; 'always' is valid in every supported browser.
    const useGrouping = 'always' as unknown as boolean
    found = new Intl.NumberFormat(locale, {
      useGrouping,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
    formats.set(key, found)
  }
  return found
}

// A count with thousands grouped the way the language writes them: "1 200" with a no-break space in English (the
// `writing.md` house rule, kept from before `Intl`), and `Intl`'s own sign elsewhere: no-break space in Russian,
// Ukrainian, Belarusian and Polish, period in Spanish, comma in Chinese.
export function groupThousands(value: number, locale: Locale = 'en'): string {
  return numberFormat(locale, 0)
    // `+ 0` turns -0 (from truncating -0.5) into 0, so it never prints as "-0".
    .formatToParts(Math.trunc(value) + 0)
    .map((part) => (part.type === 'group' && locale === 'en' ? ' ' : part.value))
    .join('')
}

// The language's own decimal sign: a comma for Russian, Ukrainian, Belarusian, Spanish and Polish, a period for English
// and Chinese (`writing.md`, Numbers).
export function decimalSign(locale: Locale): string {
  return numberFormat(locale, 1).formatToParts(1.5).find((part) => part.type === 'decimal')?.value ?? '.'
}

/** A count of beads in millions for the size gate's warning (ticket 0716): "31" for 31 771 024, "2,5" for 2 512 000 in
 * Russian; cut down, never rounded up, with one decimal under ten million and a trailing zero left out. */
export function inMillions(value: number, locale: Locale = 'en'): string {
  const tenths = Math.floor(value / 100_000)
  const shown = tenths >= 100 ? Math.floor(tenths / 10) : tenths / 10
  return Number.isInteger(shown) ? groupThousands(shown, locale) : numberFormat(locale, 1).format(shown)
}
