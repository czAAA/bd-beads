import type { Pattern } from '../domain/pattern'

export interface ThumbnailImage {
  width: number
  height: number
  /** RGBA, row by row, as ImageData takes it. */
  data: Uint8ClampedArray
}

/** "#rrggbb" as [r, g, b]; anything else is left clear. */
function rgb(hex: string): [number, number, number] | undefined {
  const match = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!match) return undefined
  const value = Number.parseInt(match[1]!, 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

/**
 * A Saved Pattern's thumbnail (ticket 147; SavedPatterns card): the whole Pattern fitted into `size` pixels on its
 * longer side, square beads, turned as it shows on screen, empty beads left clear. Each pixel samples the bead under
 * it, so a Pattern of any size costs at most size × size lookups (ADR 0019: no size limit).
 */
export function thumbnailPixels(pattern: Pattern, size: number): ThumbnailImage {
  const [across, down] = pattern.rotated ? [pattern.rows, pattern.columns] : [pattern.columns, pattern.rows]
  const scale = size / Math.max(across, down)
  const width = Math.max(1, Math.round(across * scale))
  const height = Math.max(1, Math.round(down * scale))
  const data = new Uint8ClampedArray(width * height * 4)
  const colors = new Map<string, [number, number, number] | undefined>()

  for (let y = 0; y < height; y += 1) {
    const shownRow = Math.min(down - 1, Math.floor(y / scale))
    for (let x = 0; x < width; x += 1) {
      const shownColumn = Math.min(across - 1, Math.floor(x / scale))
      // Rotated a quarter clockwise: what shows at (row, column) is grid row (rows - 1 - column), column row.
      const [row, column] = pattern.rotated ? [pattern.rows - 1 - shownColumn, shownRow] : [shownRow, shownColumn]
      const hex = pattern.grid[row]?.[column]?.color
      if (!hex) continue
      if (!colors.has(hex)) colors.set(hex, rgb(hex))
      const color = colors.get(hex)
      if (!color) continue
      const at = (y * width + x) * 4
      data[at] = color[0]
      data[at + 1] = color[1]
      data[at + 2] = color[2]
      data[at + 3] = 255
    }
  }

  return { width, height, data }
}
