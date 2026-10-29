// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Bead } from './beads'
import {
  RATIO_PRESETS,
  convertResult,
  cropForView,
  flipPicture,
  fullCrop,
  isLargeSchema,
  nearestRatio,
  proportionalSide,
  ratioGrid,
  ratioOfSize,
  snapCrop,
  startingProposal,
  startingSize,
  turnPicture,
  viewForCrop,
} from './convertSize'
import { framingView, frameSizeMm } from './imageFraming'
import type { PixelData } from './imageConversion'

const cubeBead: Bead = {
  id: 'test-cube',
  brand: { id: 'test', name: 'Test' },
  size: '1.5mm',
  formFactor: { id: 'cube', nameKey: 'cube', roundness: 0, holes: { count: 1, direction: 'along' } },
  widthMm: 1.5,
  heightMm: 1.5,
}

const delicaBead: Bead = { ...cubeBead, id: 'test-delica', widthMm: 1.6, heightMm: 1.3 }

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

describe('Pixel to bead ratio', () => {
  it('offers 1:4, 1:2, 1:1, 2:1, 4:1 and 8:1', () => {
    expect(RATIO_PRESETS.map(({ pixels, beads }) => `${pixels}:${beads}`)).toEqual(['1:4', '1:2', '1:1', '2:1', '4:1', '8:1'])
  })

  it('makes one bead of every n × n pixel block, a part block counting as a bead', () => {
    expect(ratioGrid({ x: 0, y: 0, width: 64, height: 48 }, { pixels: 2, beads: 1 })).toEqual({ columns: 32, rows: 24 })
    expect(ratioGrid({ x: 0, y: 0, width: 65, height: 47 }, { pixels: 2, beads: 1 })).toEqual({ columns: 33, rows: 24 })
  })

  it('makes n × n beads of every pixel the other way', () => {
    expect(ratioGrid({ x: 0, y: 0, width: 16, height: 12 }, { pixels: 1, beads: 4 })).toEqual({ columns: 64, rows: 48 })
  })

  it('counts only the cropped pixels', () => {
    expect(ratioGrid({ x: 8, y: 4, width: 16, height: 8 }, { pixels: 4, beads: 1 })).toEqual({ columns: 4, rows: 2 })
  })
})

describe('snapCrop', () => {
  const image = { width: 50, height: 30 }

  it('snaps every edge to a whole block counted from the picture corner', () => {
    expect(snapCrop({ x: 3, y: 5, width: 21, height: 13 }, { pixels: 4, beads: 1 }, image)).toEqual({ x: 4, y: 4, width: 20, height: 16 })
  })

  it('lets the far edge sit on the picture edge, where the last block is a part block', () => {
    expect(snapCrop({ x: 0, y: 0, width: 50, height: 30 }, { pixels: 4, beads: 1 }, image)).toEqual({ x: 0, y: 0, width: 50, height: 30 })
    expect(snapCrop({ x: 40, y: 0, width: 9.6, height: 30 }, { pixels: 4, beads: 1 }, image)).toEqual({ x: 40, y: 0, width: 10, height: 30 })
  })

  it('keeps at least one block and stays on the picture', () => {
    expect(snapCrop({ x: 10, y: -6, width: 0.5, height: 80 }, { pixels: 4, beads: 1 }, image)).toEqual({ x: 12, y: 0, width: 4, height: 30 })
  })

  it('snaps to whole pixels when one pixel is several beads', () => {
    expect(snapCrop({ x: 2.4, y: 1.6, width: 10.2, height: 4.4 }, { pixels: 1, beads: 2 }, image)).toEqual({ x: 2, y: 2, width: 11, height: 4 })
  })
})

describe('startingProposal', () => {
  it('starts a small picture by ratio, at the preset giving the most beads up to 150 on the long side', () => {
    expect(startingProposal({ width: 64, height: 32 })).toEqual({ mode: 'ratio', ratio: { pixels: 1, beads: 2 } })
    expect(startingProposal({ width: 150, height: 90 })).toEqual({ mode: 'ratio', ratio: { pixels: 1, beads: 1 } })
    expect(startingProposal({ width: 300, height: 399 })).toEqual({ mode: 'ratio', ratio: { pixels: 4, beads: 1 } })
  })

  it('starts a picture of about 400 px or more on its long side by size', () => {
    expect(startingProposal({ width: 400, height: 300 }).mode).toBe('size')
    expect(startingProposal({ width: 300, height: 1200 }).mode).toBe('size')
  })

  it('falls back to 1:1 when no preset keeps to 150 beads', () => {
    expect(startingProposal({ width: 4000, height: 3000 }).ratio).toEqual({ pixels: 1, beads: 1 })
  })
})

describe('startingSize', () => {
  it('is the starting ratio’s Schema when it keeps to 150 beads', () => {
    expect(startingSize({ width: 600, height: 400 }, cubeBead, 'loom')).toEqual({ columns: 150, rows: 100 })
  })

  it('is the picture’s shape at 150 beads on its long side for a larger picture, either way up', () => {
    expect(startingSize({ width: 3000, height: 1500 }, cubeBead, 'loom')).toEqual({ columns: 150, rows: 75 })
    expect(startingSize({ width: 1500, height: 3000 }, cubeBead, 'loom')).toEqual({ columns: 75, rows: 150 })
  })
})

describe('proportionalSide', () => {
  it('gives the other side from the picture shape on a square bead', () => {
    expect(proportionalSide({ width: 200, height: 100 }, cubeBead, 'loom', { columns: 40 })).toBe(20)
    expect(proportionalSide({ width: 200, height: 100 }, cubeBead, 'loom', { rows: 20 })).toBe(40)
  })

  it('keeps the physical shape on a bead taller or wider than it is long', () => {
    // 40 beads of 1.6 mm is 64 mm across; half of that down is 32 mm, about 25 beads of 1.3 mm.
    expect(proportionalSide({ width: 200, height: 100 }, delicaBead, 'loom', { columns: 40 })).toBe(25)
  })

  it('counts peyote rows at their nested spacing', () => {
    // 30 mm down at 0.75 × 1.5 mm a row is 27 rows (rounded).
    expect(proportionalSide({ width: 100, height: 100 }, cubeBead, 'peyote', { columns: 20 })).toBe(27)
  })

  it('never gives fewer than one bead', () => {
    expect(proportionalSide({ width: 1000, height: 1 }, cubeBead, 'loom', { columns: 3 })).toBe(1)
  })
})

describe('mode switch', () => {
  it('names the nearest ratio for a size, both ways', () => {
    expect(nearestRatio(3.4)).toEqual({ pixels: 3, beads: 1 })
    expect(nearestRatio(1)).toEqual({ pixels: 1, beads: 1 })
    expect(nearestRatio(0.3)).toEqual({ pixels: 1, beads: 3 })
    expect(nearestRatio(500)).toEqual({ pixels: 32, beads: 1 })
  })

  it('reads a size as pixels per bead along each side', () => {
    expect(ratioOfSize({ x: 0, y: 0, width: 172, height: 129.5 }, { columns: 40, rows: 37 })).toEqual({ x: 4.3, y: 3.5 })
  })

  it('carries what is framed across as the crop, and the crop back as the view', () => {
    const image = { width: 400, height: 300 }
    const frame = frameSizeMm('loom', { columns: 20, rows: 20 }, cubeBead)
    const view = framingView(image, frame, 2, { x: 0.25, y: 1 })
    const crop = cropForView(image, frame, view)
    expect(crop).toEqual({ x: 62.5, y: 150, width: 150, height: 150 })
    expect(viewForCrop(image, frame, crop)).toEqual({ zoom: 2, pan: { x: 0.25, y: 1 } })
  })

  it('frames the whole picture again for a crop it cannot cover', () => {
    const image = { width: 400, height: 300 }
    const frame = frameSizeMm('loom', { columns: 20, rows: 20 }, cubeBead)
    expect(viewForCrop(image, frame, fullCrop(image))).toEqual({ zoom: 1, pan: { x: 0.5, y: 0.5 } })
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
    exact: '1 bead = {n} × {n} px',
    approximate: '1 bead ≈ {x} × {y} px',
    perPixel: '1 px = {n} × {n} beads',
    mm: 'mm',
    cm: 'cm',
  }

  it('reads a ratio as the size in beads and cm and the block a bead is', () => {
    expect(convertResult({ grid: { columns: 32, rows: 24 }, bead: delicaBead, ratio: { pixels: 8, beads: 1 } }, labels)).toEqual({
      grid: '32×24 beads',
      measured: '5.1 × 3.1 cm',
      ratio: '1 bead = 8 × 8 px',
    })
  })

  it('reads 1:n as the beads one pixel is', () => {
    expect(convertResult({ grid: { columns: 64, rows: 48 }, bead: cubeBead, ratio: { pixels: 1, beads: 4 } }, labels).ratio).toBe('1 px = 4 × 4 beads')
  })

  it('reads a size as pixels per bead, approximate unless it is a whole ratio', () => {
    const crop = { x: 0, y: 0, width: 172, height: 129.5 }
    expect(convertResult({ grid: { columns: 40, rows: 37 }, bead: delicaBead, crop }, labels).ratio).toBe('1 bead ≈ 4.3 × 3.5 px')
    expect(convertResult({ grid: { columns: 40, rows: 37 }, bead: delicaBead, crop }, labels, 'ru').ratio).toBe('1 bead ≈ 4,3 × 3,5 px')
    expect(convertResult({ grid: { columns: 20, rows: 10 }, bead: cubeBead, crop: { x: 0, y: 0, width: 40, height: 20 } }, labels).ratio).toBe('1 bead = 2 × 2 px')
    expect(convertResult({ grid: { columns: 20, rows: 10 }, bead: cubeBead, crop: { x: 0, y: 0, width: 10, height: 5 } }, labels).ratio).toBe('1 px = 2 × 2 beads')
  })
})
