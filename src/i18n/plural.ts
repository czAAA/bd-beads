import { groupThousands } from '../domain/formatNumber'
import type { Locale } from './translations'

/** The forms a counted word takes: English uses one and other; Russian one, few and many (`writing.md`, Plurals). */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }

const rules = new Map<Locale, Intl.PluralRules>()

/** The form of `forms` that `count` takes in `locale`, with "{count}" filled in (thousands grouped by a no-break space). */
export function plural(locale: Locale, count: number, forms: PluralForms): string {
  let rule = rules.get(locale)
  if (!rule) {
    rule = new Intl.PluralRules(locale)
    rules.set(locale, rule)
  }
  const form = forms[rule.select(count)] ?? forms.other
  return form.replace('{count}', groupThousands(count))
}
