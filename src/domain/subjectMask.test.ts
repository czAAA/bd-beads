import { describe, expect, it } from 'vitest'
import type { PixelData } from './imageConversion'
import { backgroundFamilies, DEFAULT_TOLERANCE, simpleCutOut, subjectBox } from './subjectMask'

// Simple's edges (ticket 0765): what the wizard's tests of a subject on a field don't reach. The rule itself, a field
// taken and a subject kept as Tolerance moves, is asserted through the wizard (useConvertImageWizard.cutOut.test.ts).

type Rgba = [number, number, number, number?]

function draw(width: number, height: number, at: (x: number, y: number) => Rgba): PixelData {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a = 255] = at(x, y)
      data.set([r, g, b, a], (y * width + x) * 4)
    }
  }
  return { width, height, data }
}

const RED: Rgba = [220, 40, 50]
const GREY: Rgba = [200, 200, 200]
const cutOut = (picture: PixelData) => simpleCutOut(picture, backgroundFamilies(picture), DEFAULT_TOLERANCE)

describe('Simple cut out (ticket 0765)', () => {
  it('keeps a subject that touches the edge in a few pixels: its colors are not background', () => {
    // A red bar from the top edge down, 2 pixels of a 120-pixel border.
    const mask = cutOut(draw(32, 32, (x, y) => (x >= 15 && x < 17 && y < 20 ? RED : GREY)))
    expect(subjectBox(mask)).toEqual({ x: 15, y: 0, width: 2, height: 20 })
  })

  it('fills through transparent pixels, which are never the subject', () => {
    const mask = cutOut(draw(20, 20, (x, y) => (x < 2 || y < 2 ? [0, 0, 0, 0] : x >= 8 && x < 12 && y >= 8 && y < 12 ? RED : GREY)))
    expect(subjectBox(mask)).toEqual({ x: 8, y: 8, width: 4, height: 4 })
  })

  it('reaches every pixel of a picture larger than its first queue', () => {
    const mask = cutOut(draw(400, 300, (x, y) => (x >= 190 && x < 210 && y >= 140 && y < 160 ? RED : GREY)))
    expect(subjectBox(mask)).toEqual({ x: 190, y: 140, width: 20, height: 20 })
    expect(mask.subject.reduce((sum, kept) => sum + kept, 0)).toBe(400)
  })

  it('keeps nothing of a plain picture, so there is no box to fit to', () => {
    expect(subjectBox(cutOut(draw(10, 1, () => GREY)))).toBeUndefined()
  })
})
