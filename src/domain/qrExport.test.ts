import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG } from './beads'
import type { PixelData } from './imageConversion'
import { createPattern, type Pattern } from './pattern'
import {
  decodeQrText,
  fitsInQrCode,
  parsePatternFromQr,
  parsePatternFromQrImage,
  patternQrMatrix,
  serializePatternForQr,
} from './qrExport'
import { denselyColoredGrid } from '../testUtils/denselyColoredGrid'
import { rasterizeQrMatrix } from '../testUtils/rasterizeQrMatrix'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

function smallPattern(): Pattern {
  // 6 columns x 6 rows.
  return createPattern({ technique: 'loom', beadId: cubeBead.id, size: { width: 9, height: 9, unit: 'mm' } })
}

/** 60 x 90 -- the exact size ADR 0009 measures its own compact encoding against. */
function largePattern(): Pattern {
  return createPattern({ technique: 'loom', beadId: cubeBead.id, size: { width: 90, height: 135, unit: 'mm' } })
}

describe('serializePatternForQr / parsePatternFromQr', () => {
  it('round-trips a Pattern exactly', () => {
    let pattern = smallPattern()
    pattern = { ...pattern, grid: denselyColoredGrid(pattern.columns, pattern.rows) }

    const text = serializePatternForQr(pattern)

    expect(parsePatternFromQr(text)).toEqual(pattern)
  })

  it('round-trips an unpainted Pattern', () => {
    const pattern = smallPattern()

    expect(parsePatternFromQr(serializePatternForQr(pattern))).toEqual(pattern)
  })

  it('rejects text that is not valid JSON', () => {
    expect(() => parsePatternFromQr('not json')).toThrow()
  })

  it('rejects a QR code this app did not write', () => {
    expect(() => parsePatternFromQr(JSON.stringify({ hello: 'world' }))).toThrow()
  })

  it('rejects an unsupported format version', () => {
    const text = serializePatternForQr(smallPattern())
    const tampered = { ...JSON.parse(text), version: 999 }

    expect(() => parsePatternFromQr(JSON.stringify(tampered))).toThrow(/version/)
  })
})

describe('patternQrMatrix / fitsInQrCode', () => {
  it('fits an ordinary small Pattern in a single QR code', () => {
    const pattern = smallPattern()

    expect(fitsInQrCode(pattern)).toBe(true)
    const matrix = patternQrMatrix(pattern)
    expect(matrix).toBeDefined()
    expect(matrix!.size).toBeGreaterThanOrEqual(21) // smallest possible QR (version 1) is 21x21
  })

  it('has at least one dark and one light module (a real QR code, not a blank grid)', () => {
    const matrix = patternQrMatrix(smallPattern())!

    let sawDark = false
    let sawLight = false
    for (let row = 0; row < matrix.size; row++) {
      for (let column = 0; column < matrix.size; column++) {
        if (matrix.isDark(row, column)) {
          sawDark = true
        } else {
          sawLight = true
        }
      }
    }
    expect(sawDark).toBe(true)
    expect(sawLight).toBe(true)
  })

  it('reports a densely-painted large Pattern as too large for a single QR code', () => {
    let pattern = largePattern()
    pattern = { ...pattern, grid: denselyColoredGrid(pattern.columns, pattern.rows) }

    // Same shape ADR 0009 measures as its own worst case; well past a QR code's ~2.9KB capacity even RLE-compressed.
    expect(serializePatternForQr(pattern).length).toBeGreaterThan(3000)
    expect(fitsInQrCode(pattern)).toBe(false)
    expect(patternQrMatrix(pattern)).toBeUndefined()
  })
})

describe('decodeQrText / parsePatternFromQrImage (the import side -- ticket 68)', () => {
  it('decodes a generated QR code back to its exact text (a jsQR decode standing in for a phone camera scan)', () => {
    const pattern = smallPattern()
    const text = serializePatternForQr(pattern)
    const matrix = patternQrMatrix(pattern)!

    expect(decodeQrText(rasterizeQrMatrix(matrix))).toBe(text)
  })

  it('reproduces the exact Pattern end to end: create -> QR matrix -> rasterized picture -> decode -> parse', () => {
    let pattern = smallPattern()
    pattern = { ...pattern, grid: denselyColoredGrid(pattern.columns, pattern.rows) }
    const matrix = patternQrMatrix(pattern)!

    const imported = parsePatternFromQrImage(rasterizeQrMatrix(matrix))

    expect(imported).toEqual(pattern)
  })

  it('reports no QR code found in a plain white picture', () => {
    const blank: PixelData = { width: 100, height: 100, data: new Uint8ClampedArray(100 * 100 * 4).fill(255) }

    expect(decodeQrText(blank)).toBeUndefined()
    expect(() => parsePatternFromQrImage(blank)).toThrow(/no qr code/i)
  })
})
