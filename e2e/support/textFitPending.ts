import { TOUR_ENABLED } from '../../src/features'
import type { TextMisfit } from './textFit'

// Text that does not fit its box yet (ticket 229): `screen`, `texts` (or 'any'), widths per language, `fixedBy`
// (ticket that deletes it; 'unassigned' = overflows in English). The check fails on a misfit no entry names and on an
// entry matching nothing at one of its widths. Empty list = strict.
export interface PendingEntry {
  screen: string
  texts: string[] | 'any'
  at: Partial<Record<string, number[]>>
  fixedBy: string
}

const ALL_PENDING: PendingEntry[] = [
  { screen: 'Overview', texts: ['Ткачество, мозаика, кирпич: каждая рисуется как ложится б...'], at: { ru: [1900, 1280, 1024] }, fixedBy: '231' },
  { screen: 'Overview', texts: ['Бесплатный аккаунт'], at: { ru: [1900, 1280, 1024, 844, 820, 768, 390, 360, 320] }, fixedBy: '231' },
  { screen: 'Overview', texts: ['Создать бесплатный аккаунт'], at: { ru: [1024, 844, 820, 768, 320] }, fixedBy: '231' },
  { screen: 'Overview', texts: ['Без аккаунта'], at: { ru: [820, 768] }, fixedBy: '231' },
  { screen: 'Overview', texts: ['Три способа работать'], at: { ru: [390, 360, 320] }, fixedBy: '231' },
  { screen: 'Overview', texts: ['Конвертировать изображение'], at: { ru: [360, 320] }, fixedBy: '231' },
  { screen: 'Overview carousel', texts: ['Кисть, заливка и ластик, копирование и вставка, отмена лю...', 'Отмечайте готовые ряды и продолжайте с того места, где ос...', 'Ткачество'], at: { ru: [1900, 1280, 1024] }, fixedBy: '231' },
  { screen: 'Tour', texts: ['Увеличить', 'Сотрите лишнюю бисеринку'], at: { ru: [320] }, fixedBy: '231' },
  // Saved Projects is reachable at every width only from ticket 385 on (the Dock's own nested sheet, not the Toolbox's
  // always-wide column); its "Export all" button is narrower there in some languages than the Toolbox ever gave it.
  { screen: 'Saved Projects expanded', texts: 'any', at: { ru: [390, 360, 320], uk: [320], be: [320], pl: [320] }, fixedBy: 'unassigned' },
]

/** The Tour's entries wait while it is switched off (ticket 247): its screen isn't visited, so they would read as
 * stale. */
export const PENDING = ALL_PENDING.filter((entry) => TOUR_ENABLED || entry.screen !== 'Tour')

export type Found = TextMisfit & { screen: string }

const screenName = (screen: string): string => screen.replace(/ \(.*\)$/, '')

const covers = (entry: PendingEntry, locale: string, width: number, found: Found): boolean =>
  entry.screen === screenName(found.screen) &&
  (entry.at[locale] ?? []).includes(width) &&
  (entry.texts === 'any' || entry.texts.includes(found.text))

/** What is wrong at this language and width once the pending entries are taken out: misfits nobody listed, and
 * entries that no longer match. */
export function unexplained(locale: string, width: number, found: Found[], pending: PendingEntry[] = PENDING): string[] {
  const problems = found
    .filter((misfit) => !pending.some((entry) => covers(entry, locale, width, misfit)))
    .map((f) => `${f.screen}: ${f.problem} ${f.element} "${f.text}" by ${f.pixels}px (${f.against})`)
  for (const entry of pending) {
    if (!(entry.at[locale] ?? []).includes(width)) continue
    // Each listed text must still overflow on its own; a whole-screen entry needs at least one misfit.
    const stale = entry.texts === 'any' ? (found.some((misfit) => covers(entry, locale, width, misfit)) ? [] : ['any']) : entry.texts.filter((text) => !found.some((misfit) => covers(entry, locale, width, misfit) && misfit.text === text))
    for (const text of stale) {
      problems.push(`${entry.screen}: pending entry (fixed by ${entry.fixedBy}) no longer overflows here (${text === 'any' ? 'whole screen' : `"${text}"`}); remove ${locale} ${width} from it in e2e/support/textFitPending.ts`)
    }
  }
  return problems
}
