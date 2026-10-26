import { createApp, type Component } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { LOCALES, type Locale } from '../domain/locale'
import { browserDevicePreferences } from '../services/devicePreferences'
import { measureOpenBubble } from './hoverInPage'
import { unexplainedFit } from './fitPending'
import { MEASURE_ARGS, measureTextMisfits, settleForMeasuring, type TextMisfit } from './textFitInPage'

/** Mounting a component in a real browser at a width and in a language, and measuring whether its text fits and its
 * Tooltips stay on screen (tickets 229, 264, 552). Only for `*.browser.test.ts`. */

export type { Locale, TextMisfit }

/** The languages and the widths a component is tried at: the widths are the layout's breakpoint edges, not every device. */
export const FIT_LOCALES: readonly Locale[] = LOCALES
export const FIT_WIDTHS = [1280, 1024, 768, 390, 320] as const
/** From the iPad mini in portrait up there is room to spare, so only the language with the shortest text (English)
 * and the one with the longest (Russian) are tried; below it every language is, as that is where text runs out. */
export const WIDE_FROM = 768
const WIDE_LOCALES: readonly Locale[] = ['en', 'ru']
/** The languages tried at `width`. */
export const localesAt = (width: number): readonly Locale[] => (width >= WIDE_FROM ? WIDE_LOCALES : FIT_LOCALES)
/** The widths `locale` is tried at, widest first. */
export const widthsFor = (locale: Locale): number[] => FIT_WIDTHS.filter((width) => localesAt(width).includes(locale))
/** The narrowest screen is where a Tooltip has least room; a wider one adds nothing it can fail on. */
export const TOOLTIP_WIDTH = 320

export interface Mounted {
  root: HTMLElement
  unmount: () => void
}

/** A phone-ish height: the tests are about width. */
const VIEWPORT_HEIGHT = 800

const mountedNow = new Set<Mounted>()

/** Unmounts what a test left mounted, so a failed assertion cannot leak into the next test. Run after each test by
 * `browserSetup.ts`. */
export function unmountAll(): void {
  for (const mounted of [...mountedNow]) mounted.unmount()
}

/** Mounts `component` into the page at `width` in `locale`. The viewport is the width and a phone-ish height. */
export async function mountAt(component: Component, props: Record<string, unknown>, { locale, width, text = true }: { locale: Locale; width: number; text?: boolean }): Promise<Mounted> {
  // The language is one shared ref, read from storage once: setting storage again would leave the first test's language.
  browserDevicePreferences.get('locale').value = locale
  await resizeTo(width)
  const root = document.createElement('div')
  document.body.append(root)
  const app = createApp(component, props)
  app.mount(root)
  await settleForMeasuring()
  // A test that measures an empty page would pass for nothing.
  if (text && !root.textContent?.trim()) throw new Error('the component rendered no text')
  const mounted: Mounted = {
    root,
    unmount: () => {
      app.unmount()
      root.remove()
      mountedNow.delete(mounted)
    },
  }
  mountedNow.add(mounted)
  return mounted
}

/** Resizes the page to `width` with what is mounted left as it is: a layout answers to the width, so one mount is tried
 * at every width of a language. */
export async function resizeTo(width: number): Promise<void> {
  await page.viewport(width, VIEWPORT_HEIGHT)
  await settleForMeasuring()
  // A test that measures the wrong width would pass for nothing.
  if (window.innerWidth !== width) throw new Error(`the page is ${window.innerWidth}px wide, not ${width}px`)
}

/** Runs `check` at each of `widths` on what is mounted (resizing the page to each), and gathers the problems by width: {} is a pass. */
export async function problemsAcrossWidths(widths: readonly number[], check: (width: number) => Promise<string[]>): Promise<Record<number, string[]>> {
  const found: Record<number, string[]> = {}
  for (const width of widths) {
    if (window.innerWidth !== width) await resizeTo(width)
    const problems = await check(width)
    if (problems.length > 0) found[width] = problems
  }
  return found
}

/** What does not fit on the page now, as lines a failure can print. */
export async function misfitsNow(): Promise<string[]> {
  await settleForMeasuring()
  return measureTextMisfits(MEASURE_ARGS).map((misfit) => `${misfit.problem} ${misfit.element} "${misfit.text}" by ${misfit.pixels}px (${misfit.against})`)
}

/** What is wrong with the page now for this test case, once the entries of `fitPending.ts` are taken out: [] is a pass. */
export async function fitProblems(name: string, locale: Locale, width: number): Promise<string[]> {
  return unexplainedFit(name, locale, width, await misfitsNow())
}

/** The Tooltip's own long-press time (AppTooltip.vue), with a margin. */
const LONG_PRESS_MS = 600

/** A finger held on the Tooltip's trigger past the long-press time; the clock is faked for the wait, as a real half
 * second per Tooltip and language would triple the run. `triggers` all open together. */
export function longPress(...triggers: HTMLElement[]): void {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  try {
    for (const trigger of triggers) trigger.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', isPrimary: true }))
    vi.advanceTimersByTime(LONG_PRESS_MS)
  } finally {
    vi.useRealTimers()
  }
}

/** The ways a person opens a Tooltip, each as what is sent to the trigger to open it and to let it go. */
type Way = 'hover' | 'focus' | 'long press'
const WAYS: [name: Way, open: (trigger: HTMLElement) => void, close: (trigger: HTMLElement) => void][] = [
  ['hover', (trigger) => trigger.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' })), (trigger) => trigger.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }))],
  ['focus', (trigger) => trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true })), (trigger) => trigger.dispatchEvent(new FocusEvent('focusout'))],
  [
    'long press',
    () => {},
    (trigger) => {
      trigger.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch' }))
      trigger.dispatchEvent(new FocusEvent('focusout'))
    },
  ],
]

/** How a Tooltip is opened in `locale`: all three ways in English, hover alone in the rest, as whether it opens does not
 * depend on the language, only how much room its text needs. */
export const waysIn = (locale: Locale): readonly Way[] => (locale === 'en' ? WAYS.map(([way]) => way) : ['hover'])

/** Opens every Tooltip on the page by the given ways, and reports those that are cut off, or
 * do not open. Triggers are found by the page (`.app-tooltip`), so a Tooltip a component adds is checked with no list. */
export async function tooltipProblems(root: HTMLElement, ways: readonly Way[]): Promise<string[]> {
  const triggers = [...root.querySelectorAll<HTMLElement>('.app-tooltip')].filter((trigger) => trigger.getClientRects().length > 0)
  triggers.forEach((trigger, index) => trigger.setAttribute('data-hover-probe', String(index)))
  const problems: string[] = []
  for (const [way, open, close] of WAYS.filter(([way]) => ways.includes(way))) {
    if (way === 'long press') longPress(...triggers)
    else for (const trigger of triggers) open(trigger)
    await vi.waitFor(() => { if (triggers.some((_, index) => !measureOpenBubble(index))) throw new Error('not all open yet') }, { timeout: 1000 }).catch(() => undefined)
    // A hover opens after its delay, and a bubble is placed a tick after it shows.
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => undefined)))
    triggers.forEach((_, index) => {
      const bubble = measureOpenBubble(index)
      const name = triggers[index]!.querySelector('button, a, [role="button"]')?.getAttribute('data-testid') ?? triggers[index]!.textContent?.trim().slice(0, 30)
      if (!bubble) problems.push(`${way}: the Tooltip of ${name} did not open`)
      else for (const cut of bubble.cuts) problems.push(`${way}: the Tooltip of ${name} "${bubble.text}" is cut by ${cut.pixels}px (${cut.against})`)
    })
    for (const trigger of triggers) close(trigger)
  }
  return problems
}

/** One component to try: its name (as `fitPending.ts` knows it), props, and what a person does to it before the
 * check (expand a panel, open a list). */
export type FitCase = [name: string, component: Component, props: Record<string, unknown>, act?: (root: HTMLElement) => Promise<void> | void]

/** One test per language for each component: it is mounted once and tried at every width of the language (`widthsFor`),
 * and must fit its box at each, bar what `fitPending.ts` lists. */
export function describeFits(cases: FitCase[]): void {
  describe.each(cases)('%s text fit', (name, component, props, act) => {
    for (const locale of FIT_LOCALES) {
      const widths = widthsFor(locale)
      it(`fits its box in ${locale} at ${widths.join(', ')}px`, async () => {
        const mounted = await mountAt(component, props, { locale, width: widths[0]! })
        if (act) {
          await act(mounted.root)
          await settleForMeasuring()
        }
        const found = await problemsAcrossWidths(widths, async (width) => [
          // Where a Tooltip has least room; opening each in every language and width would add nothing a Tooltip can fail on.
          ...(width === TOOLTIP_WIDTH ? unexplainedFit(`${name} Tooltips`, locale, width, await tooltipProblems(mounted.root, waysIn(locale))).map((problem) => `hover text: ${problem}`) : []),
          ...(await fitProblems(name, locale, width)),
        ])
        expect(found).toEqual({})
      })
    }
  })
}
