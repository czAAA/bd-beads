import { describe, expect, it } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { frameOf } from '../../domain/layerRecord'
import type { PixelData } from '../../domain/imageConversion'
import { useConvertImageWizard } from './useConvertImageWizard'

/** A 240 × 236 picture of four colored quarters: at Width 60 one bead is 4 × 4 px, 60 × 59 beads. */
function quarters(width = 240, height = 236): PixelData {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const right = x >= width / 2
      const low = y >= height / 2
      data.set(right ? (low ? [250, 220, 60, 255] : [47, 111, 219, 255]) : low ? [40, 160, 80, 255] : [230, 55, 70, 255], (y * width + x) * 4)
    }
  }
  return { width, height, data }
}

async function setup(...pictures: PixelData[]) {
  const queue = pictures.length > 0 ? [...pictures] : [quarters()]
  const wizard = effectScope().run(() =>
    useConvertImageWizard({
      start: { technique: 'loom', beadId: 'toho/cube/1.5mm', name: '', makerName: '' },
      decodeImage: async () => queue.shift() ?? quarters(),
      loadCatalog: () => Promise.reject(new Error('no catalog')),
    }),
  )!
  const setNext = () => wizard.setFile(new File(['x'], 'cat.png', { type: 'image/png' }))
  await setNext()
  await nextTick()
  return { wizard, setNext }
}

/** The bottom-right corner dragged up and left by whole beads, as the preview's handle does. */
function pullCorner(wizard: ReturnType<typeof useConvertImageWizard>, columns: number, rows: number) {
  wizard.beginCrop()
  wizard.pullCrop('bottomRight', columns, rows)
  wizard.endCrop()
}

describe('useConvertImageWizard the crop (ticket 0898)', () => {
  it('opens on the whole picture, never cropped in, and Create Project makes every bead shown', async () => {
    const { wizard } = await setup()
    expect(wizard.dimensions.value).toEqual({ columns: 60, rows: 59 })
    expect(wizard.crop.value).toEqual({ rect: { row: 0, column: 0, rows: 59, columns: 60 }, cropped: false })
    const project = wizard.createProject()!
    expect(frameOf(project)).toMatchObject({ columns: 60, rows: 59 })
  })

  it('keeps exactly the beads inside a dragged corner, converting nothing again, and reads the part', async () => {
    const { wizard } = await setup()
    const beads = wizard.previewGrid.value
    pullCorner(wizard, -26, -21)

    expect(wizard.kept.value).toEqual({ row: 0, column: 0, rows: 38, columns: 34 })
    expect(wizard.crop.value).toEqual({ rect: { row: 0, column: 0, rows: 38, columns: 34 }, cropped: true })
    expect(wizard.previewGrid.value).toBe(beads)
    expect(wizard.dimensions.value).toEqual({ columns: 60, rows: 59 })
    // Width reads the part, its range the part's 136 px.
    expect(wizard.sizing.value.width).toBe(34)
    expect(wizard.sizing.value.range).toEqual({ min: 8, max: 136 })
    expect(frameOf(wizard.createProject()!)).toMatchObject({ columns: 34, rows: 38 })
  })

  it('counts only the kept part’s colors', async () => {
    const { wizard } = await setup()
    expect(wizard.usedColorCount.value).toBe(4)
    pullCorner(wizard, -40, -40)
    expect(wizard.usedColorCount.value).toBe(1)
  })

  it('converts the part again at a new Width, and Keep all puts the whole back at the Width it had', async () => {
    const { wizard } = await setup()
    pullCorner(wizard, -26, -21)
    wizard.setWidth(68)

    expect(wizard.part.value).toEqual({ x: 0, y: 0, width: 136, height: 152 })
    expect(wizard.kept.value).toBeUndefined()
    expect(wizard.dimensions.value.columns).toBe(68)
    expect(wizard.crop.value?.cropped).toBe(true)

    wizard.keepAll()
    expect(wizard.part.value).toEqual({ x: 0, y: 0, width: 240, height: 236 })
    expect(wizard.dimensions.value).toEqual({ columns: 60, rows: 59 })
    expect(wizard.crop.value?.cropped).toBe(false)
  })

  it('counts the colors from the part once it is converted again', async () => {
    const { wizard } = await setup()
    // 20 × 19 beads in the red quarter, then twice the detail of it.
    pullCorner(wizard, -40, -40)
    wizard.setWidth(40)
    expect(wizard.part.value).toEqual({ x: 0, y: 0, width: 80, height: 76 })
    expect(wizard.colorsMax.value).toBe(1)
  })

  it('moves the part whole, kept on the picture, and steps a handle by whole beads', async () => {
    const { wizard } = await setup()
    pullCorner(wizard, -26, -21)
    wizard.beginCrop()
    wizard.shiftCrop(100, 5)
    wizard.endCrop()
    expect(wizard.kept.value).toEqual({ row: 5, column: 26, rows: 38, columns: 34 })

    wizard.nudgeCrop('left', 1, 0)
    expect(wizard.kept.value).toEqual({ row: 5, column: 27, rows: 38, columns: 33 })
  })

  it('pulls a part of the picture by whole beads at the size on show once it was converted again', async () => {
    const { wizard } = await setup()
    pullCorner(wizard, -26, -21)
    wizard.setWidth(68)
    // 136 px over 68 beads: 2 px a bead, so ten beads more to the right are 20 px more of the picture.
    wizard.beginCrop()
    wizard.pullCrop('right', 10, 0)
    wizard.endCrop()
    expect(wizard.part.value).toMatchObject({ x: 0, y: 0, width: 156 })
    expect(wizard.dimensions.value.columns).toBe(78)
  })

  it('turns and flips the part with the picture, on the same piece of it', async () => {
    const { wizard } = await setup()
    pullCorner(wizard, -26, -21)
    wizard.turn()
    // The top-left 136 × 152 px of a 240 × 236 picture is, turned, its top-right 152 × 136 px.
    expect(wizard.part.value).toEqual({ x: 84, y: 0, width: 152, height: 136 })
    expect(wizard.crop.value?.cropped).toBe(true)
    expect(wizard.dimensions.value).toEqual({ columns: 38, rows: 34 })

    wizard.flip()
    expect(wizard.part.value).toEqual({ x: 0, y: 0, width: 152, height: 136 })
  })

  it('converts the part again at a new Height too', async () => {
    const { wizard } = await setup()
    pullCorner(wizard, -26, -21)
    wizard.setHeight(76)
    expect(wizard.part.value).toEqual({ x: 0, y: 0, width: 136, height: 152 })
    expect(wizard.dimensions.value.rows).toBe(76)
  })

  it('keeps the Width on a turn with nothing cropped, on the whole turned picture', async () => {
    const { wizard } = await setup()
    wizard.turn()
    expect(wizard.crop.value?.cropped).toBe(false)
    expect(wizard.dimensions.value.columns).toBe(60)
  })

  it('opens a new picture on the whole, the crop never kept (ADR 0010)', async () => {
    const { wizard, setNext } = await setup(quarters(), quarters())
    pullCorner(wizard, -26, -21)
    wizard.setWidth(68)
    await setNext()
    expect(wizard.crop.value).toEqual({ rect: { row: 0, column: 0, rows: 59, columns: 60 }, cropped: false })
    expect(wizard.dimensions.value).toEqual({ columns: 60, rows: 59 })
  })
})
