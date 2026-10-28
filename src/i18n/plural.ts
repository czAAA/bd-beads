import { fillBlanks } from '../domain/fillBlanks'
import { groupThousands } from '../domain/formatNumber'
import type { Locale } from './translations'

/** The forms a counted word takes: English one and other; Russian and Polish one, few and many; Spanish one, many and other; Chinese other only (`writing.md`, Plurals). */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }

const rules = new Map<Locale, Intl.PluralRules>()

/** The form of `forms` that `count` takes in `locale`, its blanks left in: for a form with more blanks than `{count}`. */
export function pluralForm(locale: Locale, count: number, forms: PluralForms): string {
  let rule = rules.get(locale)
  if (!rule) {
    rule = new Intl.PluralRules(locale)
    rules.set(locale, rule)
  }
  return forms[rule.select(count)] ?? forms.other
}

/** The form of `forms` that `count` takes in `locale`, with "{count}" filled in (thousands grouped by a no-break space). */
export function plural(locale: Locale, count: number, forms: PluralForms): string {
  // A form may spell its count out ("Added an empty row"), so the count is optional.
  return fillBlanks(pluralForm(locale, count, forms), {}, { count: groupThousands(count, locale) })
}
