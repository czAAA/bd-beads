import { beforeEach, describe, expect, it, vi } from 'vitest'
import { homepageScale, useHomepageZoom } from './homepageZoom'

beforeEach(() => localStorage.clear())

describe('useHomepageZoom', () => {
  it('starts at 100% and walks the editor\'s 10% steps between 75% and 200%', () => {
    const zoom = useHomepageZoom()
    expect(zoom.percent.value).toBe(100)

    zoom.zoomOut()
    zoom.zoomOut()
    zoom.zoomOut()
    expect(zoom.percent.value).toBe(75)
    zoom.zoomIn()
    expect(zoom.percent.value).toBe(80)

    for (let i = 0; i < 20; i++) zoom.zoomIn()
    expect(zoom.percent.value).toBe(200)
  })

  it('resets to 100% with Fit', () => {
    const zoom = useHomepageZoom()
    zoom.zoomIn()
    zoom.reset()

    expect(zoom.percent.value).toBe(100)
  })

  it('is remembered on the device', () => {
    useHomepageZoom().zoomIn()

    expect(useHomepageZoom().percent.value).toBe(110)
  })

  it('ignores a stored value it cannot read, and works with no storage', () => {
    localStorage.setItem('openbeads:homepage-zoom', 'wide')
    expect(useHomepageZoom().percent.value).toBe(100)

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const zoom = useHomepageZoom()
    zoom.zoomIn()
    expect(zoom.percent.value).toBe(110)
    vi.restoreAllMocks()
  })
})

// A screen past 1440 × 900 grows the box and its sections (ticket 1059): by the smaller of its width and height against
// that screen's, never under 1 and never more than a third.
describe('homepageScale', () => {
  it('leaves 1440 × 900 and anything under it as it is', () => {
    expect(homepageScale(1440, 900)).toBe(1)
    expect(homepageScale(1280, 800)).toBe(1)
    expect(homepageScale(1366, 1024)).toBe(1)
    expect(homepageScale(390, 844)).toBe(1)
  })

  it('grows past it, by the height where it is the smaller', () => {
    expect(homepageScale(1920, 1080)).toBeCloseTo(1.2)
    expect(homepageScale(1728, 1117)).toBeCloseTo(1.2)
  })

  it('grows by the width where it is the smaller', () => {
    expect(homepageScale(1584, 1400)).toBeCloseTo(1.1)
  })

  it('stays at 1 where only one of the two is larger', () => {
    expect(homepageScale(2560, 900)).toBe(1)
    expect(homepageScale(1440, 1600)).toBe(1)
  })

  it('grows a third at most', () => {
    expect(homepageScale(2560, 1440)).toBeCloseTo(4 / 3)
    expect(homepageScale(3840, 2160)).toBeCloseTo(4 / 3)
  })

  it('is 1 for a window with no size yet', () => {
    expect(homepageScale(0, 0)).toBe(1)
    expect(homepageScale(Number.NaN, 900)).toBe(1)
  })
})
