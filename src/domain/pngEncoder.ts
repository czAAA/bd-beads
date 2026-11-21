import { packPage, type PackedPage } from './pagePacking'

/** A PNG written strip by strip (ticket 73), so a picture too big for one canvas (iPad Safari's limit) is still one
 * file: the caller draws a band of rows, this compresses it and keeps only the bytes. Compression is the browser's
 * `CompressionStream` ("deflate" is the zlib format a PNG's data is in). */

const SIGNATURE = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10)

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let bit = 0; bit < 8; bit += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(12 + data.length)
  const view = new DataView(bytes.buffer)
  view.setUint32(0, data.length)
  for (let i = 0; i < 4; i += 1) {
    bytes[4 + i] = type.charCodeAt(i)
  }
  bytes.set(data, 8)
  view.setUint32(8 + data.length, crc32(bytes.subarray(4, 8 + data.length)))
  return bytes
}

/** A band of the picture: `rows` full rows of RGBA pixels, `width` across, starting `y` rows down. */
export type StripSource = (y: number, rows: number) => Uint8ClampedArray | Promise<Uint8ClampedArray>

/** `text` zlib-compressed (ASCII, as a PDF page's drawing operators are): a PDF stream's FlateDecode data (ticket 0585). */
export async function deflateText(text: string): Promise<Uint8Array> {
  const compressed = new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('deflate')))
  return new Uint8Array(await compressed.arrayBuffer())
}

/** A packed page (`packPage`, ticket 1142) as a PNG: RGB, or palette-indexed when it was packed to 256 colors or fewer. */
function pngOfPacked(page: PackedPage): Blob {
  const header = new Uint8Array(13)
  const headerView = new DataView(header.buffer)
  headerView.setUint32(0, page.width)
  headerView.setUint32(4, page.height)
  header.set([8, page.palette ? 3 : 2, 0, 0, 0], 8) // 8 bits, indexed or RGB, deflate, filter method 0, no interlace
  const palette = page.palette ? [chunk('PLTE', page.palette)] : []
  const data = page.flate.map((part) => chunk('IDAT', part))
  return new Blob([SIGNATURE as BlobPart, chunk('IHDR', header) as BlobPart, ...(palette as BlobPart[]), ...(data as BlobPart[]), chunk('IEND', new Uint8Array(0)) as BlobPart], {
    type: 'image/png',
  })
}

/** An opaque PNG read `stripRows` rows at a time from `strip` (alpha ignored), packed as small as keeps `exact` (ticket 1142). */
export async function encodePng(width: number, height: number, stripRows: number, strip: StripSource, exact: ReadonlySet<number> = new Set()): Promise<Blob> {
  return pngOfPacked(await packPage(width, height, stripRows, strip, exact))
}
