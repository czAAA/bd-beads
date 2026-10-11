import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import { encodePng } from './pngEncoder'

/** RGBA rows for `rows` rows from `y`, each pixel's red the row and green the column, so a misplaced band shows. */
function gradient(width: number) {
  return (y: number, rows: number) => {
    const pixels = new Uint8ClampedArray(width * rows * 4)
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < width; column += 1) {
        pixels.set([y + row, column, 7, 255], (row * width + column) * 4)
      }
    }
    return pixels
  }
}

async function decode(blob: Blob) {
  return PNG.sync.read(Buffer.from(await blob.arrayBuffer()))
}

describe('encodePng (ticket 73)', () => {
  it('writes a picture that reads back pixel for pixel, whole', async () => {
    const png = await decode(await encodePng(5, 4, 4, gradient(5)))

    expect([png.width, png.height]).toEqual([5, 4])
    expect([...png.data.subarray((2 * 5 + 3) * 4, (2 * 5 + 3) * 4 + 4)]).toEqual([2, 3, 7, 255])
  })

  it('stitches bands of rows into one picture, including a shorter last band', async () => {
    const requested: Array<[number, number]> = []
    const source = gradient(3)
    const png = await decode(
      await encodePng(3, 10, 4, (y, rows) => {
        requested.push([y, rows])
        return source(y, rows)
      }),
    )

    expect(requested).toEqual([[0, 4], [4, 4], [8, 2]])
    expect([...png.data.subarray((9 * 3 + 1) * 4, (9 * 3 + 1) * 4 + 4)]).toEqual([9, 1, 7, 255])
  })

  it('has the PNG media type', async () => {
    expect((await encodePng(1, 1, 1, gradient(1))).type).toBe('image/png')
  })
})
