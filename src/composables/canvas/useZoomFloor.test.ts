import { afterEach, describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useZoomFloor } from './useZoomFloor'

describe('useZoomFloor', () => {
  it('is 16px of a 20px bead at the phone tier and 15px from the iPad mini tier up', () => {
    const width = ref(743)
    const floor = useZoomFloor(width)
    expect(floor.value).toBe(0.8)

    width.value = 744
    expect(floor.value).toBe(0.75)
    width.value = 1920
    expect(floor.value).toBe(0.75)
  })

  describe('reads the bead-min token of the current tier', () => {
    const root = document.documentElement
    afterEach(() => {
      for (const tier of ['phone', 'tablet', 'tablet-lg', 'laptop', 'desktop']) root.style.removeProperty(`--bead-min-${tier}`)
    })

    it.each([
      [320, 'phone', 0.8],
      [743, 'phone', 0.8],
      [744, 'tablet', 0.7],
      [1023, 'tablet', 0.7],
      [1024, 'tablet-lg', 0.9],
      [1279, 'tablet-lg', 0.9],
      [1280, 'laptop', 1],
      [1919, 'laptop', 1],
      [1920, 'desktop', 1.11],
    ])('at %ipx it is the %s token', (viewport, _tier, floor) => {
      root.style.setProperty('--bead-min-phone', '16px')
      root.style.setProperty('--bead-min-tablet', '14px')
      root.style.setProperty('--bead-min-tablet-lg', '18px')
      root.style.setProperty('--bead-min-laptop', '20px')
      root.style.setProperty('--bead-min-desktop', '22px')
      expect(useZoomFloor(ref(viewport)).value).toBe(floor)
    })
  })
})
