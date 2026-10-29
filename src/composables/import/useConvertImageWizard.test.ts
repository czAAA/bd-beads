import { describe, expect, it } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { PixelData } from '../../domain/imageConversion'
import { useConvertImageWizard } from './useConvertImageWizard'

/** A flat picture of this size, enough for the size arithmetic. */
function flat(width: number, height: number): PixelData {
  return { width, height, data: new Uint8ClampedArray(width * height * 4).fill(200) }
}

async function setup(picture: PixelData) {
  const scope = effectScope()
  const wizard = scope.run(() =>
    useConvertImageWizard({
      start: { technique: 'loom', beadId: 'toho/cube/1.5mm', name: '', makerName: '' },
      decodeImage: async () => picture,
      loadCatalog: () => Promise.reject(new Error('no catalog')),
    }),
  )!
  await wizard.setFile(new File(['x'], 'art.png', { type: 'image/png' }))
  await nextTick()
  return wizard
}

describe('useConvertImageWizard mode switch (spec 0645)', () => {
  it('carries a ratio’s Schema across as the size, and the size back as its framed part at the nearest ratio', async () => {
    const wizard = await setup(flat(120, 80))
    expect(wizard.mode.value).toBe('ratio')
    wizard.setRatio({ pixels: 4, beads: 1 })
    expect(wizard.dimensions.value).toEqual({ columns: 30, rows: 20 })

    wizard.setMode('size')
    expect([wizard.widthText.value, wizard.heightText.value]).toEqual([30, 20])
    expect(wizard.dimensions.value).toEqual({ columns: 30, rows: 20 })

    wizard.setMode('ratio')
    expect(wizard.ratio.value).toEqual({ pixels: 4, beads: 1 })
    expect(wizard.dimensions.value).toEqual({ columns: 30, rows: 20 })
  })

  it('keeps picture proportions By size, through the Bead', async () => {
    const wizard = await setup(flat(1000, 500))
    expect(wizard.mode.value).toBe('size')
    wizard.setWidth(40)
    expect(wizard.heightText.value).toBe(20)
  })

  it('turns the picture with its sides swapped, starting the crop over and keeping the picture zoom', async () => {
    const wizard = await setup(flat(1000, 500))
    wizard.setZoom(2)
    wizard.turn()
    expect([wizard.image.value!.width, wizard.image.value!.height]).toEqual([500, 1000])
    expect(wizard.zoom.value).toBe(2)
  })
})
