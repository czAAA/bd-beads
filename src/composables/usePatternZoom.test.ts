import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { BEAD_CATALOG } from '../domain/beads'
import { createPattern, type Pattern } from '../domain/pattern'
import { usePatternZoom } from './usePatternZoom'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

/** A 900px-wide canvas area: this is what the old fixed CANVAS_MAX_PX constant provided everywhere before ticket 27
 *  made the real width live-measured. A fixed ref here isolates these tests to the pure fit math, independent of
 *  ResizeObserver/DOM — see useElementSize.test.ts for the live-measurement side. Height isn't part of the fit (see
 *  usePatternZoom's docs), so there's nothing to fix here for it. */
function fixedAvailableWidth(width = 900) {
  return ref(width)
}

/** 10x10 cells at 20px, comfortably inside a 900px-wide canvas area even with the ruler gutters. */
function smallPattern(): Pattern {
  return createPattern({
    technique: 'loom',
    beadId: cubeBead.id,
    size: { width: 15, height: 15, unit: 'mm' },
  })
}

/**
 * 60x60 cells at 20px = 1200px, comfortably bigger than a 900px-wide canvas area, so it opens well zoomed out. Kept
 * a good margin over the area rather than just past it, so LARGE_FIT_PERCENT stays a clearly-zoomed-out number that
 * reads as fit behavior instead of rounding noise.
 */
function largePattern(): Pattern {
  return createPattern({
    technique: 'loom',
    beadId: cubeBead.id,
    size: { width: 90, height: 90, unit: 'mm' },
  })
}

/** The level largePattern fits a 900px-wide canvas area at: 1200px of grid into 900px minus the two ruler gutters and the grid outline. Move it if fixedAvailableWidth's default changes. */
const LARGE_FIT_PERCENT = 69

describe('usePatternZoom', () => {
  it('opens a Pattern that already fits at 100%', () => {
    const width = fixedAvailableWidth()
    const { zoomPercent } = usePatternZoom(() => smallPattern(), width)

    expect(zoomPercent.value).toBe(100)
  })

  it('opens a Pattern bigger than the canvas area zoomed out far enough to fit it whole', () => {
    const width = fixedAvailableWidth()
    const { zoomPercent } = usePatternZoom(() => largePattern(), width)

    expect(zoomPercent.value).toBe(LARGE_FIT_PERCENT)
  })

  it('falls back to a placeholder size before the canvas area has been measured, rather than collapsing to near zero', () => {
    const width = fixedAvailableWidth(0)
    const { zoomPercent } = usePatternZoom(() => largePattern(), width)

    expect(zoomPercent.value).toBe(LARGE_FIT_PERCENT)
  })

  it('steps in and out a quarter at a time', () => {
    const width = fixedAvailableWidth()
    const { zoomPercent, zoomIn, zoomOut } = usePatternZoom(() => smallPattern(), width)

    zoomIn()
    expect(zoomPercent.value).toBe(125)

    zoomOut()
    zoomOut()
    expect(zoomPercent.value).toBe(75)
  })

  it('will not step past either end of the usable range', () => {
    const width = fixedAvailableWidth()
    const { zoomPercent, zoomIn, zoomOut } = usePatternZoom(() => smallPattern(), width)

    for (let step = 0; step < 20; step++) {
      zoomIn()
    }
    expect(zoomPercent.value).toBe(300)

    for (let step = 0; step < 20; step++) {
      zoomOut()
    }
    expect(zoomPercent.value).toBe(25)
  })

  it('resets back to the level that fits the open Pattern', () => {
    const width = fixedAvailableWidth()
    const { zoomPercent, zoomIn, resetZoom } = usePatternZoom(() => largePattern(), width)

    zoomIn()
    expect(zoomPercent.value).not.toBe(LARGE_FIT_PERCENT)

    resetZoom()
    expect(zoomPercent.value).toBe(LARGE_FIT_PERCENT)
  })

  it('re-fits when a different Pattern is opened', async () => {
    const width = fixedAvailableWidth()
    const pattern = ref<Pattern | undefined>(smallPattern())
    const { zoomPercent } = usePatternZoom(() => pattern.value, width)
    expect(zoomPercent.value).toBe(100)

    pattern.value = largePattern()
    await nextTick()

    expect(zoomPercent.value).toBe(LARGE_FIT_PERCENT)
  })

  it('sits at 100% while no Pattern is open', () => {
    const width = fixedAvailableWidth()
    const { zoomPercent } = usePatternZoom(() => undefined, width)

    expect(zoomPercent.value).toBe(100)
  })

  it('re-fits when the canvas area resizes, as long as zoom is still at the fit level (ticket 27)', async () => {
    const width = fixedAvailableWidth()
    const { zoomPercent } = usePatternZoom(() => largePattern(), width)
    expect(zoomPercent.value).toBe(LARGE_FIT_PERCENT)

    // A much wider canvas area (e.g. the tool panel collapsing, or a wider browser window) should let the same
    // Pattern open bigger without the user touching zoom at all.
    width.value = 1800
    await nextTick()

    expect(zoomPercent.value).toBe(100)
  })

  it('leaves a manually chosen zoom alone across a canvas area resize, until Reset or a Pattern switch', async () => {
    const width = fixedAvailableWidth()
    const { zoomPercent, zoomIn } = usePatternZoom(() => largePattern(), width)

    zoomIn()
    const manualZoom = zoomPercent.value
    expect(manualZoom).not.toBe(LARGE_FIT_PERCENT)

    width.value = 1800
    await nextTick()

    expect(zoomPercent.value).toBe(manualZoom)
  })
})
