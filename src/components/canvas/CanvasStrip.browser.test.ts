import { describe, expect, it } from 'vitest'
import CanvasStrip from './CanvasStrip.vue'
import { createProject } from '../../domain/createProject'
import { inShell, mountAt, resizeTo } from '../../testUtils/browserFit'
import { settleForMeasuring } from '../../testUtils/textFitInPage'

// On a phone the strip is wider than the screen (ticket 0843, F-06-02): Export stays whole at its right end, the edge
// where the other controls are cut fades, and a swipe scrolls them. Measured in the strip's own shell, as the app has it.
const project = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Moth', size: { width: 12, height: 12, unit: 'beads' } })
const props = { project, rulers: true, referenceImage: 'shown' as const, canUndo: true, canRedo: true, zoomPercent: 125 }
const InShell = inShell(CanvasStrip, props)

const rectOf = (root: HTMLElement, selector: string): DOMRect => root.querySelector<HTMLElement>(selector)!.getBoundingClientRect()
const scroller = (root: HTMLElement): HTMLElement => root.querySelector<HTMLElement>('[data-testid="canvas-strip-scroller"]')!

describe('CanvasStrip on a phone (ticket 0843)', () => {
  it.each([390, 320])('keeps Export whole at the strip\'s right end at %ipx, fades the cut edge, and a swipe scrolls the rest', async (width) => {
    const { root } = await mountAt(InShell, {}, { locale: 'en', width })
    const strip = rectOf(root, '[data-testid="canvas-strip"]')
    const exportButton = rectOf(root, '[data-testid="strip-export"]')

    expect(exportButton.left).toBeGreaterThanOrEqual(0)
    expect(exportButton.right).toBeLessThanOrEqual(Math.min(strip.right, window.innerWidth))
    expect(exportButton.width).toBeGreaterThan(0)
    const row = scroller(root)
    expect(row.scrollWidth).toBeGreaterThan(row.clientWidth)
    expect(row.dataset.cut).toBe('end')
    expect(getComputedStyle(row).maskImage).not.toBe('none')

    row.scrollLeft = 8
    row.dispatchEvent(new Event('scroll'))
    await settleForMeasuring()
    expect(row.dataset.cut).toBe('both')

    row.scrollLeft = row.scrollWidth
    row.dispatchEvent(new Event('scroll'))
    await settleForMeasuring()
    expect(row.dataset.cut).toBe('start')
    expect(rectOf(root, '[data-testid="zoom-reset"]').right).toBeLessThanOrEqual(exportButton.left)
    expect(rectOf(root, '[data-testid="strip-export"]')).toEqual(exportButton)
  })

  it('is unchanged on tablets and laptops: nothing cut, nothing faded, Export last in the right corner', async () => {
    const { root } = await mountAt(InShell, {}, { locale: 'en', width: 768 })
    for (const width of [768, 1024, 1280]) {
      await resizeTo(width)
      const row = scroller(root)
      expect(row.scrollWidth, `${width}px`).toBeLessThanOrEqual(row.clientWidth)
      expect(row.dataset.cut, `${width}px`).toBe('none')
      expect(getComputedStyle(row).maskImage, `${width}px`).toBe('none')
      expect(rectOf(root, '[data-testid="zoom-reset"]').right, `${width}px`).toBeLessThanOrEqual(rectOf(root, '[data-testid="strip-export"]').left)
    }
  })
})
