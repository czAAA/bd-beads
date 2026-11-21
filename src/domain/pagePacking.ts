import type { StripSource } from './pngEncoder'

// How a page's picture is packed (ticket 1142, ADR 0043): only the bytes, never the drawing. A page of words becomes a
// 256-color picture, a page of beads is filtered when that is smaller, and none comes out bigger than full color unfiltered.

/** A page packed: zlib scanlines, each led by its PNG filter byte, of RGB pixels or of indexes into `palette`. */
export interface PackedPage {
  width: number
  height: number
  flate: Uint8Array[]
  /** The 256 colors or fewer a pixel indexes (R, G, B bytes in turn); absent for a full-color page. */
  palette?: Uint8Array
}

/** A page keeps its 256 colors only while at most this share of its pixels would change (the smoothing shades). */
const MAX_CHANGED_SHARE = 0.001
const PALETTE_SIZE = 256
/** More distinct colors than this and a page is a picture of beads: it is not counted further. */
const COLOR_LIMIT = 5_000

const packed = (color: number) => [(color >> 16) & 255, (color >> 8) & 255, color & 255]

/** The `#rrggbb` colors as numbers; anything else is skipped. */
export function exactColors(hexes: readonly string[]): Set<number> {
  const colors = new Set<number>()
  for (const hex of hexes) {
    const match = /^#?([0-9a-f]{6})$/i.exec(hex)
    if (match) colors.add(parseInt(match[1]!, 16))
  }
  return colors
}

/** A zlib stream written to as bands arrive. */
function deflater() {
  const compression = new CompressionStream('deflate')
  const writer = compression.writable.getWriter()
  const parts: Uint8Array[] = []
  const reading = (async () => {
    const reader = compression.readable.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return
      parts.push(value)
    }
  })()
  return {
    write: (bytes: Uint8Array<ArrayBuffer>) => writer.write(bytes),
    async finish() {
      await writer.close()
      await reading
      return parts
    },
  }
}

const size = (parts: Uint8Array[]) => parts.reduce((sum, part) => sum + part.length, 0)

/** How many pixels hold each color, or nothing once there are more than `COLOR_LIMIT` colors. */
async function countColors(width: number, height: number, stripRows: number, strip: StripSource): Promise<Map<number, number> | undefined> {
  const counts = new Map<number, number>()
  let overflow = false
  for (let y = 0; y < height && !overflow; y += stripRows) {
    const rows = Math.min(stripRows, height - y)
    const rgba = await strip(y, rows)
    let last = -1
    let run = 0
    for (let from = 0, end = rows * width * 4; from < end; from += 4) {
      const color = (rgba[from]! << 16) | (rgba[from + 1]! << 8) | rgba[from + 2]!
      if (color === last) {
        run += 1
        continue
      }
      if (run) counts.set(last, (counts.get(last) ?? 0) + run)
      last = color
      run = 1
      if (counts.size > COLOR_LIMIT) {
        overflow = true
        break
      }
    }
    if (run && !overflow) counts.set(last, (counts.get(last) ?? 0) + run)
  }
  return overflow || counts.size > COLOR_LIMIT ? undefined : counts
}

/** The 256 colors or fewer a page keeps, and where each color of the page goes; nothing when the page must stay full color:
 * more of the Project's colors on it than 256 hold, or over `MAX_CHANGED_SHARE` of its pixels changing. */
function choosePalette(counts: ReadonlyMap<number, number>, exact: ReadonlySet<number>, pixels: number): { colors: number[]; index: Map<number, number> } | undefined {
  const index = new Map<number, number>()
  const colors: number[] = []
  const keep = (color: number) => {
    index.set(color, colors.length)
    colors.push(color)
  }
  if (counts.size <= PALETTE_SIZE) {
    for (const color of counts.keys()) keep(color)
    return { colors, index }
  }
  for (const color of counts.keys()) if (exact.has(color)) keep(color)
  if (colors.length > PALETTE_SIZE) return undefined
  const others = [...counts].filter(([color]) => !index.has(color)).sort((a, b) => b[1] - a[1])
  let changed = 0
  for (const [color, count] of others) {
    if (colors.length < PALETTE_SIZE) keep(color)
    else changed += count
  }
  if (changed > pixels * MAX_CHANGED_SHARE) return undefined
  // A color left out goes to the nearest kept one.
  const kept = colors.map(packed)
  for (const [color] of others) {
    if (index.has(color)) continue
    const [r, g, b] = packed(color) as [number, number, number]
    let best = 0
    let bestDistance = Infinity
    kept.forEach(([kr, kg, kb], at) => {
      const distance = (r - kr!) ** 2 + (g - kg!) ** 2 + (b - kb!) ** 2
      if (distance < bestDistance) {
        bestDistance = distance
        best = at
      }
    })
    index.set(color, best)
  }
  return { colors, index }
}

/** A row's bytes under PNG filter `type` (1 sub, 2 up, 3 average, 4 Paeth) for `bpp` bytes a pixel, `prior` the row above. */
function filterRow(type: number, row: Uint8Array, prior: Uint8Array, bpp: number, out: Uint8Array, at: number) {
  out[at] = type
  for (let i = 0; i < row.length; i += 1) {
    const a = i >= bpp ? row[i - bpp]! : 0
    const b = prior[i]!
    const c = i >= bpp ? prior[i - bpp]! : 0
    let predicted = 0
    if (type === 1) predicted = a
    else if (type === 2) predicted = b
    else if (type === 3) predicted = (a + b) >> 1
    else if (type === 4) {
      const p = a + b - c
      const pa = Math.abs(p - a)
      const pb = Math.abs(p - b)
      const pc = Math.abs(p - c)
      predicted = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
    }
    out[at + 1 + i] = (row[i]! - predicted) & 255
  }
}

/** The filter whose output has the smallest sum of absolute (signed) bytes: the usual guess at what compresses best. */
function bestFiltered(row: Uint8Array, prior: Uint8Array, bpp: number, scratch: Uint8Array, out: Uint8Array, at: number) {
  let best = -1
  let bestSum = Infinity
  for (let type = 1; type <= 4; type += 1) {
    filterRow(type, row, prior, bpp, scratch, 0)
    let sum = 0
    for (let i = 1; i <= row.length; i += 1) {
      const value = scratch[i]!
      sum += value < 128 ? value : 256 - value
    }
    if (sum < bestSum) {
      bestSum = sum
      best = type
    }
  }
  filterRow(best, row, prior, bpp, out, at)
}

/** The page packed as small as the rules allow; `exact` are the Project's colors, kept to the last bit. */
export async function packPage(width: number, height: number, stripRows: number, strip: StripSource, exact: ReadonlySet<number>): Promise<PackedPage> {
  const rowBytes = width * 3
  const counts = await countColors(width, height, stripRows, strip)
  const chosen = counts && choosePalette(counts, exact, width * height)

  // Full color, as it always was; a picture of beads also tries each row filtered, and keeps that only when smaller.
  const plain = deflater()
  const filtered = chosen ? undefined : deflater()
  const indexed = chosen ? deflater() : undefined
  const scratch = new Uint8Array(1 + rowBytes)
  let prior = new Uint8Array(rowBytes)
  for (let y = 0; y < height; y += stripRows) {
    const rows = Math.min(stripRows, height - y)
    const rgba = await strip(y, rows)
    const plainBand = new Uint8Array(rows * (1 + rowBytes))
    const filteredBand = filtered ? new Uint8Array(rows * (1 + rowBytes)) : undefined
    const indexedBand = chosen ? new Uint8Array(rows * (1 + width)) : undefined
    for (let row = 0; row < rows; row += 1) {
      const pixels = new Uint8Array(rowBytes)
      for (let from = row * width * 4, out = 0, end = from + width * 4; from < end; from += 4, out += 3) {
        pixels[out] = rgba[from]!
        pixels[out + 1] = rgba[from + 1]!
        pixels[out + 2] = rgba[from + 2]!
      }
      plainBand.set(pixels, row * (1 + rowBytes) + 1)
      if (filteredBand) bestFiltered(pixels, prior, 3, scratch, filteredBand, row * (1 + rowBytes))
      if (indexedBand && chosen) {
        let at = row * (1 + width) + 1
        for (let from = 0; from < rowBytes; from += 3, at += 1) {
          indexedBand[at] = chosen.index.get((pixels[from]! << 16) | (pixels[from + 1]! << 8) | pixels[from + 2]!)!
        }
      }
      prior = pixels
    }
    await plain.write(plainBand)
    if (filtered && filteredBand) await filtered.write(filteredBand)
    if (indexed && indexedBand) await indexed.write(indexedBand)
  }
  const [plainParts, filteredParts, indexedParts] = await Promise.all([plain.finish(), filtered?.finish(), indexed?.finish()])

  if (chosen && indexedParts && size(indexedParts) + chosen.colors.length * 6 < size(plainParts)) {
    return { width, height, flate: indexedParts, palette: Uint8Array.from(chosen.colors.flatMap(packed)) }
  }
  if (filteredParts && size(filteredParts) < size(plainParts)) return { width, height, flate: filteredParts }
  return { width, height, flate: plainParts }
}
