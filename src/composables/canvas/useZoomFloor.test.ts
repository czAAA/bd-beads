import { describe, expect, it } from 'vitest'
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
})
