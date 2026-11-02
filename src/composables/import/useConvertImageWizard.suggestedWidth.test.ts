import { describe, expect, it } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { PixelData } from '../../domain/imageConversion'
import { frameGrid } from '../../testUtils/frameGrid'
import { useConvertImageWizard, type ConvertImageWizard } from './useConvertImageWizard'

// Suggested Width (ticket 0770, spec 0761) through the wizard's state: the narrowest Width that still keeps the
// subject's small color regions, shown but never set until the maker picks it. Synthetic pictures only.

type Rgb = [number, number, number]

/** A picture drawn by a function of each pixel's place. */
function draw(width: number, height: number, at: (x: number, y: number) => Rgb): PixelData {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) data.set([...at(x, y), 255], (y * width + x) * 4)
  }
  return { width, height, data }
}

const WHITE: Rgb = [250, 250, 250]
const RED: Rgb = [220, 40, 50]
const BLUE: Rgb = [30, 60, 200]
const BLUE_HEX = '#1e3cc8'
const inBox = (x: number, y: number, left: number, top: number, width: number, height: number) =>
  x >= left && x < left + width && y >= top && y < top + height

/** A 240 × 160 white picture with a big red block and, unless left out, a small blue 8 × 8 square. */
const picture = (withDetail = true) =>
  draw(240, 160, (x, y) => (withDetail && inBox(x, y, 200, 40, 8, 8) ? BLUE : inBox(x, y, 40, 40, 96, 80) ? RED : WHITE))

/** The wizard with a picture set, opening at its widest Width. */
async function convert(image: PixelData): Promise<ConvertImageWizard> {
  const wizard = effectScope().run(() =>
    useConvertImageWizard({
      start: { technique: 'loom', beadId: 'toho/cube/1.5mm', name: '', makerName: '' },
      decodeImage: async () => image,
      loadCatalog: () => Promise.reject(new Error('no catalog')),
    }),
  )!
  await wizard.setFile(new File(['x'], 'picture.png', { type: 'image/png' }))
  await nextTick()
  return wizard
}

const hasBlue = (wizard: ConvertImageWizard) => frameGrid(wizard.createProject()!).some((row) => row.some((cell) => cell.color === BLUE_HEX))

describe('Suggested Width (ticket 0770)', () => {
  it('is narrower than the widest Width, and the small region still has a bead there', async () => {
    const wizard = await convert(picture())
    const suggested = wizard.suggestedWidth.value!

    expect(suggested).toBeLessThan(wizard.sizing.value.range.max)
    wizard.useSuggestedWidth()
    await nextTick()
    expect(wizard.sizing.value.width).toBe(suggested)
    expect(hasBlue(wizard)).toBe(true)
  })

  it('reads a picture far wider than the widest Width just as well, the small region kept at the suggestion', async () => {
    // Five times the picture's size: 1200 px over a widest Width of 300 beads, so 4 px a bead.
    const large = draw(1200, 800, (x, y) => (inBox(x, y, 1000, 200, 40, 40) ? BLUE : inBox(x, y, 200, 200, 480, 400) ? RED : WHITE))
    const wizard = await convert(large)
    const suggested = wizard.suggestedWidth.value!

    expect(suggested).toBeLessThan(300)
    wizard.useSuggestedWidth()
    await nextTick()
    expect(hasBlue(wizard)).toBe(true)
  })

  it('keeps the small region: a Width much narrower than the suggestion loses it', async () => {
    const wizard = await convert(picture())
    wizard.setWidth(Math.floor(wizard.suggestedWidth.value! / 2))
    await nextTick()

    expect(hasBlue(wizard)).toBe(false)
  })

  it('is narrower for the same picture without the small region', async () => {
    const detailed = await convert(picture())
    const plain = await convert(picture(false))

    expect(plain.suggestedWidth.value!).toBeLessThan(detailed.suggestedWidth.value!)
  })

  it('prefers a mark: the Width where one bead is a whole 8 × 8 px', async () => {
    const wizard = await convert(picture())

    expect(wizard.suggestedWidth.value).toBe(30)
    expect(wizard.sizing.value.marks.map((mark) => mark.width)).toContain(30)
  })

  it('moves the Width only when picked, the Height following while linked', async () => {
    const wizard = await convert(picture())
    const opening = { width: wizard.sizing.value.width, height: wizard.sizing.value.height }
    expect(wizard.suggestedWidth.value).not.toBe(opening.width)
    expect(opening).toEqual({ width: 240, height: 160 })

    wizard.useSuggestedWidth()
    await nextTick()
    expect(wizard.dimensions.value).toEqual({ columns: 30, rows: 20 })
  })
})
