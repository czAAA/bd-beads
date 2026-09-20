import type { PixelData } from '../domain/imageConversion'
import type { QrMatrix } from '../domain/qrExport'

/**
 * Rasterizes a QrMatrix (domain/qrExport.ts) into RGBA pixels a decoder can scan — standing in for a phone camera's
 * photo of the code shown on a screen, since neither jsdom nor jsQR's own tests can start from an actual photograph.
 * A standard quiet-zone margin is included so a real scanner (and jsQR) can actually lock onto the code, the same as
 * it would need to on a real picture.
 */
export function rasterizeQrMatrix(matrix: QrMatrix, moduleSizePx = 4, quietZoneModules = 4): PixelData {
  const modulesAcross = matrix.size + quietZoneModules * 2
  const side = modulesAcross * moduleSizePx
  const data = new Uint8ClampedArray(side * side * 4).fill(255)

  for (let row = 0; row < matrix.size; row++) {
    for (let column = 0; column < matrix.size; column++) {
      if (!matrix.isDark(row, column)) {
        continue
      }
      const startX = (column + quietZoneModules) * moduleSizePx
      const startY = (row + quietZoneModules) * moduleSizePx
      for (let dy = 0; dy < moduleSizePx; dy++) {
        for (let dx = 0; dx < moduleSizePx; dx++) {
          const at = ((startY + dy) * side + (startX + dx)) * 4
          data[at] = 0
          data[at + 1] = 0
          data[at + 2] = 0
          data[at + 3] = 255
        }
      }
    }
  }

  return { width: side, height: side, data }
}
