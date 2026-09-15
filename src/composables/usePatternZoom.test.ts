import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { BEAD_CATALOG } from '../domain/beads'
import { createPattern, type Pattern } from '../domain/pattern'
import { usePatternZoom } from './usePatternZoom'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

/** 10x10 cells at 20px, comfortably inside the canvas box even with the ruler gutters. */
function smallPattern(): Pattern {
  return createPattern({
    technique: 'loom',
    beadId: cubeBead.id,
    size: { width: 15, height: 15, unit: 'mm' },
  })
}

/** 30x30 cells at 20px = 600px, bigger than the box, so it opens zoomed out. */
function largePattern(): Pattern {
  return createPattern({
    technique: 'loom',
    beadId: cubeBead.id,
    size: { width: 45, height: 45, unit: 'mm' },
  })
}

describe('usePatternZoom', () => {
  it('opens a Pattern that already fits at 100%', () => {
    const { zoomPercent } = usePatternZoom(() => smallPattern())

    expect(zoomPercent.value).toBe(100)
  })

  it('opens a Pattern bigger than the box zoomed out far enough to fit it whole', () => {
    const { zoomPercent } = usePatternZoom(() => largePattern())

    expect(zoomPercent.value).toBe(69)
  })

  it('steps in and out a quarter at a time', () => {
    const { zoomPercent, zoomIn, zoomOut } = usePatternZoom(() => smallPattern())

    zoomIn()
    expect(zoomPercent.value).toBe(125)

    zoomOut()
    zoomOut()
    expect(zoomPercent.value).toBe(75)
  })

  it('will not step past either end of the usable range', () => {
    const { zoomPercent, zoomIn, zoomOut } = usePatternZoom(() => smallPattern())

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
    const { zoomPercent, zoomIn, resetZoom } = usePatternZoom(() => largePattern())

    zoomIn()
    expect(zoomPercent.value).not.toBe(69)

    resetZoom()
    expect(zoomPercent.value).toBe(69)
  })

  it('re-fits when a different Pattern is opened', async () => {
    const pattern = ref<Pattern | undefined>(smallPattern())
    const { zoomPercent } = usePatternZoom(() => pattern.value)
    expect(zoomPercent.value).toBe(100)

    pattern.value = largePattern()
    await nextTick()

    expect(zoomPercent.value).toBe(69)
  })

  it('sits at 100% while no Pattern is open', () => {
    const { zoomPercent } = usePatternZoom(() => undefined)

    expect(zoomPercent.value).toBe(100)
  })
})
