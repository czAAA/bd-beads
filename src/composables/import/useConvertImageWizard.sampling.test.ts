import { describe, expect, it } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { channelsOf, colorDistance, toHex, toOklab, type Rgb } from '../../domain/color'
import type { PixelData } from '../../domain/imageConversion'
import { useConvertImageWizard, type ConvertImageWizard } from './useConvertImageWizard'
import { unusedCutOutService } from '../../testUtils/fakeCutOutService'
import { fakeCutOutDevice } from '../../testUtils/fakeCutOutDevice'

// The sampler's reference suite (ticket 0762, spec 0761): synthetic pictures only, each converted at rest through the
// wizard's state and checked for what the maker would see. Thresholds in the sampler change only with this green.

type Rgba = [number, number, number, number?]

/** A picture drawn by a function of each pixel's place. */
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

/** The same random numbers every run, so a picture with noise is one picture. */
function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }
}

async function convert(picture: PixelData, width: number): Promise<ConvertImageWizard> {
  const wizard = effectScope().run(() =>
    useConvertImageWizard({
      start: { technique: 'loom', beadId: 'toho/cube/1.5mm', name: '', makerName: '' },
      decodeImage: async () => picture,
      loadCatalog: () => Promise.reject(new Error('no catalog')),
      cutOutService: unusedCutOutService,
      cutOutDevice: fakeCutOutDevice().device,
    }),
  )!
  await wizard.setFile(new File(['x'], 'picture.png', { type: 'image/png' }))
  wizard.setWidth(width)
  await nextTick()
  return wizard
}

/** The beads at rest, row by row: each its color, or undefined for no bead. The whole picture has no margin round it. */
function beads(wizard: ConvertImageWizard): (string | undefined)[][] {
  const { columns, rows } = wizard.lattice.value!
  return Array.from({ length: rows }, (_row, row) => wizard.beadColors.value.slice(row * columns, (row + 1) * columns))
}

const distance = (hex: string, rgb: Rgb) => colorDistance(toOklab(channelsOf(hex)), toOklab(rgb))
const isDark = (hex: string | undefined) => hex !== undefined && toOklab(channelsOf(hex)).l < 0.5

/** The beads a test picks, in groups that touch along a side or at a corner. */
function groups(grid: readonly (readonly (string | undefined)[])[], picked: (hex: string | undefined) => boolean): [number, number][][] {
  const seen = grid.map((row) => row.map(() => false))
  const found: [number, number][][] = []
  grid.forEach((line, row) =>
    line.forEach((hex, column) => {
      if (seen[row]![column] || !picked(hex)) return
      const group: [number, number][] = []
      const todo: [number, number][] = [[row, column]]
      seen[row]![column] = true
      while (todo.length > 0) {
        const [r, c] = todo.pop()!
        group.push([r, c])
        for (let dr = -1; dr <= 1; dr += 1) {
          for (let dc = -1; dc <= 1; dc += 1) {
            const [nr, nc] = [r + dr, c + dc]
            if (nr < 0 || nc < 0 || nr >= grid.length || nc >= line.length || seen[nr]![nc] || !picked(grid[nr]![nc])) continue
            seen[nr]![nc] = true
            todo.push([nr, nc])
          }
        }
      }
      found.push(group)
    }),
  )
  return found
}

/** Whether a bead is shut in by the picked beads: no path along sides through the others reaches the edge. */
function enclosed(grid: readonly (readonly (string | undefined)[])[], picked: (hex: string | undefined) => boolean, [row, column]: [number, number]): boolean {
  const rows = grid.length
  const columns = grid[0]!.length
  const seen = new Set<number>([row * columns + column])
  const todo: [number, number][] = [[row, column]]
  while (todo.length > 0) {
    const [r, c] = todo.pop()!
    if (r === 0 || c === 0 || r === rows - 1 || c === columns - 1) return false
    for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]] as const) {
      if (seen.has(nr * columns + nc) || picked(grid[nr]![nc])) continue
      seen.add(nr * columns + nc)
      todo.push([nr, nc])
    }
  }
  return true
}

describe('Convert image sampling: pixel art (ticket 0762)', () => {
  const PALETTE: Rgb[] = [
    { r: 255, g: 255, b: 255 },
    { r: 20, g: 20, b: 20 },
    { r: 230, g: 40, b: 60 },
    { r: 40, g: 110, b: 220 },
    { r: 250, g: 210, b: 50 },
  ]
  // A sprite with one-cell lines, single cells and every color next to every other.
  const ART = ['00111100', '01222210', '12322321', '12222221', '12422421', '12244221', '01222210', '00111100'].map((line) =>
    [...line].map(Number),
  )
  const hexOf = (index: number) => toHex(PALETTE[index]!)

  it('is exactly the pixel grid on a mark', async () => {
    const block = 4
    const picture = draw(32, 32, (x, y) => {
      const { r, g, b } = PALETTE[ART[Math.floor(y / block)]![Math.floor(x / block)]!]!
      return [r, g, b]
    })

    const wizard = await convert(picture, 8)

    expect(wizard.sizing.value.mark).toEqual({ width: 8, pixelsPerBead: 4 })
    expect(beads(wizard)).toEqual(ART.map((line) => line.map(hexOf)))
  })

  it('is exactly the pixel grid between marks, the cells not a whole number of pixels', async () => {
    // Eight cells over 52 px, as a nearest-neighbour enlargement makes them: 6 or 7 px each.
    const picture = draw(52, 52, (x, y) => {
      const { r, g, b } = PALETTE[ART[Math.floor((y * 8) / 52)]![Math.floor((x * 8) / 52)]!]!
      return [r, g, b]
    })

    const wizard = await convert(picture, 8)

    expect(wizard.sizing.value.mark).toBeUndefined()
    expect(beads(wizard)).toEqual(ART.map((line) => line.map(hexOf)))
  })
})

describe('Convert image sampling: lines (ticket 0762)', () => {
  it.each([20, 24, 17])('keeps a thin outline a closed ring at Width %i', async (width) => {
    // A 3 px black circle on white, 120 px across.
    const picture = draw(120, 120, (x, y) => {
      const radius = Math.hypot(x + 0.5 - 60, y + 0.5 - 60)
      return radius >= 38.5 && radius <= 41.5 ? [15, 15, 15] : [255, 255, 255]
    })

    const grid = beads(await convert(picture, width))
    const middle = Math.floor(grid.length / 2)

    expect(groups(grid, isDark)).toHaveLength(1)
    expect(enclosed(grid, isDark, [middle, middle])).toBe(true)
  })

  it.each([30, 37])('keeps a logo’s stroke on a flat field connected at Width %i', async (width) => {
    // A 2 px navy stroke on orange, a steep line then a shallow one: (20, 80) to (60, 20) to (130, 70).
    const navy: Rgb = { r: 20, g: 30, b: 90 }
    const segments = [
      [20, 80, 60, 20],
      [60, 20, 130, 70],
    ] as const
    const fromStroke = (x: number, y: number) =>
      Math.min(
        ...segments.map(([ax, ay, bx, by]) => {
          const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)))
          return Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay))
        }),
      )
    const picture = draw(150, 100, (x, y) => (fromStroke(x + 0.5, y + 0.5) <= 1 ? [navy.r, navy.g, navy.b] : [240, 140, 40]))
    const ends = [
      [20, 80],
      [60, 20],
      [130, 70],
    ] as const

    const wizard = await convert(picture, width)
    const grid = beads(wizard)
    const isStroke = (hex: string | undefined) => hex !== undefined && distance(hex, navy) < 0.1
    const stroke = groups(grid, isStroke)
    const per = wizard.sizing.value.pixelsPerBead

    expect(stroke).toHaveLength(1)
    // Each end and the corner is in it, give or take a bead.
    for (const [x, y] of ends) {
      const [row, column] = [Math.floor(y / per.y), Math.floor(x / per.x)]
      expect(stroke[0]!.some(([r, c]) => Math.abs(r - row) <= 1 && Math.abs(c - column) <= 1)).toBe(true)
    }
  })
})

describe('Convert image sampling: photos (ticket 0762)', () => {
  // Three flat regions with noise on every pixel, and shine and shadow in small spots, 240 px across.
  const BACKGROUND: Rgb = { r: 190, g: 170, b: 140 }
  const DISC: Rgb = { r: 180, g: 40, b: 60 }
  const BOX: Rgb = { r: 40, g: 90, b: 160 }
  const regionAt = (x: number, y: number): Rgb =>
    Math.hypot(x - 80, y - 90) <= 50 ? DISC : x >= 140 && x < 220 && y >= 120 && y < 210 ? BOX : BACKGROUND
  const random = seeded(762)
  const spots = new Map<number, number>()
  for (let at = 0; at < 120 * 120; at += 1) {
    const roll = random()
    if (roll < 0.06) spots.set(at, roll < 0.03 ? 1.6 : 0.35)
  }
  const photo = draw(240, 240, (x, y) => {
    const { r, g, b } = regionAt(x, y)
    const light = spots.get(Math.floor(y / 2) * 120 + Math.floor(x / 2)) ?? 1
    const noise = () => (random() - 0.5) * 28
    const lit = (channel: number) => (light > 1 ? channel + (255 - channel) * 0.85 : channel * light)
    return [lit(r) + noise(), lit(g) + noise(), lit(b) + noise()]
  })
  const PER = 6
  const WIDTH = 240 / PER
  /** The beads whose whole area is one region, and that region's color. */
  const inside = Array.from({ length: WIDTH }, (_row, row) =>
    Array.from({ length: WIDTH }, (_column, column) => {
      const corners = [regionAt(column * PER, row * PER), regionAt(column * PER + PER - 1, row * PER), regionAt(column * PER, row * PER + PER - 1), regionAt(column * PER + PER - 1, row * PER + PER - 1)]
      return corners.every((corner) => corner === corners[0]) ? corners[0] : undefined
    }),
  )
  const STRAY = 0.1

  it('has fewer stray beads than the centre pixels have', async () => {
    // Every color the slider offers, so what is counted is the sampling, not the reduction to a few colors.
    const wizard = await convert(photo, WIDTH)
    wizard.setMaxColors(wizard.colorsMax.value)
    const grid = beads(wizard)
    let stray = 0
    let centreStray = 0
    inside.forEach((line, row) =>
      line.forEach((region, column) => {
        if (!region) return
        if (distance(grid[row]![column]!, region) > STRAY) stray += 1
        const at = ((row * PER + PER / 2) * 240 + column * PER + PER / 2) * 4
        const centre = toHex({ r: photo.data[at]!, g: photo.data[at + 1]!, b: photo.data[at + 2]! })
        if (distance(centre, region) > STRAY) centreStray += 1
      }),
    )

    expect(centreStray).toBeGreaterThan(50)
    expect(stray).toBeLessThan(centreStray / 10)
  })

  it('gives each region a color close to its own', async () => {
    const grid = beads(await convert(photo, WIDTH))

    for (const region of [BACKGROUND, DISC, BOX]) {
      const counts = new Map<string, number>()
      inside.forEach((line, row) =>
        line.forEach((at, column) => {
          if (at === region) counts.set(grid[row]![column]!, (counts.get(grid[row]![column]!) ?? 0) + 1)
        }),
      )
      const [mostly] = [...counts].sort((one, other) => other[1] - one[1])[0]!
      expect(distance(mostly, region)).toBeLessThan(0.03)
    }
  })
})

describe('Convert image sampling: transparency (ticket 0762)', () => {
  it('leaves the beads empty where the picture is transparent, as before', async () => {
    // Transparent on the left half, red on the right with a few see-through pixels scattered in it.
    const picture = draw(40, 40, (x, y) => (x < 20 ? [0, 0, 0, 0] : (x * 7 + y * 3) % 11 === 0 ? [0, 0, 0, 0] : [220, 30, 40]))

    const grid = beads(await convert(picture, 10))

    for (const line of grid) {
      expect(line.slice(0, 5)).toEqual([undefined, undefined, undefined, undefined, undefined])
      expect(line.slice(5)).toEqual(Array(5).fill('#dc1e28'))
    }
  })
})

describe('Convert image sampling: a moving handle (ticket 0762)', () => {
  it('shows each bead’s centre pixel while a handle moves, and its area at rest', async () => {
    // Red on the left with a white pixel at each 4 px bead's centre, white on the right.
    const picture = draw(40, 20, (x, y) => (x < 20 && (x % 4 !== 2 || y % 4 !== 2) ? [220, 30, 40] : [255, 255, 255]))
    const wizard = await convert(picture, 10)
    expect(beads(wizard)[0]![0]).toBe('#dc1e28')

    wizard.setWeave('part')
    wizard.beginMove()
    wizard.setPart({ x: 0, y: 0, width: 40, height: 20 })

    expect(wizard.approximate.value).toBe(true)
    expect(beads(wizard)[0]![0]).toBe('#ffffff')
    wizard.endMove()
    expect(beads(wizard)[0]![0]).toBe('#dc1e28')
  })
})
