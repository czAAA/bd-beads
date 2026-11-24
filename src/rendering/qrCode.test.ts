import jsQR from 'jsqr'
import { describe, expect, it } from 'vitest'
import { qrMatrix, type QrMatrix } from './qrCode'

/** The matrix as an RGBA picture with a four-module quiet zone, `scale` px a module, for a decoder to read. */
function picture(matrix: QrMatrix, scale = 6): { data: Uint8ClampedArray; width: number } {
  const modules = matrix.length + 8
  const width = modules * scale
  const data = new Uint8ClampedArray(width * width * 4).fill(255)
  matrix.forEach((row, r) =>
    row.forEach((dark, c) => {
      if (!dark) return
      for (let y = 0; y < scale; y += 1) {
        for (let x = 0; x < scale; x += 1) {
          const at = (((r + 4) * scale + y) * width + (c + 4) * scale + x) * 4
          data[at] = data[at + 1] = data[at + 2] = 0
        }
      }
    }),
  )
  return { data, width }
}

describe('qrMatrix', () => {
  it('is a 25 × 25 code that a QR reader decodes to the address', () => {
    const matrix = qrMatrix('https://openbeads.com')
    expect(matrix).toHaveLength(25)
    const { data, width } = picture(matrix)
    expect(jsQR(data, width, width)?.data).toBe('https://openbeads.com')
  })

  it('reads back other strings too, so the encoder is not tuned to one', () => {
    for (const value of ['a', 'https://example.org/x?y=1', 'openbeads.com/app/']) {
      const { data, width } = picture(qrMatrix(value))
      expect(jsQR(data, width, width)?.data).toBe(value)
    }
  })

  it('refuses a string that does not fit', () => {
    expect(() => qrMatrix('x'.repeat(27))).toThrow()
  })
})
