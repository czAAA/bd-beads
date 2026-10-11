import { deflateSync } from 'node:zlib'

/**
 * A small PNG to convert (ticket 103's framing fixtures), built here rather than committed so the picture is
 * readable as code: a sky-to-grass gradient with a sun and a dark hill, in a handful of clearly different colors so
 * that reducing to a few Image colors has real choices to make.
 */
export function fixturePicture(width = 240, height = 160): Buffer {
  const pixel = (x: number, y: number): [number, number, number] => {
    const sun = Math.hypot(x - width * 0.72, y - height * 0.3) < height * 0.16
    if (sun) {
      return [242, 201, 76]
    }
    const hill = y > height * 0.62 + Math.sin((x / width) * Math.PI * 2) * height * 0.1
    if (hill) {
      return x < width / 2 ? [39, 174, 96] : [31, 31, 31]
    }
    const t = y / (height * 0.7)
    return [Math.round(47 + 150 * t), Math.round(111 + 90 * t), Math.round(237 - 40 * t)]
  }

  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1)
    raw[rowStart] = 0
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = pixel(x, y)
      raw.set([r, g, b, 255], rowStart + 1 + x * 4)
    }
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 6, 0, 0, 0], 8)

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const CRC_TABLE = Array.from({ length: 256 }, (_value, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  return c >>> 0
})

function crc32(data: Buffer): number {
  let crc = 0xffffffff
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([length, body, crc])
}
