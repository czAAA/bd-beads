import type { PixelData } from '../domain/imageConversion'

// Synthetic photos for Convert image's tests (ticket 0772): drawn by a rule with a little of a photo's noise, and a
// photo of beadwork, each bead a disc with a dark hole on a plain field. The code repo is public, so no real photo.

export type Rgb = [number, number, number]

/** A picture drawn by a function of each pixel's place, each channel moved by up to `noise` as a photo's grain is;
 * the same every run (a fixed pseudo-random sequence). */
export function drawPicture(width: number, height: number, at: (x: number, y: number) => Rgb, noise = 10): PixelData {
  const data = new Uint8ClampedArray(width * height * 4)
  let seed = 7
  const jitter = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return noise === 0 ? 0 : ((seed >> 8) % (2 * noise + 1)) - noise
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = at(x, y)
      data.set([r + jitter(), g + jitter(), b + jitter(), 255], (y * width + x) * 4)
    }
  }
  return { width, height, data }
}

/** The plain field a photo of beadwork lies on, and the color seen through every bead's hole. */
export const BEAD_PHOTO_FIELD: Rgb = [210, 190, 150]
export const BEAD_PHOTO_HOLE: Rgb = [70, 60, 50]

/** A photo of `columns` × `rows` beads at `pitch` px, `margin` px of field round the piece: each bead a disc with a
 * dark hole and a highlight, in the color `beadAt` gives its place. */
export function beadPhoto(columns: number, rows: number, pitch: number, margin: number, beadAt: (column: number, row: number) => Rgb): PixelData {
  return drawPicture(columns * pitch + margin * 2, rows * pitch + margin * 2, (x, y) => {
    const column = Math.floor((x - margin) / pitch)
    const row = Math.floor((y - margin) / pitch)
    if (column < 0 || row < 0 || column >= columns || row >= rows) return BEAD_PHOTO_FIELD
    const dx = x + 0.5 - (margin + (column + 0.5) * pitch)
    const dy = y + 0.5 - (margin + (row + 0.5) * pitch)
    const d = Math.hypot(dx, dy) / (pitch / 2)
    if (d > 0.95) return BEAD_PHOTO_FIELD
    if (d < 0.3) return BEAD_PHOTO_HOLE
    const bead = beadAt(column, row)
    const shine = dx < -2 && dy < -2 && d < 0.7 ? 40 : 0
    return [Math.min(255, bead[0] + shine), Math.min(255, bead[1] + shine), Math.min(255, bead[2] + shine)]
  })
}
