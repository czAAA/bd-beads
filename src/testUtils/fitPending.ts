import type { FitLocale } from './longestText'

/** Text that does not fit its box yet, as the browser fit tests find it (tickets 229, 552): the test case, the texts
 * (as the misfit prints them), the widths per language, and the ticket that fixes it. A misfit no entry names fails the
 * test; so does an entry that matches nothing at one of its widths, so that a fix removes its entry. */
export interface FitPending {
  case: string
  texts: string[]
  at: Partial<Record<FitLocale, number[]>>
  fixedBy: string
  /** Off by a pixel or two, so that it fits on one operating system's text rendering and not on the other's: it need not misfit everywhere. */
  borderline?: true
}

export const FIT_PENDING: FitPending[] = [
  { case: 'HomePage', texts: ['Кисть, заливка и ластик, копирование и вставка, отмена лю...', 'Отмечайте готовые ряды и продолжайте с того места, где ос...'], at: { longest: [1900, 1280] }, fixedBy: '231' },
  { case: 'HomePage', texts: ['Ткачество, мозаика, кирпич: каждая рисуется как ложится б...'], at: { longest: [1900, 1280] }, fixedBy: '231' },
  { case: 'HomePage', texts: ['Бесплатный аккаунт'], at: { longest: [1900, 1280, 1024, 844, 820, 390, 360, 320] }, fixedBy: '231' },
  { case: 'HomePage', texts: ['Создать бесплатный аккаунт'], at: { longest: [1024, 844, 820, 390, 360, 320] }, fixedBy: '231' },
  { case: 'HomePage', texts: ['Без аккаунта'], at: { longest: [844, 820, 320] }, fixedBy: '231' },
  { case: 'HomePage', texts: ['Три способа работать'], at: { longest: [390, 360, 320] }, fixedBy: '231' },
]

const quoted = (text: string) => `"${text}"`

/** What is wrong once the pending entries are taken out: misfits nobody listed, and entries that no longer match. */
export function unexplainedFit(name: string, locale: FitLocale, width: number, misfits: string[], pending: FitPending[] = FIT_PENDING): string[] {
  const mine = pending.filter((entry) => entry.case === name && (entry.at[locale] ?? []).includes(width))
  const problems = misfits.filter((misfit) => !mine.some((entry) => entry.texts.some((text) => misfit.includes(quoted(text)))))
  for (const entry of mine.filter((entry) => !entry.borderline)) {
    for (const text of entry.texts.filter((text) => !misfits.some((misfit) => misfit.includes(quoted(text))))) {
      problems.push(`pending entry (fixed by ${entry.fixedBy}) no longer misfits here: ${quoted(text)}; remove ${locale} ${width} from it in src/testUtils/fitPending.ts`)
    }
  }
  return problems
}
