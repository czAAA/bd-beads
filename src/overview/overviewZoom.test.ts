import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOverviewZoom } from './overviewZoom'

beforeEach(() => localStorage.clear())

describe('useOverviewZoom', () => {
  it('starts at 100% and walks the editor\'s 10% steps between 75% and 200%', () => {
    const zoom = useOverviewZoom()
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
    const zoom = useOverviewZoom()
    zoom.zoomIn()
    zoom.reset()

    expect(zoom.percent.value).toBe(100)
  })

  it('is remembered on the device', () => {
    useOverviewZoom().zoomIn()

    expect(useOverviewZoom().percent.value).toBe(110)
  })

  it('ignores a stored value it cannot read, and works with no storage', () => {
    localStorage.setItem('openbeads:overview-zoom', 'wide')
    expect(useOverviewZoom().percent.value).toBe(100)

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const zoom = useOverviewZoom()
    zoom.zoomIn()
    expect(zoom.percent.value).toBe(110)
    vi.restoreAllMocks()
  })
})
