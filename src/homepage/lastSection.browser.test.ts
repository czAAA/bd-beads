import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { mountAt, unmountAll, type Mounted } from '../testUtils/browserFit'
import { fakeFeedback } from '../testUtils/fakeFeedback'
import { turnToSection } from '../testUtils/homepageSection'
import { settleForMeasuring } from '../testUtils/textFitInPage'
import HomePage from './HomePage.vue'
import { FOOT_ROOM } from './freeGrowth'

// The Homepage's last section fills its room off a phone (ticket 1060): a new visitor's Free to use on a plain ground,
// centred in the room's height; with Projects, No account's list starting with as many whole rows as fit, at least four.
const SIZES = [[1440, 900], [1920, 1080], [2560, 1440]] as const

afterEach(() => {
  unmountAll()
  localStorage.clear()
})

async function viewport(width: number, height: number) {
  await page.viewport(width, height)
  await settleForMeasuring()
}

async function plansAt(projectCount: number, width: number, height: number): Promise<Mounted> {
  const mounted = await mountAt(HomePage, { projectCount, feedback: fakeFeedback() }, { locale: 'en', width })
  await viewport(width, height)
  await turnToSection(mounted.root, 'plans')
  return mounted
}

const section = (root: Element) => root.querySelector<HTMLElement>('[data-testid="homepage-section-plans"]')!
/** The section's zoom (the Homepage's zoom × its scale): the page measures in screen px, the room in its own. */
const zoomOf = (root: Element) => Number(root.querySelector<HTMLElement>('.homepage__page')!.style.zoom || 1)

/** How the free list starts: the rows wholly shown in its window, every row, and whether the tile's foot is clear. */
function freeStart(root: Element) {
  const shown = root.querySelector<HTMLElement>('[data-testid="free-window"]')!
  const rows = [...shown.querySelectorAll('li')]
  const window = shown.getBoundingClientRect()
  const whole = rows.filter((row) => row.getBoundingClientRect().bottom <= window.bottom + 0.5).length
  const room = section(root).getBoundingClientRect()
  const tile = root.querySelector('[data-testid="plan-no-account"]')!.getBoundingClientRect()
  const footRoom = (room.bottom - tile.bottom) / zoomOf(root)
  const next = rows[whole]?.getBoundingClientRect()
  /** Whether the next row would have fitted too, its foot still clear of the room kept at the foot. */
  const nextFits = !!next && (room.bottom - (tile.bottom + next.bottom - window.bottom)) / zoomOf(root) >= FOOT_ROOM - 0.5
  return { whole, rows: rows.length, footRoom, nextFits, fading: shown.classList.contains('plan__free--fading') }
}

describe('A new visitor\'s Free to use (ticket 1060)', () => {
  for (const [width, height] of SIZES) {
    it(`stands on a plain ground, centred in the room's height, at ${width} × ${height}`, async () => {
      const mounted = await plansAt(0, width, height)
      const lead = mounted.root.querySelector<HTMLElement>('.free-to-use__lead')!
      const list = mounted.root.querySelector<HTMLElement>('.free-to-use__list')!
      const ground = (el: HTMLElement) => {
        const style = getComputedStyle(el)
        return [style.backgroundColor, style.borderTopColor, style.borderTopWidth, style.borderTopLeftRadius]
      }
      expect(ground(lead), 'the lead on the list\'s ground').toEqual(ground(list))
      expect(getComputedStyle(lead).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
      for (const selector of ['#homepage-plans', '.free-to-use__price', '.free-to-use__text', '[data-testid="free-to-use-way-in"]']) {
        expect(lead.contains(mounted.root.querySelector(selector)), `${selector} on the ground`).toBe(true)
      }
      const room = section(mounted.root)
      const box = room.getBoundingClientRect()
      const piece = mounted.root.querySelector('[data-testid="free-to-use"]')!.getBoundingClientRect()
      const padding = (side: 'paddingTop' | 'paddingBottom') => Number.parseFloat(getComputedStyle(room)[side]) * zoomOf(mounted.root)
      const above = piece.top - box.top - padding('paddingTop')
      const below = box.bottom - piece.bottom - padding('paddingBottom')
      expect(room.scrollHeight, 'it fits').toBeLessThanOrEqual(room.clientHeight + 1)
      expect(above, 'room above it').toBeGreaterThan(8)
      expect(Math.abs(above - below), 'as much room above as below').toBeLessThanOrEqual(2)
      expect(lead.getBoundingClientRect().height, 'the two grounds as tall').toBeCloseTo(list.getBoundingClientRect().height, 0)
    }, 30000)
  }

  it('starts at the room\'s top where it is taller than the room, and keeps its ground stacked under a 960px box', async () => {
    const mounted = await plansAt(0, 800, 600)
    const room = section(mounted.root)
    expect(room.scrollHeight, 'taller than its room here').toBeGreaterThan(room.clientHeight)
    const piece = mounted.root.querySelector('[data-testid="free-to-use"]')!.getBoundingClientRect()
    const padding = Number.parseFloat(getComputedStyle(room).paddingTop) * zoomOf(mounted.root)
    expect(piece.top - room.getBoundingClientRect().top).toBeCloseTo(padding, 0)
    const lead = mounted.root.querySelector<HTMLElement>('.free-to-use__lead')!
    const list = mounted.root.querySelector<HTMLElement>('.free-to-use__list')!
    expect(lead.getBoundingClientRect().bottom, 'stacked').toBeLessThanOrEqual(list.getBoundingClientRect().top)
    expect(getComputedStyle(lead).backgroundColor).toBe(getComputedStyle(list).backgroundColor)
    expect(lead.scrollWidth, 'nothing cut').toBeLessThanOrEqual(lead.clientWidth + 1)
  }, 30000)
})

describe('With Projects, No account\'s list starts with the rows that fit (ticket 1060)', () => {
  for (const [width, height] of SIZES) {
    it(`at ${width} × ${height}: whole rows, at least four, the foot clear`, async () => {
      const mounted = await plansAt(3, width, height)
      const start = freeStart(mounted.root)
      // At each of these sizes the list is cut: more than four rows fit, and fewer than all of them.
      expect(start.whole).toBeGreaterThan(4)
      expect(start.whole).toBeLessThan(start.rows)
      expect(start.nextFits, 'not one row more would have fitted').toBe(false)
      expect(start.fading).toBe(true)
      expect(start.footRoom, 'the room at the foot kept').toBeGreaterThanOrEqual(FOOT_ROOM - 1)
    }, 30000)
  }

  it('grows from there as the section scrolls, and back', async () => {
    const mounted = await plansAt(3, 1920, 1080)
    const room = section(mounted.root)
    const shown = () => mounted.root.querySelector<HTMLElement>('[data-testid="free-window"]')!.getBoundingClientRect().height
    const atStart = shown()
    room.scrollTop = 80
    room.dispatchEvent(new Event('scroll'))
    await settleForMeasuring()
    expect(shown()).toBeGreaterThan(atStart)
    room.scrollTop = 0
    room.dispatchEvent(new Event('scroll'))
    await settleForMeasuring()
    expect(shown()).toBeCloseTo(atStart, 0)
  }, 30000)

  it('sets the starting rows again as the window is resized and the zoom changes', async () => {
    const mounted = await plansAt(3, 1920, 1080)
    const large = freeStart(mounted.root).whole
    await viewport(1440, 800)
    const small = freeStart(mounted.root).whole
    expect(small).toBeLessThan(large)
    expect(freeStart(mounted.root).nextFits).toBe(false)
    mounted.root.querySelector<HTMLElement>('[data-testid="zoom-in"]')!.click()
    await settleForMeasuring()
    const zoomed = freeStart(mounted.root)
    expect(zoomed.whole).toBeGreaterThanOrEqual(4)
    expect(zoomed.whole).toBeLessThanOrEqual(small)
    expect(zoomed.nextFits).toBe(false)
    await viewport(1920, 1080)
    mounted.root.querySelector<HTMLElement>('[data-testid="zoom-reset"]')!.click()
    await settleForMeasuring()
    expect(freeStart(mounted.root).whole).toBe(large)
  }, 30000)
})
