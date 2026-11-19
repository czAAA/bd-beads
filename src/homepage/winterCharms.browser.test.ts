import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { mountAt, unmountAll } from '../testUtils/browserFit'
import { settleForMeasuring } from '../testUtils/textFitInPage'
import { fakeFeedback } from '../testUtils/fakeFeedback'
import HomePage from './HomePage.vue'

// The Winter charms on real screens (Homepage card, ticket 1102): each whole on the black, clear of the box and the
// screen's edge, wherever there is room; none, but the three marks, where there isn't.
/** `--winter-charm-clear` and `--winter-charm-drift`, 16px each: a charm keeps both off the top and bottom. */
const CLEAR = 16
const DRIFT = 16

beforeEach(() => void vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-12-20T12:00:00') }))
afterEach(() => {
  vi.useRealTimers()
  unmountAll()
  localStorage.clear()
})

/** Mounts the Homepage on a `width` × `height` screen and waits for the charms, placed after the first paint. */
async function homepageAt(width: number, height: number): Promise<HTMLElement> {
  const mounted = await mountAt(HomePage, { projectCount: 0, feedback: fakeFeedback() }, { locale: 'en', width })
  await page.viewport(width, height)
  await settleForMeasuring()
  await vi.waitFor(() => expect(mounted.root.querySelectorAll('[data-testid="winter-mark"]')).toHaveLength(3))
  return mounted.root
}

describe('Winter charms', () => {
  for (const [width, height] of [[1536, 864], [1920, 1080], [2560, 1440]] as const) {
    it(`lie whole on the black at ${width} × ${height}, clear of the box and the screen's edge`, async () => {
      const root = await homepageAt(width, height)
      const box = root.querySelector('[data-testid="homepage"]')!.getBoundingClientRect()
      const charms = [...root.querySelectorAll<HTMLElement>('[data-testid="winter-charm"]')]
      expect(charms).toHaveLength(10)
      for (const charm of charms) {
        const at = charm.getBoundingClientRect()
        const name = `${charm.dataset.charm} at ${width} × ${height}`
        const [inner, outer] = at.right <= box.left ? [box.left - at.right, at.left] : [at.left - box.right, width - at.right]
        expect(Math.min(inner, outer), name).toBeGreaterThanOrEqual(CLEAR - 1)
        expect(Math.min(at.top, height - at.bottom), name).toBeGreaterThanOrEqual(CLEAR + DRIFT - 1)
      }
    })
  }

  for (const [width, height] of [[1440, 900], [1680, 1050], [1180, 820], [390, 844]] as const) {
    it(`leave only the three marks where the black beside the box is narrow, ${width} × ${height}`, async () => {
      const root = await homepageAt(width, height)
      expect(root.querySelectorAll('[data-testid="winter-charm"]')).toHaveLength(0)
    })
  }
})
