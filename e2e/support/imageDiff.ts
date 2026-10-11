import { PNG } from 'pngjs'

/**
 * How many blocks of two same-sized screenshots differ, each image first reduced to the average color of every
 * `block` × `block` square of pixels. Averaging is what makes this indifferent to where exactly an edge falls inside a
 * pixel or two (anti-aliasing, a box that landed half a pixel over), while a bead in another color, a missing bead or an
 * overlay in the wrong place still moves the average of every block it covers by far more than `tolerance`.
 */
export function differingBlocks(actual: Buffer, expected: Buffer, block = 4, tolerance = 48): number | string {
  const a = PNG.sync.read(actual)
  const b = PNG.sync.read(expected)
  if (a.width !== b.width || a.height !== b.height) {
    return `size ${a.width}×${a.height}, expected ${b.width}×${b.height}`
  }

  const mean = (image: PNG, left: number, top: number): [number, number, number] => {
    const sum = [0, 0, 0]
    let count = 0
    for (let y = top; y < Math.min(top + block, image.height); y += 1) {
      for (let x = left; x < Math.min(left + block, image.width); x += 1) {
        const index = (y * image.width + x) * 4
        sum[0]! += image.data[index]!
        sum[1]! += image.data[index + 1]!
        sum[2]! += image.data[index + 2]!
        count += 1
      }
    }
    return [sum[0]! / count, sum[1]! / count, sum[2]! / count]
  }

  let differing = 0
  for (let top = 0; top < a.height; top += block) {
    for (let left = 0; left < a.width; left += block) {
      const one = mean(a, left, top)
      const other = mean(b, left, top)
      if (one.some((channel, index) => Math.abs(channel - other[index]!) > tolerance)) {
        differing += 1
      }
    }
  }
  return differing
}
