// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Bead } from './beads'
import { computeGridDimensions, type GridDimensions } from './grid'
import { cellCenter, describeWeave, type Technique } from './weave'
import { channelsOf } from './color'
import { CENTERED_PAN, frameSizeMm, framingView, previewLattice, ratioLattice, type PreviewLattice } from './imageFraming'
import { reducePictureColors } from './imageColors'
import { convertFrame, matchFoundColors, sourceTargets } from './convertColors'
import { BUILT_IN_COLORS } from './palette'
import type { Grid } from './project'
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

const cubeBead: Bead = {
  id: 'test-cube',
  brand: { id: 'test', name: 'Test' },
  size: '1.5mm',
  formFactor: { id: 'cube', nameKey: 'cube', roundness: 0, holes: { count: 1, direction: 'along' } },
  widthMm: 1.5,
  heightMm: 1.5,
}

const delicaBead: Bead = { ...cubeBead, id: 'test-delica', widthMm: 1.3, heightMm: 1.6 }

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

/** One Convert image, straight from a picture and a framing view: the frame is the whole lattice. */
function convertImage(
  input: { image: PixelData; view: ReturnType<typeof framingView>; technique: Technique; bead: Bead; dimensions: GridDimensions; maxColors: number },
): { grid: Grid; imageColors: string[] } {
  const lattice: PreviewLattice = { columns: input.dimensions.columns, rows: input.dimensions.rows, frameColumn: 0, frameRow: 0 }
  return convertSampled(sampleLatticePacked({ ...input, lattice }), lattice, input.dimensions, input.maxColors)
}

/** The pixel of the picture under a point in the frame's own millimetres, as the sampling arithmetic reads it. */
function sourcePixelAt(
  view: ReturnType<typeof framingView>,
  image: PixelData,
  xMm: number,
  yMm: number,
): { x: number; y: number } | undefined {
  const x = Math.floor((xMm - view.offsetXMm) / view.scaleMm)
  const y = Math.floor((yMm - view.offsetYMm) / view.scaleMm)
  return x < 0 || y < 0 || x >= image.width || y >= image.height ? undefined : { x, y }
}

function convert(
  image: PixelData,
  technique: Technique,
  size: { widthMm: number; heightMm: number },
  bead: Bead = cubeBead,
  maxColors = 4096,
) {
  const dimensions = computeGridDimensions(size, bead, technique)
  const frame = frameSizeMm(technique, dimensions, bead)
  const view = framingView(image, frame, 1, CENTERED_PAN)
  return { dimensions, ...convertImage({ image, view, technique, bead, dimensions, maxColors }) }
}

/** The grid's raw sampled colors, before Convert image snaps them onto the Palette (ticket 177), which would
 * otherwise obscure which source pixel each cell picked (nearby markers can snap to one color). */
function convertRawGrid(
  image: PixelData,
  technique: Technique,
  size: { widthMm: number; heightMm: number },
  bead: Bead = cubeBead,
): (string | undefined)[][] {
  const dimensions = computeGridDimensions(size, bead, technique)
  const frame = frameSizeMm(technique, dimensions, bead)
  const view = framingView(image, frame, 1, CENTERED_PAN)
  const lattice: PreviewLattice = { columns: dimensions.columns, rows: dimensions.rows, frameColumn: 0, frameRow: 0 }
  return sampleLattice({ image, view, technique, bead, lattice })
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
  /** What one cell took, the way it was worked out before sampling ran a row at a time: cellCenter, then
   * sourcePixelAt, then the pixel's color. */
  function cellByCell(
    image: PixelData,
    technique: Technique,
    bead: Bead,
    view: ReturnType<typeof framingView>,
    lattice: ReturnType<typeof previewLattice>,
  ): (string | undefined)[] {
    const { widthMm, heightMm } = describeWeave({ technique }).beadMm(bead)
    // The frame's first row and column are never shifted, so its corner is a whole cell per row and column.
    const originXMm = lattice.frameColumn * widthMm
    const originYMm = lattice.frameRow * heightMm
    const cells: (string | undefined)[] = []
    for (let row = 0; row < lattice.rows; row += 1) {
      for (let column = 0; column < lattice.columns; column += 1) {
        const center = cellCenter({ technique }, { row, column }, widthMm, heightMm)
        const pixel = sourcePixelAt(view, image, center.x - originXMm, center.y - originYMm)
        cells.push(pixel && pixelColorAt(image, pixel.x, pixel.y))
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

  it.each([
    ['loom', cubeBead],
    ['peyote', cubeBead],
    ['brick', delicaBead],
  ] as const)('takes exactly the colors sampling cell by cell does, in %s, at every zoom and pan', (technique, bead) => {
    const image = busyImage(53, 41)
    const dimensions = computeGridDimensions({ widthMm: 30, heightMm: 24 }, bead, technique)
    const frame = frameSizeMm(technique, dimensions, bead)

    for (const zoom of [1, 1.75, 4]) {
      for (const pan of [{ x: 0, y: 0 }, CENTERED_PAN, { x: 1, y: 0.3 }]) {
        const view = framingView(image, frame, zoom, pan)
        const lattice = previewLattice({ view, frame, dimensions, bead, technique })

        const packed = sampleLatticePacked({ image, view, technique, bead, lattice })

        expect(Array.from(packed, (color) => (color === NO_COLOR ? undefined : packedToHex(color)))).toEqual(
          cellByCell(image, technique, bead, view, lattice),
        )
      }
    }
  })

  it('leaves off-picture cells as NO_COLOR', () => {
    const image = flat(2, 2, [10, 20, 30])
    const dimensions = { columns: 2, rows: 2 }
    const frame = frameSizeMm('loom', dimensions, cubeBead)
    const view = framingView(image, frame, 1, CENTERED_PAN)

    // A lattice bigger than the picture: 6 × 6 cells with the frame in the middle.
    const packed = sampleLatticePacked({
      image,
      view,
      technique: 'loom',
      bead: cubeBead,
      lattice: { columns: 6, rows: 6, frameColumn: 2, frameRow: 2 },
    })

    expect(packed[0]).toBe(NO_COLOR)
    expect(packed[2 * 6 + 2]).not.toBe(NO_COLOR)
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
  it('gives every cell of the grid the Palette color nearest the picture under it (ticket 177)', () => {
    // A 2 x 2 picture into a 2 x 2 grid: each cell covers exactly one pixel.
    const image = pixels(2, 2, [
      [255, 0, 0, 255],
      [0, 160, 0, 255],
      [0, 0, 255, 255],
      [255, 255, 255, 255],
    ])

    const { grid } = convert(image, 'loom', { widthMm: 3, heightMm: 3 })

    expect(grid.map((row) => row.map((cell) => cell.color))).toEqual([
      ['#e63746', '#27ae60'], // Palette red, green
      ['#2f6fed', '#ffffff'], // Palette blue, white
    ])
  })

  it('produces a grid of exactly the Project dimensions', () => {
    const { grid, dimensions } = convert(coordinateImage(20, 20), 'loom', { widthMm: 15, heightMm: 30 })

    expect(dimensions).toEqual({ columns: 10, rows: 20 })
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

    const { imageColors } = convert(image, 'loom', { widthMm: 3, heightMm: 3 }, cubeBead, 8)

    expect(new Set(imageColors)).toEqual(new Set(['#e63746', '#27ae60', '#2f6fed', '#1a1a1a']))
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

    expect(imageColors).toEqual(['#1a1a1a']) // nearest Palette color to #0a141e is black
    expect(grid.flat().every((cell) => cell.color === '#1a1a1a')).toBe(true)
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
      [null, '#e63746'], // Palette red
      [null, null],
    ])
  })

  it('upscales a picture smaller than the grid rather than leaving the frame unfilled', () => {
    const { grid, imageColors } = convert(flat(1, 1, [1, 2, 3]), 'loom', { widthMm: 15, heightMm: 15 })

    expect(imageColors).toEqual(['#1a1a1a']) // nearest Palette color to #010203 is black
    expect(grid.flat()).toHaveLength(100)
    expect(grid.flat().every((cell) => cell.color === '#1a1a1a')).toBe(true)
  })

  it('converts a single-pixel picture', () => {
    const { grid } = convert(flat(1, 1, [255, 255, 255]), 'loom', { widthMm: 1.5, heightMm: 1.5 })

    expect(grid).toEqual([[{ color: '#ffffff' }]])
  })

  it('samples a loom row straight across, with no stagger', () => {
    // 9 pixels across a 4-cell frame puts about one pixel on every half cell, so a half-cell stagger shows as a
    // one-pixel shift. The picture is deliberately tall enough that its width is what the cover scale follows.
    const grid = convertRawGrid(coordinateImage(9, 20), 'loom', { widthMm: 6, heightMm: 6 })

    const firstColumn = grid.map((row) => sampledPixel(row[0]!).x)
    expect(new Set(firstColumn).size).toBe(1)
  })

  it('reproduces brick stitch\'s half-cell stagger on odd rows', () => {
    // Sampled below Convert image's Palette quantization (ticket 177): the raw marker colors coordinateImage relies
    // on to decode which pixel a cell sampled would otherwise collapse onto the same nearest Palette color.
    const grid = convertRawGrid(coordinateImage(9, 20), 'brick', { widthMm: 6, heightMm: 6 })

    const evenRow = sampledPixel(grid[0]![0]!).x
    const oddRow = sampledPixel(grid[1]![0]!).x
    const nextEvenRow = sampledPixel(grid[2]![0]!).x

    expect(oddRow).toBeGreaterThan(evenRow)
    expect(nextEvenRow).toBe(evenRow)
  })

  it('reproduces peyote\'s half-cell stagger on odd columns, down the picture (ticket 0734)', () => {
    const grid = convertRawGrid(coordinateImage(20, 9), 'peyote', { widthMm: 6, heightMm: 6 })

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
    const size = { widthMm: 15, heightMm: 15 }
    const [peyote, loom] = [convertRawGrid(image, 'peyote', size), convertRawGrid(image, 'loom', size)]

    expect(peyote).toHaveLength(loom.length)
    const step = (grid: typeof peyote) => sampledPixel(grid[2]![0]!).y - sampledPixel(grid[1]![0]!).y
    expect(step(peyote) / step(loom)).toBeCloseTo(1, 1)
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

describe('frameColors', () => {
  it('converts exactly the cells the preview shows inside the frame', () => {
    const image = coordinateImage(40, 20)
    const technique: Technique = 'peyote'
    const dimensions = computeGridDimensions({ widthMm: 15, heightMm: 15 }, cubeBead, technique)
    const frame = frameSizeMm(technique, dimensions, cubeBead)
    const view = framingView(image, frame, 1.5, { x: 0.3, y: 0.7 })
    const lattice = previewLattice({ view, frame, dimensions, bead: cubeBead, technique })

    const sampled = sampleLatticePacked({ image, view, technique, bead: cubeBead, lattice })
    const fromPreview = convertSampled(sampled, lattice, dimensions, 4096)
    const direct = convertImage({ image, view, technique, bead: cubeBead, dimensions, maxColors: 4096 })

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

describe('sampling By Pixel to bead ratio (spec 0645)', () => {
  /** The pixel each bead of a frame-only lattice took. */
  function ratioPixels(image: PixelData, technique: Technique, crop: { x: number; y: number; width: number; height: number }, ratio: { pixels: number; beads: number }) {
    const per = ratio.pixels / ratio.beads
    const dimensions = { columns: Math.ceil(crop.width / per), rows: Math.ceil(crop.height / per) }
    const lattice: PreviewLattice = { ...dimensions, frameColumn: 0, frameRow: 0 }
    const packed = sampleLatticePacked({ image, technique, crop, ratio, lattice })
    return Array.from({ length: lattice.rows }, (_row, row) =>
      Array.from({ length: lattice.columns }, (_cell, column) => {
        const color = packed[row * lattice.columns + column]!
        return color === NO_COLOR ? undefined : sampledPixel(packedToHex(color))
      }),
    )
  }

  it('gives every pixel its own bead at 1:1, in the crop', () => {
    expect(ratioPixels(coordinateImage(6, 6), 'loom', { x: 2, y: 1, width: 2, height: 2 }, { pixels: 1, beads: 1 })).toEqual([
      [{ x: 2, y: 1 }, { x: 3, y: 1 }],
      [{ x: 2, y: 2 }, { x: 3, y: 2 }],
    ])
  })

  it('samples the centre of each block at 2:1', () => {
    expect(ratioPixels(coordinateImage(4, 4), 'loom', { x: 0, y: 0, width: 4, height: 4 }, { pixels: 2, beads: 1 })).toEqual([
      [{ x: 1, y: 1 }, { x: 3, y: 1 }],
      [{ x: 1, y: 3 }, { x: 3, y: 3 }],
    ])
  })

  it('makes every pixel n × n beads at 1:n', () => {
    expect(ratioPixels(coordinateImage(2, 1), 'loom', { x: 0, y: 0, width: 2, height: 1 }, { pixels: 1, beads: 2 })).toEqual([
      [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0 }],
      [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0 }],
    ])
  })

  it('keeps brick stitch’s half-bead stagger, the shifted row’s last bead staying on the picture', () => {
    const pixels = ratioPixels(coordinateImage(8, 4), 'brick', { x: 0, y: 0, width: 8, height: 4 }, { pixels: 2, beads: 1 })
    expect(pixels[0]!.map((pixel) => pixel!.x)).toEqual([1, 3, 5, 7])
    expect(pixels[1]!.map((pixel) => pixel!.x)).toEqual([2, 4, 6, 7])
  })

  it('walks a peyote row one block down the picture', () => {
    const pixels = ratioPixels(coordinateImage(4, 8), 'peyote', { x: 0, y: 0, width: 4, height: 8 }, { pixels: 2, beads: 1 })
    expect(pixels.map((row) => row[0]!.y)).toEqual([1, 3, 5, 7])
  })

  it('keeps peyote\'s half-bead stagger down its columns, the shifted column\'s last bead staying on the picture (ticket 0734)', () => {
    const pixels = ratioPixels(coordinateImage(4, 8), 'peyote', { x: 0, y: 0, width: 4, height: 8 }, { pixels: 2, beads: 1 })
    expect(pixels.map((row) => row[1]!.y)).toEqual([2, 4, 6, 7])
    expect(pixels[0]!.map((pixel) => pixel!.x)).toEqual([1, 3])
  })

  it('draws the rest of the picture round the crop in the preview, off-picture beads left empty', () => {
    const image = coordinateImage(8, 8)
    const crop = { x: 2, y: 2, width: 4, height: 4 }
    const ratio = { pixels: 2, beads: 1 }
    const lattice = ratioLattice({ image, crop, pixelsPerBead: 2, dimensions: { columns: 2, rows: 2 }, technique: 'loom' })
    expect(lattice).toEqual({ columns: 4, rows: 5, frameColumn: 1, frameRow: 2 })
    const packed = sampleLatticePacked({ image, technique: 'loom', crop, ratio, lattice })
    // The first lattice row lies above the picture: rows above the frame are whole cycles of the shift.
    expect(packed[0]).toBe(NO_COLOR)
    expect(sampledPixel(packedToHex(packed[2 * 4 + 1]!))).toEqual({ x: 3, y: 3 })
  })
})
