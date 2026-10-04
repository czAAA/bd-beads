/**
 * A PNG written strip by strip (ticket 73), so a picture too big for one canvas (a 250 × 250 Project at a legible bead
 * size is far past what iPad Safari will make) can still be one file: the caller draws a band of rows at a time, this
 * compresses each as it arrives, and only the compressed bytes are kept. Compression is the browser's own
 * (`CompressionStream`, whose "deflate" is the zlib format a PNG's data is in).
 */

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

/**
 * An opaque 8-bit RGB PNG, `width` × `height`, read `stripRows` rows at a time from `strip` (whose alpha is ignored).
 */
export async function encodePng(width: number, height: number, stripRows: number, strip: StripSource): Promise<Blob> {
  const header = new Uint8Array(13)
  const headerView = new DataView(header.buffer)
  headerView.setUint32(0, width)
  headerView.setUint32(4, height)
  header.set([8, 2, 0, 0, 0], 8) // 8 bits, RGB, deflate, no filter method variations, no interlace

  const compression = new CompressionStream('deflate')
  const writer = compression.writable.getWriter()
  const compressed: Uint8Array[] = []
  const reading = (async () => {
    const reader = compression.readable.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) {
        return
      }
      compressed.push(chunk('IDAT', value))
    }
  })()

  const rowBytes = 1 + width * 3
  for (let y = 0; y < height; y += stripRows) {
    const rows = Math.min(stripRows, height - y)
    const rgba = await strip(y, rows)
    const scanlines = new Uint8Array(rows * rowBytes)
    for (let row = 0; row < rows; row += 1) {
      // Each scanline starts with its filter type: 0, none.
      let out = row * rowBytes + 1
      for (let from = row * width * 4, end = from + width * 4; from < end; from += 4) {
        scanlines[out] = rgba[from]!
        scanlines[out + 1] = rgba[from + 1]!
        scanlines[out + 2] = rgba[from + 2]!
        out += 3
      }
    }
    await writer.write(scanlines)
  }
  await writer.close()
  await reading

  return new Blob([SIGNATURE as BlobPart, chunk('IHDR', header) as BlobPart, ...(compressed as BlobPart[]), chunk('IEND', new Uint8Array(0)) as BlobPart], {
    type: 'image/png',
  })
}
