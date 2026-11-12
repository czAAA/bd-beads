import { describe, expect, it } from 'vitest'
import { channelsOf, toHex, toOklab } from '../../domain/color'
import {
  centrePixelBeads,
  convertAt,
  distanceTo,
  loneBeads,
  beadGroups,
  enclosedBy,
  photoPicture,
  photoRegionAt,
  PHOTO_BACKGROUND,
  PHOTO_BOX,
  PHOTO_DISC,
  PHOTO_SIZE,
  PIXEL_ART,
  PIXEL_ART_PALETTE,
  pixelArtPicture,
  previewBeads,
  ringPicture,
  RING_GROUND,
  RING_INK,
  strokePicture,
  STROKE_INK,
  STROKE_POINTS,
  transparentPicture,
  drawPicture,
  furPicture,
  meanDistanceFromArea,
  type BeadGrid,
  type Enlargement,
} from '../../testUtils/samplerPictures'

// The sampler's reference suite (ticket 0888, spec 0761): synthetic pictures only, each converted at rest through the
// wizard's state and checked for what the maker would see. The sampler's thresholds change only with this green.

const isDark = (hex: string | undefined) => hex !== undefined && toOklab(channelsOf(hex)).l < 0.5

describe('Convert image sampling: pixel art', () => {
  const expected = PIXEL_ART.map((line) => line.map((index) => toHex(PIXEL_ART_PALETTE[index]!)))

  it('is exactly the pixel grid on a mark', async () => {
    const wizard = await convertAt(pixelArtPicture(32), 8)

    expect(wizard.sizing.value.mark).toEqual({ width: 8, pixelsPerBead: 4 })
    expect(previewBeads(wizard)).toEqual(expected)
  })

  // Ticket 0762's first limit: between marks it could miss at 2.1 to 2.25 picture pixels a bead. Every size from 2 to
  // 8 pixels a cell, an eighth of a pixel apart, either way of enlarging.
  const sizes = Array.from({ length: 49 }, (_size, at) => 16 + at)
  it.each<Enlargement>(['round', 'floor'])('is exactly the pixel grid between marks, each cell 2 to 8 pixels, enlarged by %s', async (enlargement) => {
    const missed: number[] = []
    for (const size of sizes) {
      const wizard = await convertAt(pixelArtPicture(size, enlargement), 8)
      if (JSON.stringify(previewBeads(wizard)) !== JSON.stringify(expected)) missed.push(size)
    }

    expect(missed).toEqual([])
  })
})

describe('Convert image sampling: lines', () => {
  it.each([20, 24, 17, 30])('keeps a thin outline a closed ring at Width %i', async (width) => {
    const grid = previewBeads(await convertAt(ringPicture(), width))
    const middle = Math.floor(grid.length / 2)

    expect(beadGroups(grid, isDark)).toHaveLength(1)
    expect(enclosedBy(grid, isDark, [middle, middle])).toBe(true)
  })

  // Ticket 0762's second limit: a ring drawn nearly a bead thick (3 px in 3.3 px beads) could leave a gap.
  it.each([36, 40, 34])('keeps a ring nearly a bead thick closed at Width %i', async (width) => {
    const grid = previewBeads(await convertAt(ringPicture(), width))
    const middle = Math.floor(grid.length / 2)

    expect(beadGroups(grid, isDark)).toHaveLength(1)
    expect(enclosedBy(grid, isDark, [middle, middle])).toBe(true)
  })

  // Ticket 0762's third limit: anti-aliased line art could leave grey halo beads.
  it.each([20, 24, 30, 36])('keeps an anti-aliased outline a closed ring with no grey beads at Width %i', async (width) => {
    const grid = previewBeads(await convertAt(ringPicture({ antialiased: true }), width))
    const middle = Math.floor(grid.length / 2)
    const grey = grid.flat().filter((hex) => distanceTo(hex!, RING_INK) > 0.1 && distanceTo(hex!, RING_GROUND) > 0.1)

    expect(beadGroups(grid, isDark)).toHaveLength(1)
    expect(enclosedBy(grid, isDark, [middle, middle])).toBe(true)
    expect(grey).toEqual([])
  })

  it.each([
    [30, false],
    [37, false],
    [30, true],
    [45, true],
  ])('keeps a logo’s stroke on a flat field connected at Width %i (anti-aliased: %s)', async (width, antialiased) => {
    const wizard = await convertAt(strokePicture({ antialiased }), width)
    const grid = previewBeads(wizard)
    const stroke = beadGroups(grid, (hex) => hex !== undefined && distanceTo(hex, STROKE_INK) < 0.1)
    const per = wizard.sizing.value.pixelsPerBead

    expect(stroke).toHaveLength(1)
    // Each end and the corner is in it, give or take a bead.
    for (const [x, y] of STROKE_POINTS) {
      const [row, column] = [Math.floor(y / per.y), Math.floor(x / per.x)]
      expect(stroke[0]!.some(([r, c]) => Math.abs(r - row) <= 1 && Math.abs(c - column) <= 1)).toBe(true)
    }
  })
})

describe('Convert image sampling: photos', () => {
  const photo = photoPicture()
  const PER = 6
  const WIDTH = PHOTO_SIZE / PER
  /** The beads whose whole area is one region: that region's color. */
  const inside = Array.from({ length: WIDTH }, (_row, row) =>
    Array.from({ length: WIDTH }, (_column, column) => {
      const corners = [
        photoRegionAt(column * PER, row * PER),
        photoRegionAt(column * PER + PER - 1, row * PER),
        photoRegionAt(column * PER, row * PER + PER - 1),
        photoRegionAt(column * PER + PER - 1, row * PER + PER - 1),
      ]
      return corners.every((corner) => corner === corners[0]) ? corners[0] : undefined
    }),
  )

  it('has fewer lone beads than the centre pixels have, matched to the same colors', async () => {
    const wizard = await convertAt(photo, WIDTH)
    const centre = loneBeads(centrePixelBeads(wizard))
    const area = loneBeads(previewBeads(wizard))

    expect(centre).toBeGreaterThan(300)
    expect(area).toBeLessThan(centre * 0.75)
  })

  it('gives each region a color close to its own', async () => {
    const grid = previewBeads(await convertAt(photo, WIDTH))

    for (const region of [PHOTO_BACKGROUND, PHOTO_DISC, PHOTO_BOX]) {
      const counts = new Map<string, number>()
      inside.forEach((line, row) =>
        line.forEach((at, column) => {
          if (at === region) counts.set(grid[row]![column]!, (counts.get(grid[row]![column]!) ?? 0) + 1)
        }),
      )
      const [mostly] = [...counts].sort((one, other) => other[1] - one[1])[0]!
      expect(distanceTo(mostly, region)).toBeLessThan(0.03)
    }
  })
})

describe('Convert image sampling: texture', () => {
  // Fur: strands two or three pixels thick, longer than a bead, lighter and darker than the ground, in beads 15 px
  // across. They are a photo's texture, not lines, so each bead stays nearer its area's mean color than its centre pixel
  // is. What sets how strongly a line must contrast to win.
  it.each([0.25, 0.35, 0.45])('keeps fur of strength %s nearer each bead’s mean than the centre pixels', async (strength) => {
    const picture = furPicture(strength)
    const wizard = await convertAt(picture, 20)
    wizard.setMaxColors(wizard.colorsMax.value)
    const fromMean = (grid: BeadGrid) => meanDistanceFromArea(picture, grid, 15)

    expect(fromMean(previewBeads(wizard))).toBeLessThan(fromMean(centrePixelBeads(wizard)))
  })
})

describe('Convert image sampling: transparency', () => {
  it('leaves the beads empty where the picture is transparent, as before', async () => {
    const grid = previewBeads(await convertAt(transparentPicture(), 10))

    for (const line of grid) {
      expect(line.slice(0, 5)).toEqual([undefined, undefined, undefined, undefined, undefined])
      expect(line.slice(5)).toEqual(Array(5).fill('#dc1e28'))
    }
  })
})

describe('Convert image sampling: a moving handle', () => {
  it('shows each bead’s centre pixel while a handle moves, and its area at rest', async () => {
    // Red on the left with a white pixel at each 4 px bead's centre, white on the right.
    const picture = drawPicture(40, 20, (x, y) => (x < 20 && (x % 4 !== 2 || y % 4 !== 2) ? [220, 30, 40] : [255, 255, 255]))
    const wizard = await convertAt(picture, 10)
    expect(previewBeads(wizard)[0]![0]).toBe('#dc1e28')

    expect(centrePixelBeads(wizard)[0]![0]).toBe('#ffffff')
    expect(previewBeads(wizard)[0]![0]).toBe('#dc1e28')
  })
})
