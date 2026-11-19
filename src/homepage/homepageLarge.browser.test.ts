import { afterEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { mountAt, unmountAll, type FitLocale } from '../testUtils/browserFit'
import { settleForMeasuring } from '../testUtils/textFitInPage'
import { turnToSection } from '../testUtils/homepageSection'
import { fakeFeedback } from '../testUtils/fakeFeedback'
import HomePage from './HomePage.vue'

// On a screen past 1440 × 900 the box and its sections grow (ticket 1059): the layout that fits whole at 1440 × 900,
// bigger, up to a third; the Canvas strip and the Progress bar keep the editor's size.
const LOCALES: readonly FitLocale[] = ['en', 'ru', 'uk', 'be', 'zh', 'es', 'pl']
const SECTIONS = ['welcome', 'inside', 'coffee', 'plans'] as const
const LARGE = [[1920, 1080], [2560, 1440]] as const

afterEach(() => {
  vi.useRealTimers()
  unmountAll()
  localStorage.clear()
})

function sizeOf(root: Element, selector: string): DOMRect {
  return root.querySelector(selector)!.getBoundingClientRect()
}

/** The strip's and the Progress bar's heights, which never grow. */
function barsOf(root: Element): [number, number] {
  return [sizeOf(root, '[data-testid="canvas-strip"]').height, root.querySelector('[data-testid="section-step"]')!.closest('.step-bar')!.getBoundingClientRect().height]
}

/** Which sections fit whole, with nothing wider than the box, at the viewport's size now. */
async function fitting(root: HTMLElement): Promise<string[]> {
  const fit: string[] = []
  for (const id of SECTIONS) {
    await turnToSection(root, id)
    const section = root.querySelector<HTMLElement>(`[data-testid="homepage-section-${id}"]`)!
    expect(section.scrollWidth, `${id} scrolls sideways`).toBeLessThanOrEqual(section.clientWidth + 1)
    if (section.scrollHeight <= section.clientHeight + 1) fit.push(id)
  }
  return fit
}

async function viewport(width: number, height: number) {
  await page.viewport(width, height)
  await settleForMeasuring()
}

describe('On a large screen the box grows (ticket 1059)', () => {
  it('takes about three quarters of 1920 × 1080, about 60% of 2560 × 1440, and grows at 1728 × 1117 too', async () => {
    const mounted = await mountAt(HomePage, { projectCount: 0, feedback: fakeFeedback() }, { locale: 'en', width: 1440 })
    const share = () => {
      const box = sizeOf(mounted.root, '[data-testid="homepage"]')
      return (box.width * box.height) / (window.innerWidth * window.innerHeight)
    }
    await viewport(1440, 900)
    const fitBox = sizeOf(mounted.root, '[data-testid="homepage"]')
    const bars = barsOf(mounted.root)
    await viewport(1728, 1117)
    expect(sizeOf(mounted.root, '[data-testid="homepage"]').width).toBeGreaterThan(fitBox.width * 1.15)
    // Resizing regrows the box at once, with no reload.
    await viewport(1920, 1080)
    expect(share()).toBeGreaterThan(0.7)
    expect(share()).toBeLessThan(0.8)
    await viewport(2560, 1440)
    expect(share()).toBeGreaterThan(0.55)
    expect(share()).toBeLessThan(0.65)
    expect(barsOf(mounted.root), 'the strip and the bar keep their size').toEqual(bars)
    await viewport(1440, 900)
    expect(sizeOf(mounted.root, '[data-testid="homepage"]').toJSON()).toEqual(fitBox.toJSON())
  })

  it('reads 100% at Fit, zooms from the grown size, and keeps a zoom saved before', async () => {
    localStorage.setItem('openbeads:homepage-zoom', '110')
    const mounted = await mountAt(HomePage, { projectCount: 0, feedback: fakeFeedback() }, { locale: 'en', width: 1920 })
    await viewport(1920, 1080)
    const zoom = mounted.root.querySelector<HTMLElement>('[data-testid="canvas-strip-zoom"]')!
    const page = mounted.root.querySelector<HTMLElement>('.homepage__page')!
    expect(zoom.dataset.zoomPercent).toBe('110')
    expect(Number(page.style.zoom)).toBeCloseTo(1.1 * 1.2)
    mounted.root.querySelector<HTMLElement>('[data-testid="zoom-reset"]')!.click()
    await settleForMeasuring()
    expect(zoom.dataset.zoomPercent).toBe('100')
    expect(Number(page.style.zoom)).toBeCloseTo(1.2)
    mounted.root.querySelector<HTMLElement>('[data-testid="zoom-out"]')!.click()
    await settleForMeasuring()
    expect(zoom.dataset.zoomPercent).toBe('90')
    expect(Number(page.style.zoom)).toBeCloseTo(0.9 * 1.2)
  })

  it('keeps the two marks by the box\'s edge', async () => {
    // Out of the Winter charms' season, which has marks of its own (ticket 1102).
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-19T12:00:00') })
    const mounted = await mountAt(HomePage, { projectCount: 0, feedback: fakeFeedback() }, { locale: 'en', width: 1440 })
    const gaps = () => {
      const box = sizeOf(mounted.root, '[data-testid="homepage"]')
      const [large, small] = [...mounted.root.querySelectorAll('[data-testid="homepage-mark"]')].map((mark) => mark.getBoundingClientRect())
      return [Math.round(box.left - large!.left), Math.round(small!.right - box.right)]
    }
    await viewport(1440, 900)
    const atFit = gaps()
    for (const [width, height] of LARGE) {
      await viewport(width, height)
      expect(gaps(), `at ${width} × ${height}`).toEqual(atFit)
    }
  })

  for (const projectCount of [0, 3]) {
    for (const locale of LOCALES) {
      it(`fits what fits at 1440 × 900, ${projectCount ? 'with Projects' : 'a new visitor'}, ${locale}`, async () => {
        const mounted = await mountAt(HomePage, { projectCount, feedback: fakeFeedback() }, { locale, width: 1440 })
        await viewport(1440, 900)
        const atFit = await fitting(mounted.root)
        for (const [width, height] of LARGE) {
          await viewport(width, height)
          expect(await fitting(mounted.root), `at ${width} × ${height}`).toEqual(expect.arrayContaining(atFit))
        }
      }, 60000)
    }
  }
})
