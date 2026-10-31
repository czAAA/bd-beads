import { describe, expect, it } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { PixelData } from '../../domain/imageConversion'
import { useConvertImageWizard } from './useConvertImageWizard'

/** A flat picture of this size, enough for the size arithmetic. */
function flat(width: number, height: number): PixelData {
  return { width, height, data: new Uint8ClampedArray(width * height * 4).fill(200) }
}

/** A picture of three colors in bands: red on the left third, blue in the middle, yellow on the right. */
function bands(width: number, height: number): PixelData {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const band = Math.floor((x * 3) / width)
      data.set(band === 0 ? [230, 55, 70, 255] : band === 1 ? [47, 111, 219, 255] : [250, 220, 60, 255], (y * width + x) * 4)
    }
  }
  return { width, height, data }
}

async function setup(picture: PixelData, beadId = 'toho/cube/1.5mm') {
  const scope = effectScope()
  const wizard = scope.run(() =>
    useConvertImageWizard({
      start: { technique: 'loom', beadId, name: '', makerName: '' },
      decodeImage: async () => picture,
      loadCatalog: () => Promise.reject(new Error('no catalog')),
    }),
  )!
  await wizard.setFile(new File(['x'], 'art.png', { type: 'image/png' }))
  await nextTick()
  return wizard
}

describe('useConvertImageWizard sizing (ticket 0747)', () => {
  it('starts on the whole picture at one bead per pixel, the grid exact on that mark', async () => {
    const wizard = await setup(flat(32, 32))
    expect(wizard.weave.value).toBe('whole')
    expect(wizard.sizing.value.width).toBe(32)
    expect(wizard.sizing.value.mark).toEqual({ width: 32, pixelsPerBead: 1 })
    expect(wizard.dimensions.value).toEqual({ columns: 32, rows: 32 })
  })

  it('follows the picture’s physical shape through the Bead between marks', async () => {
    const cube = await setup(flat(200, 100))
    cube.setWidth(40)
    expect(cube.dimensions.value).toEqual({ columns: 40, rows: 20 })

    const delica = await setup(flat(200, 100), 'miyuki/delica/11-0')
    delica.setWidth(40)
    expect(delica.dimensions.value).toEqual({ columns: 40, rows: 16 })
  })

  it('reads the Width in mm through the Bead', async () => {
    const wizard = await setup(flat(200, 100))
    wizard.setWidth(40)
    expect(wizard.widthMmOf(40)).toBe(60)
  })

  it('weaves A part from 10% in, the range, grid and colors following it', async () => {
    const wizard = await setup(bands(60, 30))
    expect(wizard.colorsMax.value).toBe(3)

    wizard.setWeave('part')
    expect(wizard.part.value).toEqual({ x: 6, y: 3, width: 48, height: 24 })
    expect(wizard.sizing.value.range).toEqual({ min: 8, max: 192 })

    // The left third of the part is 12 px of red out of 48: still three colors; a part inside the blue band has one.
    wizard.setPart({ x: 22, y: 3, width: 16, height: 24 })
    await nextTick()
    expect(wizard.colorsMax.value).toBe(1)
    expect(wizard.sizing.value.range.max).toBe(64)
  })

  it('goes back to the whole picture on a turn and a flip', async () => {
    const wizard = await setup(flat(60, 30))
    wizard.setWeave('part')
    wizard.turn()
    expect(wizard.weave.value).toBe('whole')
    expect([wizard.image.value!.width, wizard.image.value!.height]).toEqual([30, 60])

    wizard.setWeave('part')
    wizard.flip()
    expect(wizard.weave.value).toBe('whole')
  })
})

describe('useConvertImageWizard colors (ticket 0747)', () => {
  it('starts the Colors slider at 12, or at every color the picture has where that is fewer', async () => {
    const wizard = await setup(bands(60, 30))
    expect(wizard.maxColors.value).toBe(3)
    expect(wizard.found.value).toHaveLength(3)
  })

  it('reduces to the count the slider asks, inside the picture’s colors', async () => {
    const wizard = await setup(bands(60, 30))
    wizard.setMaxColors(1)
    expect(wizard.found.value).toHaveLength(1)
    wizard.setMaxColors(99)
    expect(wizard.maxColors.value).toBe(3)
  })

  it('offers at most 256 colors of a picture that has more: a pattern, not the picture itself', async () => {
    // 300 px wide, every column its own color.
    const data = new Uint8ClampedArray(300 * 4)
    for (let x = 0; x < 300; x += 1) data.set([x & 255, (x >> 8) * 90, 60, 255], x * 4)
    const wizard = await setup({ width: 300, height: 1, data })
    expect(wizard.colorsMax.value).toBe(256)
    expect(wizard.colorsCapped.value).toBe(true)
  })
})
