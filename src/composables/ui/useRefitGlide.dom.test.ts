import { afterEach, describe, expect, it, vi } from 'vitest'
import { useRefitGlide } from './useRefitGlide'

/** A box that stands at `at` until the refit, then at `moved`, with `animate` recorded. */
function box(at: Partial<DOMRect>, moved: Partial<DOMRect>) {
  const element = document.createElement('div')
  document.body.append(element)
  let place = at
  element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0, ...place }) as DOMRect
  const animate = vi.fn(() => ({ cancel: vi.fn(), onfinish: null }) as unknown as Animation)
  element.animate = animate
  return { element, animate, refit: () => (place = moved), moved: () => place === moved }
}

const reducedMotion = (reduce: boolean) => vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduce && query.includes('reduce') }))

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('useRefitGlide', () => {
  it('glides a box from where it stood to where the refit puts it, by transform from its top-left corner', async () => {
    reducedMotion(false)
    const beads = box({ left: 40, top: 100, width: 900 }, { left: 40, top: 200, width: 450 })
    await useRefitGlide(() => [beads.element])(beads.refit)

    expect(beads.animate).toHaveBeenCalledOnce()
    const [frames, timing] = beads.animate.mock.calls[0] as unknown as [Keyframe[], KeyframeAnimationOptions]
    expect(frames).toEqual([
      { transformOrigin: '0 0', transform: 'translate(0px, -100px) scale(2)' },
      { transformOrigin: '0 0', transform: 'none' },
    ])
    expect(timing.duration).toBeGreaterThan(0)
  })

  it('jumps under reduced motion', async () => {
    reducedMotion(true)
    const beads = box({ left: 40, width: 900 }, { left: 40, width: 450 })
    await useRefitGlide(() => [beads.element])(beads.refit)

    expect(beads.moved()).toBe(true)
    expect(beads.animate).not.toHaveBeenCalled()
  })

  it('leaves a box the refit did not move as it is', async () => {
    reducedMotion(false)
    const beads = box({ left: 40, width: 900 }, { left: 40, width: 900 })
    await useRefitGlide(() => [beads.element])(beads.refit)

    expect(beads.moved()).toBe(true)
    expect(beads.animate).not.toHaveBeenCalled()
  })
})
