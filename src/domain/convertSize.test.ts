// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Bead } from './beads'
import {
  LARGE_SCHEMA_BEADS,
  convertResult,
  flipPicture,
  fullCrop,
  isLargeSchema,
  partInset,
  partMoved,
  proportionalSide,
  sizeMarks,
  sizingFor,
  startingWidth,
  turnPicture,
  widthRange,
} from './convertSize'
import type { PixelData } from './imageConversion'

const cubeBead: Bead = {
  id: 'test-cube',
  brand: { id: 'test', name: 'Test' },
  size: '1.5mm',
  formFactor: { id: 'cube', nameKey: 'cube', roundness: 0, holes: { count: 1, direction: 'along' } },
  widthMm: 1.5,
  heightMm: 1.5,
}

const delicaBead: Bead = { ...cubeBead, id: 'test-delica', widthMm: 1.3, heightMm: 1.6 }

/** A picture whose pixel at (x, y) holds red x, green y, so a moved pixel can be told apart. */
function picture(width: number, height: number): PixelData {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      data.set([x, y, 0, 255], (y * width + x) * 4)
    }
  }
  return { width, height, data }
}

function pixel(image: PixelData, x: number, y: number): [number, number] {
  const at = (y * image.width + x) * 4
  return [image.data[at]!, image.data[at + 1]!]
}

describe('widthRange (ConvertImage card, 3 Size)', () => {
  it('runs from 8 beads to one bead per pixel of the part', () => {
    expect(widthRange({ width: 256, height: 192 })).toEqual({ min: 8, max: 256 })
  })

  it('stops at the Large Schema line', () => {
    expect(widthRange({ width: 1920, height: 1080 })).toEqual({ min: 8, max: LARGE_SCHEMA_BEADS })
  })

  it('lets a part under 75 px wide grow to four times its pixels, still under the line', () => {
    expect(widthRange({ width: 32, height: 32 })).toEqual({ min: 8, max: 128 })
    expect(widthRange({ width: 74, height: 10 })).toEqual({ min: 8, max: 296 })
    expect(widthRange({ width: 75, height: 10 })).toEqual({ min: 8, max: 75 })
  })

  it('never puts the min above the max for a tiny picture', () => {
    expect(widthRange({ width: 1, height: 1 })).toEqual({ min: 4, max: 4 })
  })
})

describe('sizeMarks', () => {
  it('marks every whole n × n pixels per bead the width divides by, inside the range', () => {
    // 256 divides by 32, 16, 8, 4 and 2; 256 / 32 = 8 is the min itself.
    expect(sizeMarks({ width: 256, height: 192 })).toEqual([
      { width: 8, pixelsPerBead: 32 },
      { width: 16, pixelsPerBead: 16 },
      { width: 32, pixelsPerBead: 8 },
      { width: 64, pixelsPerBead: 4 },
      { width: 128, pixelsPerBead: 2 },
      { width: 256, pixelsPerBead: 1 },
    ])
  })

  it('leaves out a block the width does not divide by, and a mark past the line', () => {
    // 1000 / 16 and 1000 / 32 are not whole; 1000 / 2 and 1000 / 1 are past 300.
    expect(sizeMarks({ width: 1000, height: 500 })).toEqual([
      { width: 125, pixelsPerBead: 8 },
      { width: 250, pixelsPerBead: 4 },
    ])
  })

  it('adds the enlarging marks, every pixel 2 × 2 and 4 × 4 beads, for a small part', () => {
    expect(sizeMarks({ width: 16, height: 10 })).toEqual([
      { width: 8, pixelsPerBead: 2 },
      { width: 16, pixelsPerBead: 1 },
      { width: 32, pixelsPerBead: 0.5 },
      { width: 64, pixelsPerBead: 0.25 },
    ])
  })

  it('has no marks for a width nothing divides', () => {
    expect(sizeMarks({ width: 5000, height: 5000 })).toEqual([])
  })
})

describe('sizingFor', () => {
  it('snaps the height to the pixel grid on a mark, a part block at the edge counting as a bead', () => {
    const sizing = sizingFor({ part: { width: 256, height: 190 }, width: 32, bead: delicaBead, technique: 'loom' })
    expect(sizing.mark).toEqual({ width: 32, pixelsPerBead: 8 })
    expect(sizing.grid).toEqual({ columns: 32, rows: 24 })
    expect(sizing.pixelsPerBead).toEqual({ x: 8, y: 8 })
  })

  it('makes every pixel n × n beads on an enlarging mark', () => {
    const sizing = sizingFor({ part: { width: 16, height: 10 }, width: 64, bead: cubeBead, technique: 'loom' })
    expect(sizing.mark).toEqual({ width: 64, pixelsPerBead: 0.25 })
    expect(sizing.grid).toEqual({ columns: 64, rows: 40 })
  })

  it('follows the physical shape of the picture through the Bead between marks', () => {
    // 40 beads of 1.3 mm is 52 mm across; the picture is half as tall, 26 mm, about 16 beads of 1.6 mm.
    const sizing = sizingFor({ part: { width: 200, height: 100 }, width: 40, bead: delicaBead, technique: 'loom' })
    expect(sizing.mark).toBeUndefined()
    expect(sizing.grid).toEqual({ columns: 40, rows: 16 })
    expect(sizing.pixelsPerBead).toEqual({ x: 5, y: 6.25 })
  })

  it('keeps the Width inside the range, and says so', () => {
    expect(sizingFor({ part: { width: 256, height: 192 }, width: 999, bead: cubeBead, technique: 'loom' }).width).toBe(256)
    expect(sizingFor({ part: { width: 256, height: 192 }, width: 2, bead: cubeBead, technique: 'loom' }).width).toBe(8)
  })

  it('hands the slider its ends and marks', () => {
    const sizing = sizingFor({ part: { width: 16, height: 10 }, width: 16, bead: cubeBead, technique: 'loom' })
    expect(sizing.range).toEqual({ min: 8, max: 64 })
    expect(sizing.marks.map((mark) => mark.width)).toEqual([8, 16, 32, 64])
  })
})

describe('startingWidth (the starting proposal)', () => {
  it('is one bead per pixel where that mark is in range: pixel art opens exact', () => {
    expect(startingWidth({ width: 32, height: 32 })).toBe(32)
    expect(startingWidth({ width: 240, height: 160 })).toBe(240)
  })

  it('is the largest mark giving at most 150 beads on the long side for a picture too wide for one bead per pixel', () => {
    expect(startingWidth({ width: 1920, height: 1080 })).toBe(120)
    // 4 px wide goes from 8 to 16 beads: one bead per pixel is under the min, so the ×4 mark.
    expect(startingWidth({ width: 4, height: 2 })).toBe(16)
  })

  it('judges the long side by the height of a tall picture', () => {
    // 1080 / 8 = 135 wide is 240 tall, too tall, and 1080 divides by no larger block: so 150 tall, 84 wide.
    expect(startingWidth({ width: 1080, height: 1920 })).toBe(84)
  })

  it('is 150 beads on the long side when no mark keeps to it', () => {
    expect(startingWidth({ width: 5000, height: 2500 })).toBe(150)
    expect(startingWidth({ width: 2500, height: 5000 })).toBe(75)
  })

  it('is the max where that is smaller, one bead per pixel not being for a strip taller than the Large Schema line', () => {
    expect(startingWidth({ width: 77, height: 1000 })).toBe(12)
  })
})

describe('the part (weave: A part)', () => {
  const image = { width: 200, height: 100 }

  it('starts 10% in from each edge', () => {
    expect(partInset(image)).toEqual({ x: 20, y: 10, width: 160, height: 80 })
  })

  it('is at least 8 pixels a side even on a tiny picture', () => {
    expect(partInset({ width: 10, height: 9 })).toEqual({ x: 1, y: 1, width: 8, height: 8 })
  })

  it('moves the edges a handle holds, in whole pixels, never off the picture', () => {
    const part = { x: 20, y: 10, width: 160, height: 80 }
    expect(partMoved(part, 'topLeft', -5.4, 3.6, image)).toEqual({ x: 15, y: 14, width: 165, height: 76 })
    expect(partMoved(part, 'right', 50, 50, image)).toEqual({ x: 20, y: 10, width: 180, height: 80 })
    expect(partMoved(part, 'bottom', 0, -100, image)).toEqual({ x: 20, y: 10, width: 160, height: 8 })
  })

  it('is the whole picture when nothing is cropped', () => {
    expect(fullCrop(image)).toEqual({ x: 0, y: 0, width: 200, height: 100 })
  })
})

describe('proportionalSide', () => {
  it('gives the other side from the picture shape on a square bead', () => {
    expect(proportionalSide({ width: 200, height: 100 }, cubeBead, 'loom', { columns: 40 })).toBe(20)
  })

  it('keeps the physical shape on a bead taller or wider than it is long', () => {
    // 40 beads of 1.3 mm is 52 mm across; half of that down is 26 mm, about 16 beads of 1.6 mm.
    expect(proportionalSide({ width: 200, height: 100 }, delicaBead, 'loom', { columns: 40 })).toBe(16)
  })

  it('counts peyote rows a full bead apart, nothing nesting (ticket 0734)', () => {
    // 30 mm down at 1.5 mm a row is 20 rows.
    expect(proportionalSide({ width: 100, height: 100 }, cubeBead, 'peyote', { columns: 20 })).toBe(20)
  })

  it('turns the bead on brick stitch, whose thread runs down: columns a diameter wide, rows a length tall', () => {
    // 40 beads of 1.6 mm is 64 mm across; half of that down is 32 mm, about 25 beads of 1.3 mm.
    expect(proportionalSide({ width: 200, height: 100 }, delicaBead, 'brick', { columns: 40 })).toBe(25)
  })

  it('never gives fewer than one bead', () => {
    expect(proportionalSide({ width: 1000, height: 1 }, cubeBead, 'loom', { columns: 3 })).toBe(1)
  })
})

describe('isLargeSchema', () => {
  it('is more than 300 beads on a side', () => {
    expect(isLargeSchema({ columns: 300, rows: 300 })).toBe(false)
    expect(isLargeSchema({ columns: 301, rows: 10 })).toBe(true)
  })
})

describe('turn and flip', () => {
  it('turns the picture a quarter clockwise, swapping its sides', () => {
    const turned = turnPicture(picture(3, 2))
    expect([turned.width, turned.height]).toEqual([2, 3])
    // The bottom-left pixel comes to the top-left, the top-left to the top-right.
    expect(pixel(turned, 0, 0)).toEqual([0, 1])
    expect(pixel(turned, 1, 0)).toEqual([0, 0])
    expect(pixel(turned, 1, 2)).toEqual([2, 0])
  })

  it('flips the picture left to right', () => {
    const flipped = flipPicture(picture(3, 2))
    expect([flipped.width, flipped.height]).toEqual([3, 2])
    expect(pixel(flipped, 0, 0)).toEqual([2, 0])
    expect(pixel(flipped, 2, 1)).toEqual([0, 1])
  })
})

describe('convertResult', () => {
  const labels = {
    grid: '{columns}×{rows} beads',
    exact: 'Each {n}×{n} px square of your picture = 1 bead',
    approximate: 'About {x} × {y} px of your picture = 1 bead',
    perPixel: '1 px of your picture = {n} × {n} beads',
    mm: 'mm',
    cm: 'cm',
  }
  const on = (part: { width: number; height: number }, width: number, bead: Bead, technique: 'loom' | 'brick' = 'loom') =>
    sizingFor({ part, width, bead, technique })

  it('reads a mark as the size in beads and cm and the block a bead is', () => {
    expect(convertResult({ bead: delicaBead, technique: 'loom', sizing: on({ width: 256, height: 192 }, 32, delicaBead) }, labels)).toEqual({
      grid: '32×24 beads',
      measured: '4.2 × 3.8 cm',
      ratio: 'Each 8×8 px square of your picture = 1 bead',
    })
  })

  it('measures the size with the bead laid on the Technique\'s thread: swapped on brick stitch (ticket 0734)', () => {
    expect(convertResult({ bead: delicaBead, technique: 'brick', sizing: on({ width: 256, height: 192 }, 32, delicaBead, 'brick') }, labels).measured).toBe('5.1 × 3.1 cm')
  })

  it('reads an enlarging mark as the beads one pixel is', () => {
    expect(convertResult({ bead: cubeBead, technique: 'loom', sizing: on({ width: 16, height: 12 }, 64, cubeBead) }, labels).ratio).toBe('1 px of your picture = 4 × 4 beads')
  })

  it('reads a Width between marks as pixels per bead, about, in the language\'s decimal sign', () => {
    // 40 Delicas are 52 mm across, the picture 30 mm tall at that: 19 rows of 1.6 mm.
    const sizing = on({ width: 172, height: 100 }, 40, delicaBead)
    expect(convertResult({ bead: delicaBead, technique: 'loom', sizing }, labels).ratio).toBe('About 4.3 × 5.3 px of your picture = 1 bead')
    expect(convertResult({ bead: delicaBead, technique: 'loom', sizing }, labels, 'ru').ratio).toBe('About 4,3 × 5,3 px of your picture = 1 bead')
  })
})
