// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { GridDimensions } from './grid'
import { cellCenter, type Technique, type TechniqueSettings } from './weave'
import { channelsOf } from './color'
import { partLattice, type PreviewLattice } from './imageFraming'
import { reducePictureColors } from './imageColors'
import { convertFrame, matchFoundColors, sourceTargets } from './convertColors'
import { BUILT_IN_COLORS } from './palette'
import type { Grid } from './project'
import type { PixelCrop } from './convertSize'
import {
  ACCEPTED_IMAGE_FORMATS,
  IMAGE_MAX_BYTES,
  IMAGE_MAX_MEGABYTES,
  IMAGE_MAX_MEGAPIXELS,
  IMAGE_MAX_PIXELS,
  frameColors,
  imageInputAccept,
  formatImageLimits,
  NO_COLOR,
  packedToHex,
  pixelPackedAt,
  sampleLatticePacked,
  validateImageFile,
  validateImagePixelCount,
  type PixelData,
} from './imageConversion'

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

/** A picture whose every pixel says where it is (red carries x, green y), so sampling it shows exactly which pixel
 * each cell took. */
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
  const { r, g } = channelsOf(hex)
  return { x: r, y: g }
}

/** The color a picture's pixel contributes to a cell as the `#rrggbb` a grid cell stores, or undefined for a pixel
 * too transparent to weave. */
function pixelColorAt(image: PixelData, x: number, y: number): string | undefined {
  const packed = pixelPackedAt(image, x, y)
  return packed === NO_COLOR ? undefined : packedToHex(packed)
}

/** The whole picture as the part, each bead standing for the pixels that put the grid over it. */
function wholePicture(image: PixelData, dimensions: GridDimensions) {
  return { part: { x: 0, y: 0, width: image.width, height: image.height }, pixelsPerBead: { x: image.width / dimensions.columns, y: image.height / dimensions.rows } }
}

/** The picture's raw colors for every cell of a lattice, as `#rrggbb` strings. */
function sampleLattice(input: Parameters<typeof sampleLatticePacked>[0]): (string | undefined)[][] {
  const { lattice } = input
  const packed = sampleLatticePacked(input)
  return Array.from({ length: lattice.rows }, (_row, row) =>
    Array.from({ length: lattice.columns }, (_cell, column) => {
      const color = packed[row * lattice.columns + column]!
      return color === NO_COLOR ? undefined : packedToHex(color)
    }),
  )
}

/** One Convert image matched to the Default Palette, from a lattice already sampled. */
function convertSampled(sampled: Int32Array, lattice: PreviewLattice, dimensions: GridDimensions, maxColors: number): { grid: Grid; imageColors: string[] } {
  const { raw, counts } = frameColors(sampled, lattice, dimensions)
  const reduced = reducePictureColors(counts, maxColors)
  const found = matchFoundColors(reduced, sourceTargets('default', BUILT_IN_COLORS, []), new Map())
  return { grid: convertFrame(raw, reduced, found), imageColors: [...new Set(found.map((color) => color.result!.hex))] }
}

/** One Convert image of the whole picture onto a grid, the frame the whole lattice. */
function convert(image: PixelData, technique: Technique, dimensions: GridDimensions, maxColors = 4096): { grid: Grid; imageColors: string[] } {
  const lattice: PreviewLattice = { ...dimensions, frameColumn: 0, frameRow: 0 }
  return convertSampled(sampleLatticePacked({ image, technique, ...wholePicture(image, dimensions), lattice }), lattice, dimensions, maxColors)
}

/** The grid's raw sampled colors, before Convert image snaps them onto the Palette (ticket 177), which would
 * otherwise obscure which source pixel each cell picked (nearby markers can snap to one color). */
function convertRawGrid(image: PixelData, technique: Technique, dimensions: GridDimensions): (string | undefined)[][] {
  const lattice: PreviewLattice = { ...dimensions, frameColumn: 0, frameRow: 0 }
  return sampleLattice({ image, technique, ...wholePicture(image, dimensions), lattice })
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

describe('pixelPackedAt', () => {
  it('says NO_COLOR for a pixel below half alpha', () => {
    expect(pixelPackedAt(pixels(1, 1, [[18, 52, 86, 127]]), 0, 0)).toBe(NO_COLOR)
  })

  it('writes a packed color as a #rrggbb with its leading zeros', () => {
    expect(packedToHex(0x000102)).toBe('#000102')
    expect(packedToHex(0)).toBe('#000000')
  })
})

describe('sampleLatticePacked', () => {
  /** What one cell took, the way it was worked out before sampling ran a row at a time: cellCenter, then the pixel
   * under it, then the pixel's color. */
  function cellByCell(
    image: PixelData,
    technique: Technique,
    part: PixelCrop,
    pixelsPerBead: { x: number; y: number },
    lattice: PreviewLattice,
    techniqueSettings?: TechniqueSettings,
  ): (string | undefined)[] {
    // The frame's first row and column are never shifted, so its corner is a whole cell per row and column.
    const originX = lattice.frameColumn * pixelsPerBead.x
    const originY = lattice.frameRow * pixelsPerBead.y
    const cells: (string | undefined)[] = []
    for (let row = 0; row < lattice.rows; row += 1) {
      for (let column = 0; column < lattice.columns; column += 1) {
        const center = cellCenter({ technique, techniqueSettings }, { row, column }, pixelsPerBead.x, pixelsPerBead.y)
        const x = Math.floor(center.x - originX + part.x)
        const y = Math.floor(center.y - originY + part.y)
        const slackX = Math.max(1, pixelsPerBead.x)
        const slackY = Math.max(1, pixelsPerBead.y)
        const onX = x >= image.width && x < image.width + slackX ? image.width - 1 : x
        const onY = y >= image.height && y < image.height + slackY ? image.height - 1 : y
        cells.push(onX < 0 || onY < 0 || onX >= image.width || onY >= image.height ? undefined : pixelColorAt(image, onX, onY))
      }
    }
    return cells
  }

  /** A picture with a bit of everything: every color channel varying, some pixels see-through. */
  function busyImage(width: number, height: number): PixelData {
    const rgba: number[][] = []
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        rgba.push([(x * 37) % 256, (y * 91) % 256, ((x + y) * 13) % 256, (x + 2 * y) % 5 === 0 ? 40 : 255])
      }
    }
    return pixels(width, height, rgba)
  }

  it.each(['loom', 'peyote', 'brick'] as const)('takes exactly the colors sampling cell by cell does, in %s, for any part and pixels per bead', (technique) => {
    const image = busyImage(53, 41)

    for (const part of [{ x: 0, y: 0, width: 53, height: 41 }, { x: 10, y: 7, width: 24, height: 20 }, { x: 40, y: 30, width: 13, height: 11 }]) {
      for (const pixelsPerBead of [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 1.3, y: 1.7 }, { x: 0.5, y: 0.5 }]) {
        const dimensions = { columns: Math.ceil(part.width / pixelsPerBead.x), rows: Math.ceil(part.height / pixelsPerBead.y) }
        const lattice = partLattice({ image, part, pixelsPerBead, dimensions, technique })

        const packed = sampleLatticePacked({ image, part, pixelsPerBead, technique, lattice })

        expect(Array.from(packed, (color) => (color === NO_COLOR ? undefined : packedToHex(color)))).toEqual(
          cellByCell(image, technique, part, pixelsPerBead, lattice),
        )
      }
    }
  })

  it('leaves off-picture cells as NO_COLOR', () => {
    const image = flat(2, 2, [10, 20, 30])

    // A lattice bigger than the picture: 6 × 6 cells with the frame in the middle.
    const packed = sampleLatticePacked({
      image,
      part: { x: 0, y: 0, width: 2, height: 2 },
      pixelsPerBead: { x: 1, y: 1 },
      technique: 'loom',
      lattice: { columns: 6, rows: 6, frameColumn: 2, frameRow: 2 },
    })

    expect(packed[0]).toBe(NO_COLOR)
    expect(packed[2 * 6 + 2]).not.toBe(NO_COLOR)
  })

  it('reads a bead’s whole area at rest, and the centre pixel where a bead is a pixel or less (ticket 0762)', () => {
    // Red, with one white pixel at each 4 × 4 bead's centre: the centre pixel says white, the area red.
    const image = pixels(8, 4, Array.from({ length: 32 }, (_pixel, at) => (at % 8) % 4 === 2 && Math.floor(at / 8) === 2 ? [255, 255, 255, 255] : [200, 0, 0, 255]))
    const input = { image, part: { x: 0, y: 0, width: 8, height: 4 }, technique: 'loom' as const, lattice: { columns: 2, rows: 1, frameColumn: 0, frameRow: 0 } }

    expect(Array.from(sampleLatticePacked({ ...input, pixelsPerBead: { x: 4, y: 4 } }), packedToHex)).toEqual(['#ffffff', '#ffffff'])
    expect(Array.from(sampleLatticePacked({ ...input, pixelsPerBead: { x: 4, y: 4 }, rule: 'area' }), packedToHex)).toEqual(['#c80000', '#c80000'])
    // Enlarging, two beads to a pixel: each its centre pixel.
    const enlarged = { ...input, pixelsPerBead: { x: 0.5, y: 0.5 }, lattice: { columns: 16, rows: 8, frameColumn: 0, frameRow: 0 } }
    expect(sampleLatticePacked({ ...enlarged, rule: 'area' })).toEqual(sampleLatticePacked(enlarged))
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

describe('convertImage', () => {
  it('gives every cell of the grid the Palette color nearest the picture under it (ticket 177)', () => {
    // A 2 x 2 picture into a 2 x 2 grid: each cell covers exactly one pixel.
    const image = pixels(2, 2, [
      [255, 0, 0, 255],
      [0, 160, 0, 255],
      [0, 0, 255, 255],
      [255, 255, 255, 255],
    ])

    const { grid } = convert(image, 'loom', { columns: 2, rows: 2 })

    expect(grid.map((row) => row.map((cell) => cell.color))).toEqual([
      ['#e63746', '#27ae60'], // Palette red, green
      ['#2f6fed', '#ffffff'], // Palette blue, white
    ])
  })

  it('produces a grid of exactly the Project dimensions', () => {
    const { grid } = convert(coordinateImage(20, 20), 'loom', { columns: 10, rows: 20 })

    expect(grid).toHaveLength(20)
    expect(grid[0]).toHaveLength(10)
  })

  it('keeps a picture already inside the color limit as distinct Palette colors, one per pixel', () => {
    const image = pixels(2, 2, [
      [255, 0, 0, 255],
      [0, 160, 0, 255],
      [0, 0, 255, 255],
      [17, 17, 17, 255],
    ])

    const { imageColors } = convert(image, 'loom', { columns: 2, rows: 2 }, 8)

    expect(new Set(imageColors)).toEqual(new Set(['#e63746', '#27ae60', '#2f6fed', '#1a1a1a']))
  })

  it('reduces a busier picture to the color count asked for', () => {
    const many = pixels(
      8,
      8,
      Array.from({ length: 64 }, (_unused, index) => [index * 3, 255 - index * 3, 128, 255]),
    )

    const { imageColors, grid } = convert(many, 'loom', { columns: 8, rows: 8 }, 5)

    expect(imageColors.length).toBeLessThanOrEqual(5)
    for (const row of grid) {
      for (const cell of row) {
        expect(imageColors).toContain(cell.color)
      }
    }
  })

  it('saves only the colors the conversion actually put on the grid', () => {
    const { imageColors, grid } = convert(flat(4, 4, [10, 20, 30]), 'loom', { columns: 4, rows: 4 })

    expect(imageColors).toEqual(['#1a1a1a']) // nearest Palette color to #0a141e is black
    expect(grid.flat().every((cell) => cell.color === '#1a1a1a')).toBe(true)
  })

  it('leaves a fully transparent picture with no cells painted and no Image colors', () => {
    const invisible = pixels(
      2,
      2,
      Array.from({ length: 4 }, () => [255, 0, 0, 0]),
    )

    const { grid, imageColors } = convert(invisible, 'loom', { columns: 2, rows: 2 })

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

    const { grid } = convert(dot, 'loom', { columns: 2, rows: 2 })

    expect(grid.map((row) => row.map((cell) => cell.color))).toEqual([
      [null, '#e63746'], // Palette red
      [null, null],
    ])
  })

  it('makes every pixel many beads when the grid is bigger than the picture, leaving no bead unfilled', () => {
    const { grid, imageColors } = convert(flat(1, 1, [1, 2, 3]), 'loom', { columns: 10, rows: 10 })

    expect(imageColors).toEqual(['#1a1a1a']) // nearest Palette color to #010203 is black
    expect(grid.flat()).toHaveLength(100)
    expect(grid.flat().every((cell) => cell.color === '#1a1a1a')).toBe(true)
  })

  it('converts a single-pixel picture', () => {
    const { grid } = convert(flat(1, 1, [255, 255, 255]), 'loom', { columns: 1, rows: 1 })

    expect(grid).toEqual([[{ color: '#ffffff' }]])
  })

  it('samples a loom row straight across, with no stagger', () => {
    // 9 pixels across a 4-cell frame puts about one pixel on every half cell, so a half-cell stagger shows as a
    // one-pixel shift.
    const grid = convertRawGrid(coordinateImage(9, 20), 'loom', { columns: 4, rows: 9 })

    const firstColumn = grid.map((row) => sampledPixel(row[0]!).x)
    expect(new Set(firstColumn).size).toBe(1)
  })

  it('reproduces brick stitch\'s half-cell stagger on odd rows', () => {
    // Sampled below Convert image's Palette quantization (ticket 177): the raw marker colors coordinateImage relies
    // on to decode which pixel a cell sampled would otherwise collapse onto the same nearest Palette color.
    const grid = convertRawGrid(coordinateImage(9, 20), 'brick', { columns: 4, rows: 9 })

    const evenRow = sampledPixel(grid[0]![0]!).x
    const oddRow = sampledPixel(grid[1]![0]!).x
    const nextEvenRow = sampledPixel(grid[2]![0]!).x

    expect(oddRow).toBeGreaterThan(evenRow)
    expect(nextEvenRow).toBe(evenRow)
  })

  it('reproduces peyote\'s half-cell stagger on odd columns, down the picture (ticket 0734)', () => {
    const grid = convertRawGrid(coordinateImage(20, 9), 'peyote', { columns: 9, rows: 4 })

    const evenColumn = sampledPixel(grid[0]![0]!).y
    const oddColumn = sampledPixel(grid[0]![1]!).y
    const nextEvenColumn = sampledPixel(grid[0]![2]!).y

    expect(oddColumn).toBeGreaterThan(evenColumn)
    expect(nextEvenColumn).toBe(evenColumn)
    // Its rows are straight across: the first row of every even column samples the same height.
    expect(sampledPixel(grid[1]![0]!).y).toBe(sampledPixel(grid[1]![2]!).y)
  })

  it('walks peyote\'s rows a full bead apart, as loom\'s, nothing nesting (ticket 0734)', () => {
    const image = coordinateImage(60, 60)
    const [peyote, loom] = [convertRawGrid(image, 'peyote', { columns: 10, rows: 10 }), convertRawGrid(image, 'loom', { columns: 10, rows: 10 })]

    expect(peyote).toHaveLength(loom.length)
    const step = (grid: typeof peyote) => sampledPixel(grid[2]![0]!).y - sampledPixel(grid[1]![0]!).y
    expect(step(peyote) / step(loom)).toBeCloseTo(1, 1)
  })
})

describe('frameColors', () => {
  it('converts exactly the cells the preview shows inside the frame', () => {
    const image = coordinateImage(40, 20)
    const technique: Technique = 'peyote'
    const part = { x: 12, y: 4, width: 20, height: 12 }
    const pixelsPerBead = { x: 2, y: 2 }
    const dimensions = { columns: 10, rows: 6 }
    const lattice = partLattice({ image, part, pixelsPerBead, dimensions, technique })

    const sampled = sampleLatticePacked({ image, part, pixelsPerBead, technique, lattice })
    const fromPreview = convertSampled(sampled, lattice, dimensions, 4096)
    const frameOnly: PreviewLattice = { ...dimensions, frameColumn: 0, frameRow: 0 }
    const direct = convertSampled(sampleLatticePacked({ image, part, pixelsPerBead, technique, lattice: frameOnly }), frameOnly, dimensions, 4096)

    expect(lattice.frameColumn).toBeGreaterThan(0)
    expect(fromPreview).toEqual(direct)
  })

  it('counts the beads each sampled color covers, none for an empty one', () => {
    const lattice: PreviewLattice = { columns: 2, rows: 1, frameColumn: 0, frameRow: 0 }
    const { raw, counts } = frameColors(Int32Array.from([0xff0000, NO_COLOR]), lattice, { columns: 2, rows: 1 })
    expect(raw).toEqual([['#ff0000', undefined]])
    expect([...counts]).toEqual([['#ff0000', 1]])
  })
})

describe('sampling the part (spec 0645, ticket 0747)', () => {
  /** The pixel each bead of a frame-only lattice took. */
  function partPixels(image: PixelData, technique: Technique, part: PixelCrop, per: number) {
    const dimensions = { columns: Math.ceil(part.width / per), rows: Math.ceil(part.height / per) }
    const lattice: PreviewLattice = { ...dimensions, frameColumn: 0, frameRow: 0 }
    const packed = sampleLatticePacked({ image, technique, part, pixelsPerBead: { x: per, y: per }, lattice })
    return Array.from({ length: lattice.rows }, (_row, row) =>
      Array.from({ length: lattice.columns }, (_cell, column) => {
        const color = packed[row * lattice.columns + column]!
        return color === NO_COLOR ? undefined : sampledPixel(packedToHex(color))
      }),
    )
  }

  it('gives every pixel its own bead at one pixel per bead, in the part', () => {
    expect(partPixels(coordinateImage(6, 6), 'loom', { x: 2, y: 1, width: 2, height: 2 }, 1)).toEqual([
      [{ x: 2, y: 1 }, { x: 3, y: 1 }],
      [{ x: 2, y: 2 }, { x: 3, y: 2 }],
    ])
  })

  it('samples the centre of each block on a 2 × 2 px mark', () => {
    expect(partPixels(coordinateImage(4, 4), 'loom', { x: 0, y: 0, width: 4, height: 4 }, 2)).toEqual([
      [{ x: 1, y: 1 }, { x: 3, y: 1 }],
      [{ x: 1, y: 3 }, { x: 3, y: 3 }],
    ])
  })

  it('makes every pixel n × n beads on an enlarging mark', () => {
    expect(partPixels(coordinateImage(2, 1), 'loom', { x: 0, y: 0, width: 2, height: 1 }, 0.5)).toEqual([
      [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0 }],
      [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0 }],
    ])
  })

  it('keeps brick stitch’s half-bead stagger, the shifted row’s last bead staying on the picture', () => {
    const pixelsTaken = partPixels(coordinateImage(8, 4), 'brick', { x: 0, y: 0, width: 8, height: 4 }, 2)
    expect(pixelsTaken[0]!.map((pixel) => pixel!.x)).toEqual([1, 3, 5, 7])
    expect(pixelsTaken[1]!.map((pixel) => pixel!.x)).toEqual([2, 4, 6, 7])
  })

  it('walks a peyote row one block down the picture', () => {
    const pixelsTaken = partPixels(coordinateImage(4, 8), 'peyote', { x: 0, y: 0, width: 4, height: 8 }, 2)
    expect(pixelsTaken.map((row) => row[0]!.y)).toEqual([1, 3, 5, 7])
  })

  it('keeps peyote\'s half-bead stagger down its columns, the shifted column\'s last bead staying on the picture (ticket 0734)', () => {
    const pixelsTaken = partPixels(coordinateImage(4, 8), 'peyote', { x: 0, y: 0, width: 4, height: 8 }, 2)
    expect(pixelsTaken.map((row) => row[1]!.y)).toEqual([2, 4, 6, 7])
    expect(pixelsTaken[0]!.map((pixel) => pixel!.x)).toEqual([1, 3])
  })

  it('draws the rest of the picture round the part in the preview, off-picture beads left empty', () => {
    const image = coordinateImage(8, 8)
    const part = { x: 2, y: 2, width: 4, height: 4 }
    const pixelsPerBead = { x: 2, y: 2 }
    const lattice = partLattice({ image, part, pixelsPerBead, dimensions: { columns: 2, rows: 2 }, technique: 'loom' })
    const packed = sampleLatticePacked({ image, technique: 'loom', part, pixelsPerBead, lattice })
    // The first lattice row lies above the picture: rows above the frame are whole cycles of the shift.
    expect(packed[0]).toBe(NO_COLOR)
    expect(sampledPixel(packedToHex(packed[2 * 4 + 1]!))).toEqual({ x: 3, y: 3 })
  })
})
