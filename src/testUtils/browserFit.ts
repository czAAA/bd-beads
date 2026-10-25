import { createApp, type Component } from 'vue'
import { page } from 'vitest/browser'
import { LOCALES, type Locale } from '../domain/locale'
import { MEASURE_ARGS, measureTextMisfits, settleForMeasuring, type TextMisfit } from './textFitInPage'

/** Mounting a component in a real browser at a width and in a language, and measuring it with the same check the e2e
 * runs on the whole app (tickets 229, 552). Only for `*.browser.test.ts`. */

export type { Locale, TextMisfit }

/** The languages and the widths a component is tried at: the widths are the layout's breakpoint edges, not every device. */
export const FIT_LOCALES: readonly Locale[] = LOCALES
export const FIT_WIDTHS = [1280, 1024, 768, 390, 320] as const

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
  localStorage.setItem('openbeads:locale', locale)
  await page.viewport(width, VIEWPORT_HEIGHT)
  const root = document.createElement('div')
  document.body.append(root)
  const app = createApp(component, props)
  app.mount(root)
  await settleForMeasuring()
  // A test that measures an empty page or the wrong width would pass for nothing.
  if (window.innerWidth !== width) throw new Error(`the page is ${window.innerWidth}px wide, not ${width}px`)
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

/** What does not fit on the page now, as lines a failure can print. */
export async function misfitsNow(): Promise<string[]> {
  await settleForMeasuring()
  return measureTextMisfits(MEASURE_ARGS).map((misfit) => `${misfit.problem} ${misfit.element} "${misfit.text}" by ${misfit.pixels}px (${misfit.against})`)
}
