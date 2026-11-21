import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import { exactColors, packPage } from './pagePacking'
import { encodePng } from './pngEncoder'

const WIDTH = 600
const HEIGHT = 200

/** A page from a color per pixel. */
function page(color: (x: number, y: number) => number) {
  return (y: number, rows: number) => {
    const pixels = new Uint8ClampedArray(WIDTH * rows * 4)
    for (let row = 0; row < rows; row += 1) {
      for (let x = 0; x < WIDTH; x += 1) {
        const c = color(x, y + row)
        pixels.set([(c >> 16) & 255, (c >> 8) & 255, c & 255, 255], (row * WIDTH + x) * 4)
      }
    }
    return pixels
  }
}

/** A page of beads: a smooth gradient, thousands of colors. */
const beads = page((x, y) => ((x * 5) << 16) | ((y * 6) << 8) | ((x + y) & 255))

describe('packPage (ticket 1142)', () => {
  it('stores a page of few colors as a palette picture, each color exact', async () => {
    const speckled = page((x, y) => ((x * 7919 + y * 104_729) % 100) * 0x010203)
    const packed = await packPage(WIDTH, HEIGHT, 16, speckled, new Set())
    expect(packed.palette).toBeDefined()
    const png = PNG.sync.read(Buffer.from(await (await encodePng(WIDTH, HEIGHT, 16, speckled)).arrayBuffer()))
    expect(Buffer.from(png.data).equals(Buffer.from(speckled(0, HEIGHT)))).toBe(true)
  })

  it('stores a page with 256 colors or fewer exactly', async () => {
    const few = page((x) => (x % 200) * 0x010203)
    const png = PNG.sync.read(Buffer.from(await (await encodePng(WIDTH, HEIGHT, 16, few)).arrayBuffer()))
    for (let x = 0; x < WIDTH; x += 1) {
      const c = (x % 200) * 0x010203
      expect([...png.data.subarray(x * 4, x * 4 + 3)]).toEqual([(c >> 16) & 255, (c >> 8) & 255, c & 255])
    }
  })

  it('keeps a page of beads in full color, pixel for pixel, and no bigger than unfiltered', async () => {
    const packed = await packPage(WIDTH, HEIGHT, 16, beads, new Set())
    expect(packed.palette).toBeUndefined()
    const png = PNG.sync.read(Buffer.from(await (await encodePng(WIDTH, HEIGHT, 16, beads)).arrayBuffer()))
    expect(Buffer.from(png.data).equals(Buffer.from(beads(0, HEIGHT)))).toBe(true)
    // Today's packing: full color, every row led by filter 0.
    const rgba = beads(0, HEIGHT)
    const raw = new Uint8Array(HEIGHT * (1 + WIDTH * 3))
    for (let row = 0; row < HEIGHT; row += 1) {
      for (let x = 0; x < WIDTH; x += 1) raw.set(rgba.subarray((row * WIDTH + x) * 4, (row * WIDTH + x) * 4 + 3), row * (1 + WIDTH * 3) + 1 + x * 3)
    }
    const today = await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer()
    expect(packed.flate.reduce((sum, part) => sum + part.length, 0)).toBeLessThanOrEqual(today.byteLength)
  })

  it('stays full color when more Project colors are on the page than 256 hold', async () => {
    const colors = page((x) => (x % 300) + 1)
    const all = Array.from({ length: 300 }, (_, i) => '#' + (i + 1).toString(16).padStart(6, '0'))
    expect((await packPage(WIDTH, HEIGHT, 16, colors, exactColors(all))).palette).toBeUndefined()
  })

  it('rounds a rare shade to a kept neighbor while every Project color stays exact', async () => {
    // 250 Project colors in wide stripes, plus 12 single-pixel shades in the first row: 262 colors, 12 pixels changing.
    const mostly = page((x, y) => (y === 0 && x >= 300 && x < 312 ? 0x800000 + x : 0x100000 + (x % 250)))
    const exact = exactColors(Array.from({ length: 250 }, (_, i) => '#' + (0x100000 + i).toString(16)))
    const png = PNG.sync.read(Buffer.from(await (await encodePng(WIDTH, HEIGHT, 16, mostly, exact)).arrayBuffer()))
    for (let x = 0; x < 300; x += 1) {
      const c = 0x100000 + (x % 250)
      expect([...png.data.subarray(x * 4, x * 4 + 3)]).toEqual([(c >> 16) & 255, (c >> 8) & 255, c & 255])
    }
    expect((await packPage(WIDTH, HEIGHT, 16, mostly, exact)).palette).toBeDefined()
  })
})

describe('a page that cannot keep its colors', () => {
  it('stays full color when over 0.1 % of its pixels would change', async () => {
    const noisy = page((x, y) => (x * 7 + y * 13) % 300 * 0x010101 + ((x + y) % 3))
    expect((await packPage(WIDTH, HEIGHT, 16, noisy, new Set())).palette).toBeUndefined()
  })
})
