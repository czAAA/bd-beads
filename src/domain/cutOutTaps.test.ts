import { describe, expect, it } from 'vitest'
import { refinedMask, regionFromTapModel, TAP_MASK_SIDE, tapModelInput, tapModelPoint } from './cutOutTaps'
import type { SubjectMask } from './subjectMask'

// Cut out's taps (ticket 0769, ADR 0087): the picture as the tap model reads it, a tap's place on it, the model's answer
// back on the picture, and the automatic mask with each tapped region joined or taken away.

const mask = (width: number, rows: string[]): SubjectMask => ({
  width,
  height: rows.length,
  subject: Uint8Array.from(rows.join(''), (mark) => (mark === '#' ? 1 : 0)),
})
const marks = (result: SubjectMask) => Array.from(result.subject, (bit) => (bit ? '#' : '.')).join('').match(new RegExp(`.{${result.width}}`, 'g'))

describe('tapModelInput', () => {
  it('scales the picture so its longer side fills the square, at the top left, ImageNet-normalized, the rest zero', () => {
    // A 2 × 1 picture, both pixels white, read into a 4 × 4 square: the top half is picture, the bottom half padding.
    const picture = { width: 2, height: 1, data: new Uint8ClampedArray([255, 255, 255, 255, 255, 255, 255, 255]) }
    const input = tapModelInput(picture, 4)
    expect(input).toHaveLength(3 * 16)
    const white = [(1 - 0.485) / 0.229, (1 - 0.456) / 0.224, (1 - 0.406) / 0.225]
    for (const channel of [0, 1, 2]) {
      const plane = Array.from(input.subarray(channel * 16, channel * 16 + 16), (value) => Math.round(value * 1000) / 1000)
      const w = Math.round(white[channel]! * 1000) / 1000
      expect(plane).toEqual([w, w, w, w, w, w, w, w, 0, 0, 0, 0, 0, 0, 0, 0])
    }
  })
})

describe('tapModelPoint', () => {
  it('is the tapped pixel’s centre in the square’s scale', () => {
    expect(tapModelPoint({ x: 1, y: 0 }, 2, 1, 4)).toEqual([3, 1])
    const [x, y] = tapModelPoint({ x: 0, y: 3 }, 400, 200, 1024)
    expect(x).toBeCloseTo(1.28)
    expect(y).toBeCloseTo(8.96)
  })
})

describe('regionFromTapModel', () => {
  it('keeps the picture pixels whose place on the answer is above zero, the padding left out', () => {
    // A picture twice as wide as high: it covers the answer's top half. The answer says yes on its left half only.
    const side = TAP_MASK_SIDE
    const logits = new Float32Array(side * side).map((_, i) => (i % side < side / 2 ? 5 : -5))
    expect(marks(regionFromTapModel(logits, 4, 2))).toEqual(['##..', '##..'])
  })
})

describe('refinedMask', () => {
  it('joins each add region and takes each remove region away, in the order tapped', () => {
    const automatic = mask(4, ['##..', '##..'])
    const result = refinedMask(automatic, [
      { kind: 'add', region: mask(4, ['...#', '...#']) },
      { kind: 'remove', region: mask(4, ['#...', '#..#']) },
    ])
    expect(marks(result)).toEqual(['.#.#', '.#..'])
    expect(marks(automatic)).toEqual(['##..', '##..'])
  })

  it('is the automatic mask with no taps', () => {
    expect(marks(refinedMask(mask(2, ['#.']), []))).toEqual(['#.'])
  })
})
