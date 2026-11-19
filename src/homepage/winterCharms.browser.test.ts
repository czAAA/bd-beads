import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { mountAt, unmountAll } from '../testUtils/browserFit'
import { settleForMeasuring } from '../testUtils/textFitInPage'
import { fakeFeedback } from '../testUtils/fakeFeedback'
import HomePage from './HomePage.vue'

// The Winter charms on real screens (Homepage card, tickets 1102, 1109): the ten each whole on the black, clear of the
// box and the screen's edge, wherever there is room; where there isn't, a few small ones across the box's edge; none, but
// the three marks, on a phone.
/** `--winter-charm-clear` and `--winter-charm-drift`, 16px each: a charm keeps both off the top and bottom. */
const CLEAR = 16
const DRIFT = 16
/** `--winter-charm-edge-clear` and `--winter-charm-reach`, in rem: a small charm's room, 6px off the screen's edge to
 * 10px over the box's at a 16px root. */
const EDGE_CLEAR_REM = 0.375
const REACH_REM = 0.625

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

  for (const [width, height] of [[1440, 900], [1366, 1024], [1180, 820], [1024, 768], [820, 1180], [1024, 1366]] as const) {
    it(`lay three to five small charms across the box's edge at ${width} × ${height}, off its content, strip and bar`, async () => {
      const root = await homepageAt(width, height)
      const box = root.querySelector('[data-testid="homepage"]')!.getBoundingClientRect()
      const drawing = root.querySelector('[data-testid="homepage-body"]')!.getBoundingClientRect()
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
      const [EDGE_CLEAR, REACH] = [EDGE_CLEAR_REM * rem, REACH_REM * rem]
      const charms = [...root.querySelectorAll<HTMLElement>('[data-testid="winter-charm"]')]
      expect(charms.length).toBeGreaterThanOrEqual(3)
      expect(charms.length).toBeLessThanOrEqual(5)
      for (const charm of charms) {
        const at = charm.getBoundingClientRect()
        const name = `${charm.dataset.charm} at ${width} × ${height}`
        const left = at.left < box.left
        expect(left ? at.left : width - at.right, name).toBeGreaterThanOrEqual(EDGE_CLEAR - 1)
        expect(left ? at.right - box.left : box.right - at.left, name).toBeLessThanOrEqual(REACH + 1)
        expect(at.top - drawing.top, name).toBeGreaterThanOrEqual(EDGE_CLEAR - 1)
        expect(drawing.bottom - at.bottom, name).toBeGreaterThanOrEqual(EDGE_CLEAR - 1)
      }
    })
  }

  it('hide the small charms while the Menu is open', async () => {
    const root = await homepageAt(1180, 820)
    const charm = root.querySelector<HTMLElement>('[data-testid="winter-charm"]')!
    expect(getComputedStyle(charm).visibility).toBe('visible')
    root.querySelector<HTMLElement>('[data-testid="strip-menu"]')!.click()
    await vi.waitFor(() => expect(getComputedStyle(charm).visibility).toBe('hidden'))
  })

  it('leave only the three marks on a phone, 390 × 844', async () => {
    const root = await homepageAt(390, 844)
    expect(root.querySelectorAll('[data-testid="winter-charm"]')).toHaveLength(0)
  })
})
