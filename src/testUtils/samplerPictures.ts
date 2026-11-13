import { effectScope, nextTick } from 'vue'
import { useConvertImageWizard, type ConvertImageWizard } from '../composables/import/useConvertImageWizard'
import { channelsOf, colorDistance, toOklab, type Rgb } from '../domain/color'
import type { PixelData } from '../domain/imageConversion'

// The sampler's reference suite's pictures (ticket 0888, spec 0761): synthetic only, as the code repo is public, each
// made to be converted through the Convert image wizard and checked for what the maker would see. Shared so a later
// ticket that tells photos from flat art (0889) tunes on the same pictures.

export type Rgba = readonly [number, number, number, number?]

/** A picture drawn by a function of each pixel's place. */
export function drawPicture(width: number, height: number, at: (x: number, y: number) => Rgba): PixelData {
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
export function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }
}

/** Five colors that are each far from the others: pixel art's palette. */
export const PIXEL_ART_PALETTE: readonly Rgb[] = [
  { r: 255, g: 255, b: 255 },
  { r: 20, g: 20, b: 20 },
  { r: 230, g: 40, b: 60 },
  { r: 40, g: 110, b: 220 },
  { r: 250, g: 210, b: 50 },
]

/** A sprite with one-cell lines, single cells and every color next to every other, as indexes into PIXEL_ART_PALETTE. */
export const PIXEL_ART: readonly (readonly number[])[] = ['00111100', '01222210', '12322321', '12222221', '12422421', '12244221', '01222210', '00111100'].map(
  (line) => [...line].map(Number),
)

/** How a pixel art is enlarged to a size that is no whole number of pixels a cell: the cell a pixel's left edge falls in
 * (`floor`), or the one its middle falls in (`round`, as most image editors' nearest neighbour). */
export type Enlargement = 'floor' | 'round'

/** Pixel art enlarged by nearest neighbour to `size` × `size` pixels, its cells `size / cells` pixels each. */
export function pixelArtPicture(size: number, enlargement: Enlargement = 'round', art = PIXEL_ART, palette = PIXEL_ART_PALETTE): PixelData {
  const cells = art.length
  const cellOf = (at: number) => Math.min(cells - 1, Math.floor(((enlargement === 'round' ? at + 0.5 : at) * cells) / size))
  return drawPicture(size, size, (x, y) => {
    const { r, g, b } = palette[art[cellOf(y)]![cellOf(x)]!]!
    return [r, g, b]
  })
}

/** How much of the pixel at (x, y) a shape covers, by 4 × 4 points across it: what anti-aliasing draws. */
function coverage(x: number, y: number, inside: (px: number, py: number) => boolean): number {
  let hits = 0
  for (let sy = 0; sy < 4; sy += 1) {
    for (let sx = 0; sx < 4; sx += 1) if (inside(x + (sx + 0.5) / 4, y + (sy + 0.5) / 4)) hits += 1
  }
  return hits / 16
}

/** A shape's color laid over a ground's, by how much of the pixel it covers. */
const over = (ink: Rgb, ground: Rgb, share: number): Rgba => [
  ink.r * share + ground.r * (1 - share),
  ink.g * share + ground.g * (1 - share),
  ink.b * share + ground.b * (1 - share),
]

export const RING_INK: Rgb = { r: 15, g: 15, b: 15 }
export const RING_GROUND: Rgb = { r: 255, g: 255, b: 255 }

/** Line art: a dark circle `thickness` px wide on white, `size` px square, the circle's middle at radius `size / 3`;
 * crisp (each pixel by its middle) or anti-aliased (each pixel by how much of it the line covers). */
export function ringPicture({ size = 120, thickness = 3, antialiased = false }: { size?: number; thickness?: number; antialiased?: boolean } = {}): PixelData {
  const middle = size / 2
  const radius = size / 3
  const onRing = (px: number, py: number) => Math.abs(Math.hypot(px - middle, py - middle) - radius) <= thickness / 2
  return drawPicture(size, size, (x, y) =>
    over(RING_INK, RING_GROUND, antialiased ? coverage(x, y, onRing) : onRing(x + 0.5, y + 0.5) ? 1 : 0),
  )
}

export const STROKE_INK: Rgb = { r: 20, g: 30, b: 90 }
export const STROKE_FIELD: Rgb = { r: 240, g: 140, b: 40 }
/** The stroke's ends and its corner, in picture pixels of strokePicture. */
export const STROKE_POINTS = [
  [20, 80],
  [60, 20],
  [130, 70],
] as const

/** A logo: a navy stroke 2 px wide on an orange field, 150 × 100 px, a steep line then a shallow one through
 * STROKE_POINTS; crisp or anti-aliased. */
export function strokePicture({ antialiased = false }: { antialiased?: boolean } = {}): PixelData {
  const fromStroke = (x: number, y: number) =>
    Math.min(
      ...[0, 1].map((segment) => {
        const [ax, ay] = STROKE_POINTS[segment]!
        const [bx, by] = STROKE_POINTS[segment + 1]!
        const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)))
        return Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay))
      }),
    )
  const onStroke = (px: number, py: number) => fromStroke(px, py) <= 1
  return drawPicture(150, 100, (x, y) =>
    over(STROKE_INK, STROKE_FIELD, antialiased ? coverage(x, y, onStroke) : onStroke(x + 0.5, y + 0.5) ? 1 : 0),
  )
}

export const PHOTO_BACKGROUND: Rgb = { r: 190, g: 170, b: 140 }
export const PHOTO_DISC: Rgb = { r: 180, g: 40, b: 60 }
export const PHOTO_BOX: Rgb = { r: 40, g: 90, b: 160 }
export const PHOTO_SIZE = 240

/** Which flat region of the generated photo a pixel is in. */
export function photoRegionAt(x: number, y: number): Rgb {
  return Math.hypot(x - 80, y - 90) <= 50 ? PHOTO_DISC : x >= 140 && x < 220 && y >= 120 && y < 210 ? PHOTO_BOX : PHOTO_BACKGROUND
}

/** A generated "photo", PHOTO_SIZE px square: three flat regions (photoRegionAt) with noise on every pixel, and shine
 * and shadow in small 2 px spots over 6% of it. */
export function photoPicture(seed = 888): PixelData {
  const random = seeded(seed)
  const half = PHOTO_SIZE / 2
  const spots = new Map<number, number>()
  for (let at = 0; at < half * half; at += 1) {
    const roll = random()
    if (roll < 0.06) spots.set(at, roll < 0.03 ? 1.6 : 0.35)
  }
  return drawPicture(PHOTO_SIZE, PHOTO_SIZE, (x, y) => {
    const { r, g, b } = photoRegionAt(x, y)
    const light = spots.get(Math.floor(y / 2) * half + Math.floor(x / 2)) ?? 1
    const noise = () => (random() - 0.5) * 28
    const lit = (channel: number) => (light > 1 ? channel + (255 - channel) * 0.85 : channel * light)
    return [lit(r) + noise(), lit(g) + noise(), lit(b) + noise()]
  })
}

/** A "photo" of fur, 300 px square: 400 strands 2 to 3 px thick and 20 to 50 px long at every angle, half lighter
 * and half darker than a brown ground by `strength` (of the whole range), over noise on every pixel. */
export function furPicture(strength: number, seed = 3): PixelData {
  const random = seeded(seed)
  const size = 300
  const ink = new Float32Array(size * size)
  for (let strand = 0; strand < 400; strand += 1) {
    const [x, y, angle, length, sign] = [random() * size, random() * size, random() * Math.PI, 20 + random() * 30, random() < 0.5 ? -1 : 1]
    for (let along = 0; along < length; along += 0.5) {
      const px = Math.floor(x + Math.cos(angle) * along)
      const py = Math.floor(y + Math.sin(angle) * along)
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [0, 1],
      ] as const) {
        if (px + dx < size && py + dy < size && px + dx >= 0 && py + dy >= 0) ink[(py + dy) * size + px + dx] = sign
      }
    }
  }
  return drawPicture(size, size, (x, y) => {
    const noise = (random() - 0.5) * 20
    const shift = ink[y * size + x]! * strength * 255
    return [150 + shift + noise, 110 + shift * 0.8 + noise, 70 + shift * 0.6 + noise]
  })
}

/** Transparent on the left half, red on the right with a few see-through pixels scattered in it, 40 px square. */
export function transparentPicture(): PixelData {
  return drawPicture(40, 40, (x, y) => (x < 20 ? [0, 0, 0, 0] : (x * 7 + y * 3) % 11 === 0 ? [0, 0, 0, 0] : [220, 30, 40]))
}

/** A picture opened in Convert image on a loom with a square Bead, at a Width in beads, its colors kept Exact, as a
 * person sets them. */
export async function convertAt(picture: PixelData, width: number): Promise<ConvertImageWizard> {
  const wizard = effectScope().run(() =>
    useConvertImageWizard({
      start: { technique: 'loom', beadId: 'toho/cube/1.5mm', name: '', makerName: '' },
      decodeImage: async () => picture,
      loadCatalog: () => Promise.reject(new Error('no catalog')),
    }),
  )!
  await wizard.setFile(new File(['x'], 'picture.png', { type: 'image/png' }))
  wizard.setSource('exact')
  wizard.setWidth(width)
  await nextTick()
  return wizard
}

export type BeadGrid = readonly (readonly (string | undefined)[])[]

/** The beads the preview shows, row by row: each its color, or undefined for no bead. The whole picture has no margin
 * round it, so they are the Frame's. */
export function previewBeads(wizard: ConvertImageWizard): (string | undefined)[][] {
  const { columns, rows } = wizard.lattice.value!
  return Array.from({ length: rows }, (_row, row) => wizard.beadColors.value.slice(row * columns, (row + 1) * columns))
}

/** The same beads with each one's centre pixel, as a moving handle shows them, matched to the colors found at rest: what
 * the sampler is compared with. The wizard is left at rest again. */
export function centrePixelBeads(wizard: ConvertImageWizard): (string | undefined)[][] {
  const { width, height } = wizard.image.value!
  wizard.beginMove()
  wizard.setPart({ x: 0, y: 0, width, height })
  const centre = previewBeads(wizard)
  wizard.endMove()
  wizard.keepAll()
  return centre
}

/** How different a bead's color looks from a color, in OKLab. */
export const distanceTo = (hex: string, rgb: Rgb) => colorDistance(toOklab(channelsOf(hex)), toOklab(rgb))

/** How far, on average in OKLab, each bead's color is from the mean color of its square of `per` × `per` pixels: what
 * the benchmark's ΔE measures, for beads on a mark over an opaque picture. */
export function meanDistanceFromArea(picture: PixelData, grid: BeadGrid, per: number): number {
  let sum = 0
  let beads = 0
  grid.forEach((line, row) =>
    line.forEach((hex, column) => {
      const mean = { r: 0, g: 0, b: 0 }
      for (let y = row * per; y < (row + 1) * per; y += 1) {
        for (let x = column * per; x < (column + 1) * per; x += 1) {
          const at = (y * picture.width + x) * 4
          mean.r += picture.data[at]! / (per * per)
          mean.g += picture.data[at + 1]! / (per * per)
          mean.b += picture.data[at + 2]! / (per * per)
        }
      }
      sum += distanceTo(hex!, mean)
      beads += 1
    }),
  )
  return sum / beads
}

/** The beads with no side neighbour of their own color: the speckle a photo's conversion has. */
export function loneBeads(grid: BeadGrid): number {
  let lone = 0
  grid.forEach((line, row) =>
    line.forEach((hex, column) => {
      const sides = [grid[row - 1]?.[column], grid[row + 1]?.[column], line[column - 1], line[column + 1]]
      if (hex !== undefined && !sides.includes(hex)) lone += 1
    }),
  )
  return lone
}

/** The beads a test picks, in groups that touch along a side or at a corner. */
export function beadGroups(grid: BeadGrid, picked: (hex: string | undefined) => boolean): [number, number][][] {
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
export function enclosedBy(grid: BeadGrid, picked: (hex: string | undefined) => boolean, [row, column]: [number, number]): boolean {
  const rows = grid.length
  const columns = grid[0]!.length
  const seen = new Set<number>([row * columns + column])
  const todo: [number, number][] = [[row, column]]
  while (todo.length > 0) {
    const [r, c] = todo.pop()!
    if (r === 0 || c === 0 || r === rows - 1 || c === columns - 1) return false
    for (const [nr, nc] of [
      [r - 1, c],
      [r + 1, c],
      [r, c - 1],
      [r, c + 1],
    ] as const) {
      if (seen.has(nr * columns + nc) || picked(grid[nr]![nc])) continue
      seen.add(nr * columns + nc)
      todo.push([nr, nc])
    }
  }
  return true
}

/** A generated "photo" like photoPicture, at any size: its three regions stretched to `width` × `height` px, with the
 * same noise and shine and shadow on single pixels, so photos of different pixel widths show one scene (ticket 0889). */
export function photoPictureSized(width: number, height: number, seed = 889): PixelData {
  const random = seeded(seed)
  return drawPicture(width, height, (x, y) => {
    const { r, g, b } = photoRegionAt((x * PHOTO_SIZE) / width, (y * PHOTO_SIZE) / height)
    const roll = random()
    const light = roll < 0.03 ? 1.6 : roll < 0.06 ? 0.35 : 1
    const noise = () => (random() - 0.5) * 28
    const lit = (channel: number) => (light > 1 ? channel + (255 - channel) * 0.85 : channel * light)
    return [lit(r) + noise(), lit(g) + noise(), lit(b) + noise()]
  })
}

/** The JPEG standard's quantization tables for brightness and color, at quality 50. */
const JPEG_LUMA = [16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56, 14, 17, 22, 29, 51, 87, 80, 62, 18, 22,
  37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92, 49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99]
const JPEG_CHROMA = [17, 18, 24, 47, 99, 99, 99, 99, 18, 21, 26, 66, 99, 99, 99, 99, 24, 26, 56, 99, 99, 99, 99, 99, 47, 66, 99, 99, 99, 99, 99, 99,
  ...Array<number>(32).fill(99)]

/** A picture as a JPEG saver leaves it (ticket 0889): brightness and color split, color halved each way, each 8 × 8
 * block's frequencies rounded to the standard tables at `quality` (1 to 100), so flat areas ring and edges smear. */
export function jpegLike(picture: PixelData, quality = 75): PixelData {
  const { width, height } = picture
  const scale = quality < 50 ? 5000 / quality : 200 - quality * 2
  const table = (base: number[]) => base.map((step) => Math.max(1, Math.floor((step * scale + 50) / 100)))
  const tables = [table(JPEG_LUMA), table(JPEG_CHROMA), table(JPEG_CHROMA)]
  const at = (x: number, y: number) => (Math.min(height - 1, y) * width + Math.min(width - 1, x)) * 4
  const planes = [0, 1, 2].map(() => new Float32Array(width * height))
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = [0, 1, 2].map((channel) => picture.data[at(x, y) + channel]!)
      planes[0]![y * width + x] = 0.299 * r! + 0.587 * g! + 0.114 * b!
      // Color is kept for each 2 × 2 pixels only, as most savers do.
      const [cx, cy] = [x - (x % 2), y - (y % 2)]
      const mean = (channel: number) => [at(cx, cy), at(cx + 1, cy), at(cx, cy + 1), at(cx + 1, cy + 1)].reduce((sum, i) => sum + picture.data[i + channel]!, 0) / 4
      const [mr, mg, mb] = [mean(0), mean(1), mean(2)]
      planes[1]![y * width + x] = 128 - 0.168736 * mr - 0.331264 * mg + 0.5 * mb
      planes[2]![y * width + x] = 128 + 0.5 * mr - 0.418688 * mg - 0.081312 * mb
    }
  }
  const cosines = Array.from({ length: 64 }, (_cell, i) => Math.cos(((2 * (i % 8) + 1) * Math.floor(i / 8) * Math.PI) / 16))
  const weight = (u: number) => (u === 0 ? Math.SQRT1_2 : 1)
  planes.forEach((plane, p) => {
    for (let by = 0; by < height; by += 8) {
      for (let bx = 0; bx < width; bx += 8) {
        const block = Array.from({ length: 64 }, (_cell, i) => plane[Math.min(height - 1, by + Math.floor(i / 8)) * width + Math.min(width - 1, bx + (i % 8))]! - 128)
        const rounded = Array.from({ length: 64 }, (_cell, i) => {
          const [u, v] = [i % 8, Math.floor(i / 8)]
          let sum = 0
          for (let k = 0; k < 64; k += 1) sum += block[k]! * cosines[u * 8 + (k % 8)]! * cosines[v * 8 + Math.floor(k / 8)]!
          const step = tables[p]![i]!
          return Math.round((weight(u) * weight(v) * sum) / 4 / step) * step
        })
        for (let k = 0; k < 64; k += 1) {
          const [x, y] = [bx + (k % 8), by + Math.floor(k / 8)]
          if (x >= width || y >= height) continue
          let sum = 0
          for (let i = 0; i < 64; i += 1) sum += weight(i % 8) * weight(Math.floor(i / 8)) * rounded[i]! * cosines[(i % 8) * 8 + (k % 8)]! * cosines[Math.floor(i / 8) * 8 + Math.floor(k / 8)]!
          plane[y * width + x] = sum / 4 + 128
        }
      }
    }
  })
  return drawPicture(width, height, (x, y) => {
    const [l, cb, cr] = [planes[0]![y * width + x]!, planes[1]![y * width + x]! - 128, planes[2]![y * width + x]! - 128]
    return [l + 1.402 * cr, l - 0.344136 * cb - 0.714136 * cr, l + 1.772 * cb]
  })
}
