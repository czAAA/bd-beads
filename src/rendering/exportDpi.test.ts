import { afterEach, describe, expect, it, vi } from 'vitest'

/** A document whose canvases hold at most `limit` pixels: past it a canvas has no 2D context, as iPad Safari's. */
function documentHolding(limit: number) {
  const created: { width: number; height: number }[] = []
  vi.stubGlobal('document', {
    createElement: () => {
      const canvas = {
        width: 0,
        height: 0,
        getContext() {
          if (canvas.width * canvas.height > limit) return null
          return { fillRect() {}, getImageData: () => ({ data: [255] }), set fillStyle(_value: string) {} }
        },
      }
      created.push(canvas)
      return canvas
    },
  })
  return created
}

afterEach(() => vi.unstubAllGlobals())

describe('pngDpiFor (ticket 572)', () => {
  // The probe remembers each dpi, so every case asks about a different device through a fresh module.
  const fresh = async () => (vi.resetModules(), (await import('./exportDpi')).pngDpiFor)

  it('gives each quality its own dpi where a page that large can be drawn', async () => {
    documentHolding(100_000_000)
    const dpiFor = await fresh()
    expect([dpiFor('low'), dpiFor('medium'), dpiFor('high')]).toEqual([150, 300, 450])
  })

  it('draws High at 300 dpi where a 450 dpi page cannot be allocated', async () => {
    documentHolding(16_000_000)
    const dpiFor = await fresh()
    expect([dpiFor('low'), dpiFor('medium'), dpiFor('high')]).toEqual([150, 300, 300])
  })

  it('never goes below 150 dpi, and frees the canvas it tried', async () => {
    const created = documentHolding(1)
    const dpiFor = await fresh()
    expect(dpiFor('high')).toBe(150)
    expect(created.every((canvas) => canvas.width === 0)).toBe(true)
  })
})

describe('pdfPageDpi (ADR 0076)', () => {
  const fresh = async () => (vi.resetModules(), (await import('./exportDpi')).pdfPageDpi)

  it('is 300 whatever the Export quality, where a 300 dpi page can be drawn', async () => {
    documentHolding(100_000_000)
    expect((await fresh())()).toBe(300)
  })

  it('is 150 where a 300 dpi page cannot be allocated', async () => {
    documentHolding(5_000_000)
    expect((await fresh())()).toBe(150)
  })
})
