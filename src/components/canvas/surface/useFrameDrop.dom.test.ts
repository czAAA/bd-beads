import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { useFrameDrop } from './useFrameDrop'

// Remove frame's drop (ticket 1189): a copy of the Frame's surface fades off the beads it leaves, once per confirmation.

function setup() {
  const drops = ref(0)
  const layer = document.createElement('canvas')
  const copy = ref(document.createElement('canvas'))
  const drop = effectScope().run(() => useFrameDrop({ drops: () => drops.value, layers: () => [layer], copy, style: () => ({ transform: 'rotate(10deg)' }) }))!
  return { drops, drop }
}

describe('useFrameDrop', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('shows a copy where the Frame lay as a drop comes, fades it, then hides it', () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (step: FrameRequestCallback) => setTimeout(() => step(0), 16))
    const { drops, drop } = setup()
    drops.value += 1
    expect(drop.dropping.value).toBe(true)
    expect(drop.opacity.value).toBe(1)
    expect(drop.style.value).toEqual({ transform: 'rotate(10deg)' })
    vi.advanceTimersByTime(20)
    expect(drop.opacity.value).toBe(0)
    vi.advanceTimersByTime(250)
    expect(drop.dropping.value).toBe(false)
  })

  it('plays nothing under reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const { drops, drop } = setup()
    drops.value += 1
    expect(drop.dropping.value).toBe(false)
  })
})
