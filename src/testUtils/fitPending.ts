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
  // Free account and Pro, and the three plans' heading, show only with Projects saved (ticket 0871).
  { case: 'HomePage with Projects saved', texts: ['Бесплатный аккаунт'], at: { longest: [1900, 1280, 1024, 844, 820, 360, 320] }, fixedBy: '231' },
  { case: 'HomePage with Projects saved', texts: ['Без аккаунта'], at: { longest: [844, 820] }, fixedBy: '231' },
  { case: 'HomePage with Projects saved', texts: ['Три способа работать'], at: { longest: [390, 360, 320] }, fixedBy: '231' },
  // The noun follows the screen (ticket 1183): the Welcome cuff, woven left to right, and the editor's peyote bar say columns.
  { case: 'HomePage', texts: ['Назад на стовпець', 'Columna terminada'], at: { longest: [360, 320] }, fixedBy: '1191' },
  // Misfits on macOS's text rendering, fits on CI's Linux.
  { case: 'HomePage', texts: ['Columna terminada'], at: { longest: [1280] }, fixedBy: '1191', borderline: true },
  { case: 'HomePage', texts: ['Back a column'], at: { en: [320] }, fixedBy: '1191', borderline: true },
  // Only the phone test's page with Projects saved shows the cuff whole at 360px; the fit test's section run doesn't.
  { case: 'HomePage with Projects saved', texts: ['Назад на стовпець', 'Columna terminada'], at: { longest: [360] }, fixedBy: '1191', borderline: true },
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
