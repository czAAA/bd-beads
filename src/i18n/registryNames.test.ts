import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG } from '../domain/beads'
import { LOCALES, type Locale } from '../domain/locale'
import { BUILT_IN_COLORS } from '../domain/palette'
import { describeWeave, TECHNIQUES, techniqueNameKey } from '../domain/weave'
import { be } from './be'
import { en } from './en'
import { es } from './es'
import { pl } from './pl'
import { ru } from './ru'
import { uk } from './uk'
import { zh } from './zh'
import type { Translations } from './translations'

const ALL: Record<Locale, Translations> = { en, ru, uk, be, zh, es, pl }

/** The keys a registry entry is named by, so a new entry is one row plus its strings (ADR 0078): the type check no
 * longer lists them, this does. */
const NAMED: { group: string; names: (t: Translations) => Readonly<Record<string, string>>; keys: string[] }[] = [
  { group: 'techniques', names: (t) => t.techniques, keys: TECHNIQUES.map(techniqueNameKey) },
  { group: 'formFactors', names: (t) => t.formFactors, keys: BEAD_CATALOG.map((bead) => bead.formFactor.nameKey) },
  {
    group: 'colorNames',
    names: (t) => t.colorNames,
    keys: [...BUILT_IN_COLORS, ...BEAD_CATALOG.flatMap((bead) => bead.brand.colorFamilies ?? [])].map((color) => color.id),
  },
]

describe('registry names (ADR 0078)', () => {
  it('names every Technique, Form factor and Brand color in every language', () => {
    const missing = NAMED.flatMap(({ group, names, keys }) =>
      LOCALES.flatMap((locale) => [...new Set(keys)].filter((key) => !names(ALL[locale])[key]?.trim()).map((key) => `${locale} ${group}.${key}`)),
    )
    expect(missing).toEqual([])
  })

  it('gives every Technique setting its words in every language, and one that can lose beads its question (tickets 0624, 0626)', () => {
    const settings = [...new Map(TECHNIQUES.flatMap((technique) => describeWeave({ technique }).settings).map((setting) => [setting.labelKey, setting])).values()]
    const missing = LOCALES.flatMap((locale) =>
      settings.flatMap(({ labelKey: key, lossOnChange }) => {
        const words = ALL[locale].weaveSettings[key]
        const loss = lossOnChange ? (['title', 'message', 'button'] as const).filter((word) => !words?.loss?.[word].trim()).map((word) => `loss.${word}`) : []
        return [...(['label', 'less', 'more', 'value', 'locked', 'changed'] as const).filter((word) => !words?.[word].trim()), ...loss].map((word) => `${locale} weaveSettings.${key}.${word}`)
      }),
    )
    expect(missing).toEqual([])
  })
})
