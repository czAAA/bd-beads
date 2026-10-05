import { TOUR_ENABLED } from '../../src/features'
import type { TextMisfit } from './textFit'

/**
 * The text that does not fit its box yet (ticket 229), so that the check can land green and then guard what is fixed.
 * Each entry says where (the screen's name, as in textFit.spec.ts, up to any " (detail)"), which texts (the text as the
 * check reports it, or 'any' for a whole screen), and at which widths in which language it is known to overflow.
 * `fixedBy` names the ticket that deletes the entry: '231' for Russian-only layout fixes, 'unassigned' for places that
 * overflow in English too (nobody owns those yet).
 *
 * The check fails on a misfit that no entry names, and on an entry that no longer matches anything at one of its
 * widths: a fixed place must be deleted from here. When the list is empty the check is strict.
 */
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
  { screen: 'Saved Projects expanded', texts: ['Экспортировать все'], at: { ru: [1024] }, fixedBy: '231' },
  { screen: 'Tour', texts: ['Увеличить', 'Сотрите лишнюю бисеринку'], at: { ru: [320] }, fixedBy: '231' },
]

/** The Tour's entries wait while it is switched off (ticket 247): its screen isn't visited, so they would read as stale. */
export const PENDING = ALL_PENDING.filter((entry) => TOUR_ENABLED || entry.screen !== 'Tour')

export type Found = TextMisfit & { screen: string }

const screenName = (screen: string): string => screen.replace(/ \(.*\)$/, '')

const covers = (entry: PendingEntry, locale: string, width: number, found: Found): boolean =>
  entry.screen === screenName(found.screen) &&
  (entry.at[locale] ?? []).includes(width) &&
  (entry.texts === 'any' || entry.texts.includes(found.text))

/** What is wrong at this language and width once the pending entries are taken out: misfits nobody listed, and entries that no longer match. */
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
