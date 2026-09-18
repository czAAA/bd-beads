import { describe, expect, it } from 'vitest'
import type { Bead } from './beads'
import { computeGridDimensions, type Technique } from './grid'
import { fromHex } from './imageColors'
import { CENTERED_PAN, frameSizeMm, framingView, previewLattice } from './imageFraming'
import {
  ACCEPTED_IMAGE_FORMATS,
  DEFAULT_MAX_IMAGE_COLORS,
  IMAGE_MAX_BYTES,
  IMAGE_MAX_MEGABYTES,
  IMAGE_MAX_MEGAPIXELS,
  IMAGE_MAX_PIXELS,
  MAX_IMAGE_COLORS,
  MIN_IMAGE_COLORS,
  clampMaxImageColors,
  convertImage,
  convertSampledFrame,
  imageInputAccept,
  formatImageLimits,
  pixelColorAt,
  sampleLattice,
  validateImageFile,
  validateImagePixelCount,
  type PixelData,
} from './imageConversion'

const cubeBead: Bead = {
  id: 'test-cube',
  brand: 'Test',
  name: 'Cube',
  size: '1.5mm',
  formFactor: 'cube',
  color: null,
  widthMm: 1.5,
  heightMm: 1.5,
}

const delicaBead: Bead = { ...cubeBead, id: 'test-delica', widthMm: 1.6, heightMm: 1.3 }

/** A picture built from one RGBA quadruple per pixel, row by row — the shape a decoded image arrives in. */
function pixels(width: number, height: number, rgba: number[][]): PixelData {
  return { width, height, data: new Uint8ClampedArray(rgba.flat()) }
}

/** Every pixel the same opaque color. */
function flat(width: number, height: number, [r, g, b]: [number, number, number]): PixelData {
  return pixels(
    width,
    height,
    Array.from({ length: width * height }, () => [r, g, b, 255]),
  )
}

/**
 * A picture whose every pixel says where it is: red carries its x, green its y. Sampling it and reading the channels
 * back tells a test exactly which pixel each cell took, which is how the technique-aware geometry is checked.
 */
function coordinateImage(width: number, height: number): PixelData {
  const rgba: number[][] = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      rgba.push([x, y, 0, 255])
    }
  }
  return pixels(width, height, rgba)
}

/** Which pixel a cell of a coordinateImage conversion sampled. */
function sampledPixel(hex: string): { x: number; y: number } {
  const { r, g } = fromHex(hex)
  return { x: r, y: g }
}

function convert(
  image: PixelData,
  technique: Technique,
  size: { widthMm: number; heightMm: number },
  bead: Bead = cubeBead,
  maxColors = 4096,
) {
  const dimensions = computeGridDimensions(size, bead)
  const frame = frameSizeMm(technique, dimensions, bead)
  const view = framingView(image, frame, 1, CENTERED_PAN)
  return { dimensions, ...convertImage({ image, view, technique, bead, dimensions, maxColors }) }
}

describe('pixelColorAt', () => {
  it('reads an opaque pixel as its own color', () => {
    expect(pixelColorAt(pixels(1, 1, [[18, 52, 86, 255]]), 0, 0)).toBe('#123456')
  })

  it('leaves a pixel below half alpha unpainted, so a transparent background becomes a shape', () => {
    expect(pixelColorAt(pixels(1, 1, [[18, 52, 86, 0]]), 0, 0)).toBeUndefined()
    expect(pixelColorAt(pixels(1, 1, [[18, 52, 86, 127]]), 0, 0)).toBeUndefined()
  })

  it('composites a pixel at or above half alpha over white', () => {
    // Half-transparent black over white is mid grey, not black.
    expect(pixelColorAt(pixels(1, 1, [[0, 0, 0, 128]]), 0, 0)).toBe('#7f7f7f')
    expect(pixelColorAt(pixels(1, 1, [[0, 0, 0, 255]]), 0, 0)).toBe('#000000')
  })

  it('addresses pixels row by row', () => {
    const image = pixels(2, 2, [
      [1, 0, 0, 255],
      [2, 0, 0, 255],
      [3, 0, 0, 255],
      [4, 0, 0, 255],
    ])

    expect(pixelColorAt(image, 0, 0)).toBe('#010000')
    expect(pixelColorAt(image, 1, 0)).toBe('#020000')
    expect(pixelColorAt(image, 0, 1)).toBe('#030000')
    expect(pixelColorAt(image, 1, 1)).toBe('#040000')
  })
})

describe('input limits', () => {
  it('states them once, and derives the byte and pixel counts from what the UI advertises', () => {
    expect(IMAGE_MAX_MEGABYTES).toBe(10)
    expect(IMAGE_MAX_BYTES).toBe(10 * 1024 * 1024)
    expect(IMAGE_MAX_MEGAPIXELS).toBe(16)
    expect(IMAGE_MAX_PIXELS).toBe(16_000_000)
  })

  it('offers the accepted formats to the file input', () => {
    const accept = imageInputAccept()

    for (const format of ACCEPTED_IMAGE_FORMATS) {
      expect(accept).toContain(format.mimeType)
      for (const extension of format.extensions) {
        expect(accept).toContain(extension)
      }
    }
  })

  it('fills the advertised limits into a localised sentence, so the copy cannot drift from the validation', () => {
    const filled = formatImageLimits('{formats} / {maxSizeMb} / {maxMegapixels}')

    expect(filled).toBe('PNG, JPEG, GIF, WebP / 10 / 16')
    expect(filled).not.toContain('{')
  })
})

describe('validateImageFile', () => {
  it('accepts PNG, JPEG, GIF and WebP', () => {
    for (const format of ACCEPTED_IMAGE_FORMATS) {
      expect(validateImageFile({ name: `art${format.extensions[0]}`, type: format.mimeType, size: 1000 })).toBeUndefined()
    }
  })

  it('rejects HEIC by its own media type', () => {
    expect(validateImageFile({ name: 'photo.heic', type: 'image/heic', size: 1000 })).toBe('heic')
    expect(validateImageFile({ name: 'photo.HEIF', type: 'image/heif', size: 1000 })).toBe('heic')
  })

  it('rejects HEIC by extension too, since a phone often reports no media type at all for one', () => {
    expect(validateImageFile({ name: 'IMG_0001.HEIC', type: '', size: 1000 })).toBe('heic')
  })

  it('rejects SVG with its own reason', () => {
    expect(validateImageFile({ name: 'logo.svg', type: 'image/svg+xml', size: 1000 })).toBe('svg')
    expect(validateImageFile({ name: 'logo.svg', type: '', size: 1000 })).toBe('svg')
  })

  it('rejects anything else as an unsupported format', () => {
    expect(validateImageFile({ name: 'art.bmp', type: 'image/bmp', size: 1000 })).toBe('unsupportedFormat')
    expect(validateImageFile({ name: 'notes.txt', type: 'text/plain', size: 1000 })).toBe('unsupportedFormat')
  })

  it('accepts a supported extension when the browser reports no media type', () => {
    expect(validateImageFile({ name: 'art.PNG', type: '', size: 1000 })).toBeUndefined()
  })

  it('rejects a file past the size limit', () => {
    expect(validateImageFile({ name: 'art.png', type: 'image/png', size: IMAGE_MAX_BYTES })).toBeUndefined()
    expect(validateImageFile({ name: 'art.png', type: 'image/png', size: IMAGE_MAX_BYTES + 1 })).toBe('tooLarge')
  })
})

describe('validateImagePixelCount', () => {
  it('accepts a picture at the resolution limit and rejects one past it', () => {
    expect(validateImagePixelCount({ width: 4000, height: 4000 })).toBeUndefined()
    expect(validateImagePixelCount({ width: 4001, height: 4000 })).toBe('tooManyPixels')
  })
})

describe('clampMaxImageColors', () => {
  it('keeps the adjustable color count inside its range', () => {
    expect(clampMaxImageColors(0)).toBe(MIN_IMAGE_COLORS)
    expect(clampMaxImageColors(1000)).toBe(MAX_IMAGE_COLORS)
    expect(clampMaxImageColors(6.4)).toBe(6)
    expect(DEFAULT_MAX_IMAGE_COLORS).toBe(clampMaxImageColors(DEFAULT_MAX_IMAGE_COLORS))
  })
})

describe('convertImage', () => {
  it('gives every cell of the grid the color of the picture under it', () => {
    // A 2 x 2 picture into a 2 x 2 grid: each cell covers exactly one pixel.
    const image = pixels(2, 2, [
      [255, 0, 0, 255],
      [0, 255, 0, 255],
      [0, 0, 255, 255],
      [255, 255, 255, 255],
    ])

    const { grid } = convert(image, 'loom', { widthMm: 3, heightMm: 3 })

    expect(grid.map((row) => row.map((cell) => cell.color))).toEqual([
      ['#ff0000', '#00ff00'],
      ['#0000ff', '#ffffff'],
    ])
  })

  it('produces a grid of exactly the Pattern dimensions', () => {
    const { grid, dimensions } = convert(coordinateImage(20, 20), 'loom', { widthMm: 15, heightMm: 30 })

    expect(dimensions).toEqual({ columns: 10, rows: 20 })
    expect(grid).toHaveLength(20)
    expect(grid[0]).toHaveLength(10)
  })

  it('converts a picture already inside the color limit losslessly', () => {
    const image = pixels(2, 2, [
      [255, 0, 0, 255],
      [0, 255, 0, 255],
      [0, 0, 255, 255],
      [17, 17, 17, 255],
    ])

    const { imageColors } = convert(image, 'loom', { widthMm: 3, heightMm: 3 }, cubeBead, 8)

    expect(new Set(imageColors)).toEqual(new Set(['#ff0000', '#00ff00', '#0000ff', '#111111']))
  })

  it('reduces a busier picture to the color count asked for', () => {
    const many = pixels(
      8,
      8,
      Array.from({ length: 64 }, (_unused, index) => [index * 3, 255 - index * 3, 128, 255]),
    )

    const { imageColors, grid } = convert(many, 'loom', { widthMm: 12, heightMm: 12 }, cubeBead, 5)

    expect(imageColors.length).toBeLessThanOrEqual(5)
    for (const row of grid) {
      for (const cell of row) {
        expect(imageColors).toContain(cell.color)
      }
    }
  })

  it('saves only the colors the conversion actually put on the grid', () => {
    const { imageColors, grid } = convert(flat(4, 4, [10, 20, 30]), 'loom', { widthMm: 6, heightMm: 6 })

    expect(imageColors).toEqual(['#0a141e'])
    expect(grid.flat().every((cell) => cell.color === '#0a141e')).toBe(true)
  })

  it('leaves a fully transparent picture with no cells painted and no Image colors', () => {
    const invisible = pixels(
      2,
      2,
      Array.from({ length: 4 }, () => [255, 0, 0, 0]),
    )

    const { grid, imageColors } = convert(invisible, 'loom', { widthMm: 3, heightMm: 3 })

    expect(imageColors).toEqual([])
    expect(grid.flat().every((cell) => cell.color === null)).toBe(true)
  })

  it('turns a transparent background into empty cells around a shape', () => {
    const dot = pixels(2, 2, [
      [0, 0, 0, 0],
      [255, 0, 0, 255],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ])

    const { grid } = convert(dot, 'loom', { widthMm: 3, heightMm: 3 })

    expect(grid.map((row) => row.map((cell) => cell.color))).toEqual([
      [null, '#ff0000'],
      [null, null],
    ])
  })

  it('upscales a picture smaller than the grid rather than leaving the frame unfilled', () => {
    const { grid, imageColors } = convert(flat(1, 1, [1, 2, 3]), 'loom', { widthMm: 15, heightMm: 15 })

    expect(imageColors).toEqual(['#010203'])
    expect(grid.flat()).toHaveLength(100)
    expect(grid.flat().every((cell) => cell.color === '#010203')).toBe(true)
  })

  it('converts a single-pixel picture', () => {
    const { grid } = convert(flat(1, 1, [255, 255, 255]), 'loom', { widthMm: 1.5, heightMm: 1.5 })

    expect(grid).toEqual([[{ color: '#ffffff' }]])
  })

  it('samples a loom row straight across, with no stagger', () => {
    // 9 pixels across a 4-cell frame puts about one pixel on every half cell, so a half-cell stagger shows as a
    // one-pixel shift. The picture is deliberately tall enough that its width is what the cover scale follows.
    const { grid } = convert(coordinateImage(9, 20), 'loom', { widthMm: 6, heightMm: 6 })

    const firstColumn = grid.map((row) => sampledPixel(row[0]!.color!).x)
    expect(new Set(firstColumn).size).toBe(1)
  })

  it('reproduces the peyote and brick stitch half-cell stagger on odd rows', () => {
    for (const technique of ['peyote', 'brick'] as const) {
      const { grid } = convert(coordinateImage(9, 20), technique, { widthMm: 6, heightMm: 6 })

      const evenRow = sampledPixel(grid[0]![0]!.color!).x
      const oddRow = sampledPixel(grid[1]![0]!.color!).x
      const nextEvenRow = sampledPixel(grid[2]![0]!.color!).x

      expect(oddRow).toBeGreaterThan(evenRow)
      expect(nextEvenRow).toBe(evenRow)
    }
  })

  it('packs peyote rows tighter than brick stitch, so its rows walk down the picture more slowly', () => {
    // Same frame, same picture: peyote's rows are 0.75 of a cell apart, brick's a full cell.
    const image = coordinateImage(40, 40)
    const size = { widthMm: 15, heightMm: 15 }

    const peyote = convert(image, 'peyote', size)
    const brick = convert(image, 'brick', size)

    const lastPeyoteRow = sampledPixel(peyote.grid.at(-1)![0]!.color!).y
    const lastBrickRow = sampledPixel(brick.grid.at(-1)![0]!.color!).y

    expect(lastPeyoteRow).toBeLessThan(lastBrickRow)
  })

  it('does not distort a picture just because the Bead footprint is not square', () => {
    // A Delica grid of a square physical size samples the same square region of the picture as a cube Bead does.
    const image = coordinateImage(60, 60)

    const cube = convert(image, 'loom', { widthMm: 15, heightMm: 15 }, cubeBead)
    const delica = convert(image, 'loom', { widthMm: 15, heightMm: 15 }, delicaBead)

    const cubeCorner = sampledPixel(cube.grid.at(-1)!.at(-1)!.color!)
    const delicaCorner = sampledPixel(delica.grid.at(-1)!.at(-1)!.color!)

    expect(delica.dimensions).not.toEqual(cube.dimensions)
    expect(delicaCorner.x).toBeCloseTo(cubeCorner.x, -1)
    expect(delicaCorner.y).toBeCloseTo(cubeCorner.y, -1)
  })
})

describe('sampleLattice with convertSampledFrame', () => {
  it('converts exactly the cells the preview shows inside the frame', () => {
    const image = coordinateImage(40, 20)
    const technique: Technique = 'peyote'
    const dimensions = computeGridDimensions({ widthMm: 15, heightMm: 15 }, cubeBead)
    const frame = frameSizeMm(technique, dimensions, cubeBead)
    const view = framingView(image, frame, 1.5, { x: 0.3, y: 0.7 })
    const lattice = previewLattice({ view, frame, dimensions, bead: cubeBead, technique })

    const sampled = sampleLattice({ image, view, technique, bead: cubeBead, lattice })
    const fromPreview = convertSampledFrame(sampled, lattice, dimensions, 4096)
    const direct = convertImage({ image, view, technique, bead: cubeBead, dimensions, maxColors: 4096 })

    expect(lattice.frameColumn).toBeGreaterThan(0)
    expect(fromPreview.grid).toEqual(direct.grid)
    expect(fromPreview.imageColors).toEqual(direct.imageColors)
  })

  it('has nothing to show for a lattice cell that falls off the picture', () => {
    const image = coordinateImage(20, 10)
    const dimensions = { columns: 4, rows: 4 }
    const frame = frameSizeMm('loom', dimensions, cubeBead)
    const view = framingView(image, frame, 1, CENTERED_PAN)
    const lattice = { columns: 12, rows: 12, frameColumn: 4, frameRow: 4 }

    const sampled = sampleLattice({ image, view, technique: 'loom', bead: cubeBead, lattice })

    expect(sampled).toHaveLength(12)
    expect(sampled[0]![0]).toBeUndefined()
    expect(sampled[lattice.frameRow]![lattice.frameColumn]).toBeDefined()
  })
})
