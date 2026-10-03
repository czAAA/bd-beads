// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG } from './beads'
import type { PixelData } from './imageConversion'
import { createPattern, withFrameGrid, type Pattern } from './pattern'
import { encodePattern } from './patternEncoding'
import {
  decodeQrText,
  fitsInQrCode,
  parsePatternFromQr,
  parsePatternFromQrImage,
  patternFromShareLink,
  patternQrMatrix,
  serializePatternForQr,
} from './qrExport'
import { denselyColoredGrid } from '../testUtils/denselyColoredGrid'
import { rasterizeQrMatrix } from '../testUtils/rasterizeQrMatrix'

const APP_URL = 'https://czaaa.github.io/bd-beads/'

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
    pattern = withFrameGrid(pattern, denselyColoredGrid(pattern.frame!.columns, pattern.frame!.rows))

    const text = serializePatternForQr(pattern, APP_URL)

    expect(parsePatternFromQr(text)).toEqual(pattern)
  })

  it('round-trips an unpainted Pattern', () => {
    const pattern = smallPattern()

    expect(parsePatternFromQr(serializePatternForQr(pattern, APP_URL))).toEqual(pattern)
  })

  it('is a link to the app, so a camera opens it in the browser instead of showing text', () => {
    const text = serializePatternForQr(smallPattern(), APP_URL)

    expect(text.startsWith(`${APP_URL}#pattern=`)).toBe(true)
    expect(text).toMatch(/^[\x21-\x7e]+$/) // printable ASCII only: nothing a scanner or browser would re-escape
  })

  it('round-trips a Pattern whose name is not ASCII', () => {
    const pattern = { ...smallPattern(), name: 'Узор «Ёлка» 🎄' }

    expect(parsePatternFromQr(serializePatternForQr(pattern, APP_URL))).toEqual(pattern)
  })

  it('still reads the bare JSON an earlier build wrote to its codes', () => {
    const pattern = smallPattern()
    const bare = JSON.stringify({ kind: 'bd-beads/qr-pattern', version: 1, pattern: encodePattern(pattern) })

    expect(parsePatternFromQr(bare)).toEqual(pattern)
  })

  it('rejects a link whose payload is damaged', () => {
    expect(() => parsePatternFromQr(`${APP_URL}#pattern=***`)).toThrow()
    expect(() => parsePatternFromQr(`${APP_URL}#pattern=e30`)).toThrow() // "{}": valid base64, not this app's envelope
  })

  it('rejects text that is not valid JSON', () => {
    expect(() => parsePatternFromQr('not json')).toThrow()
  })

  it('rejects a QR code this app did not write', () => {
    expect(() => parsePatternFromQr(JSON.stringify({ hello: 'world' }))).toThrow()
  })

  it('rejects an unsupported format version', () => {
    const link = serializePatternForQr(smallPattern(), APP_URL)
    const envelope = JSON.parse(atob(link.slice(link.indexOf('#pattern=') + 9).replaceAll('-', '+').replaceAll('_', '/')))
    const tampered = { ...envelope, version: 999 }

    expect(() => parsePatternFromQr(JSON.stringify(tampered))).toThrow(/version/)
  })
})

describe('what a QR code carries (ticket 233)', () => {
  it('holds the Frame\'s beads only, leaving out what lies outside it', () => {
    const base = smallPattern()
    const pattern: Pattern = { ...base, beads: { ...base.beads, 0: { ...base.beads[0], 0: '#e63746' }, 90: { 90: '#2f6fed' } } }
    const read = parsePatternFromQr(serializePatternForQr(pattern, APP_URL))

    expect(read.frame).toEqual(pattern.frame)
    expect(read.beads[0]![0]).toBe('#e63746')
    expect(read.beads[90]).toBeUndefined()
  })
})

describe('patternQrMatrix / fitsInQrCode', () => {
  it('fits an ordinary small Pattern in a single QR code', () => {
    const pattern = smallPattern()

    expect(fitsInQrCode(pattern, APP_URL)).toBe(true)
    const matrix = patternQrMatrix(pattern, APP_URL)
    expect(matrix).toBeDefined()
    expect(matrix!.size).toBeGreaterThanOrEqual(21) // smallest possible QR (version 1) is 21x21
  })

  it('has at least one dark and one light module (a real QR code, not a blank grid)', () => {
    const matrix = patternQrMatrix(smallPattern(), APP_URL)!

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
    pattern = withFrameGrid(pattern, denselyColoredGrid(pattern.frame!.columns, pattern.frame!.rows))

    // Same shape ADR 0009 measures as its own worst case; well past a QR code's ~2.9KB capacity even RLE-compressed.
    expect(serializePatternForQr(pattern, APP_URL).length).toBeGreaterThan(3000)
    expect(fitsInQrCode(pattern, APP_URL)).toBe(false)
    expect(patternQrMatrix(pattern, APP_URL)).toBeUndefined()
  })
})

describe('patternFromShareLink (what the page does with its own URL after a scan)', () => {
  it('reads the Pattern out of a location.hash', () => {
    const pattern = smallPattern()
    const link = serializePatternForQr(pattern, APP_URL)

    expect(patternFromShareLink(link.slice(link.indexOf('#')))).toEqual(pattern)
  })

  it('is undefined for an ordinary page load', () => {
    expect(patternFromShareLink('')).toBeUndefined()
    expect(patternFromShareLink('#something-else')).toBeUndefined()
  })
})

describe('decodeQrText / parsePatternFromQrImage (the import side -- ticket 68)', () => {
  it('decodes a generated QR code back to its exact text (a jsQR decode standing in for a phone camera scan)', () => {
    const pattern = smallPattern()
    const text = serializePatternForQr(pattern, APP_URL)
    const matrix = patternQrMatrix(pattern, APP_URL)!

    expect(decodeQrText(rasterizeQrMatrix(matrix))).toBe(text)
  })

  it('reproduces the exact Pattern end to end: create -> QR matrix -> rasterized picture -> decode -> parse', () => {
    let pattern = smallPattern()
    pattern = withFrameGrid(pattern, denselyColoredGrid(pattern.frame!.columns, pattern.frame!.rows))
    const matrix = patternQrMatrix(pattern, APP_URL)!

    const imported = parsePatternFromQrImage(rasterizeQrMatrix(matrix))

    expect(imported).toEqual(pattern)
  })

  it('reports no QR code found in a plain white picture', () => {
    const blank: PixelData = { width: 100, height: 100, data: new Uint8ClampedArray(100 * 100 * 4).fill(255) }

    expect(decodeQrText(blank)).toBeUndefined()
    expect(() => parsePatternFromQrImage(blank)).toThrow(/no qr code/i)
  })
})
