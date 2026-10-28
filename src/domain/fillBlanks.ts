const BLANK = /\{(\w+)\}/g

/** A value for a blank: a number is written as it is (`String`), so a count that groups its thousands is passed as the
 * string `groupThousands` makes. */
type BlankValues = Readonly<Record<string, string | number>>

/** Fills every `{name}` blank of a translated string (ticket 0614), the one way strings are filled. A blank with no
 * value, or a value with no blank, throws in development and tests (the built app keeps the blank); `optional` holds
 * values a string may leave out, such as a counted word's form that spells its count out ("Added an empty row"). */
export function fillBlanks(template: string, values: BlankValues, optional: BlankValues = {}): string {
  const unused = new Set(Object.keys(values))
  const filled = template.replace(BLANK, (blank, name: string) => {
    const from = Object.hasOwn(values, name) ? values : Object.hasOwn(optional, name) ? optional : undefined
    if (!from) return mismatch(`“${template}” has a blank ${blank} with no value`, blank)
    unused.delete(name)
    return String(from[name])
  })
  for (const name of unused) mismatch(`“${template}” has no blank {${name}} for its value`, '')
  return filled
}

function mismatch(message: string, kept: string): string {
  // Optional: Playwright's specs import the domain without Vite, where `import.meta.env` is not defined.
  if (import.meta.env?.DEV) throw new Error(message)
  return kept
}
