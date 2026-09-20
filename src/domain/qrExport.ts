import { create as createQrCode } from 'qrcode'
import jsQR from 'jsqr'
import type { PixelData } from './imageConversion'
import { normalizePattern, type Pattern } from './pattern'
import { decodePattern, encodePattern, type EncodedPattern } from './patternEncoding'

/**
 * QR export (ticket 68, ADR 0015): a Pattern encoded with the same compact run-length color-table encoding
 * localStorage uses (ADR 0009) rather than the verbose, human-readable Pattern-file JSON (ADR 0009's own "exported
 * files keep today's readable JSON" decision) — a single QR code holds roughly 2.9KB, while an ordinary Pattern
 * file is already 103KB before a single Pattern gets anywhere near that.
 *
 * Its own minimal envelope, distinct from patternFile.ts's (`bd-beads/pattern`, pretty-printed) and
 * patternStorage.ts's (a whole-library array): one Pattern, no whitespace, since every byte here is budgeted.
 */
const QR_FILE_KIND = 'bd-beads/qr-pattern'
const QR_FILE_VERSION = 1

interface QrPatternFile {
  kind: typeof QR_FILE_KIND
  version: number
  pattern: EncodedPattern
}

/** The bytes a QR export's payload weighs, compactly encoded. What fitsInQrCode/patternQrMatrix actually measure against a QR code's real capacity — see createQrCode's own overflow, not a guessed byte count. */
export function serializePatternForQr(pattern: Pattern): string {
  const file: QrPatternFile = { kind: QR_FILE_KIND, version: QR_FILE_VERSION, pattern: encodePattern(pattern) }
  return JSON.stringify(file)
}

/** Reads a Pattern back out of what a QR export encoded (see serializePatternForQr). Throws on anything else — a QR code this app didn't write, or a version this build doesn't know. */
export function parsePatternFromQr(text: string): Pattern {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Not a bd-beads QR code: it is not valid JSON')
  }

  const file = parsed as Partial<QrPatternFile> | null
  if (typeof file !== 'object' || file === null || file.kind !== QR_FILE_KIND) {
    throw new Error('Not a bd-beads QR code')
  }
  if (file.version !== QR_FILE_VERSION) {
    throw new Error(`Unsupported bd-beads QR code version: ${String(file.version)}`)
  }
  if (!file.pattern) {
    throw new Error('This QR code does not contain a readable Pattern')
  }

  return normalizePattern(decodePattern(file.pattern))
}

/** A QR code's module grid, framework-agnostic so a component can render it however it likes (inline SVG here). */
export interface QrMatrix {
  size: number
  isDark(row: number, column: number): boolean
}

/**
 * The QR code for a Pattern's compact-encoded payload, at the lowest error-correction level ('L') for maximum
 * capacity — Convert image and the rest of this app have no redundancy need a scanner's own retry doesn't already
 * cover, so there's nothing this feature gains from a higher level's added robustness that its shrunk capacity is
 * worth trading away.
 *
 * Undefined once the payload is too large for even a version-40 QR code at that level: `createQrCode`'s own capacity
 * table is the source of truth for the cap (documented at roughly 2.9KB per ADR 0015), not a byte count duplicated
 * here that could drift from it.
 */
export function patternQrMatrix(pattern: Pattern): QrMatrix | undefined {
  try {
    const { modules } = createQrCode(serializePatternForQr(pattern), { errorCorrectionLevel: 'L' })
    return { size: modules.size, isDark: (row, column) => modules.get(row, column) === 1 }
  } catch {
    return undefined
  }
}

/** Whether a Pattern's QR payload fits in a single QR code (ticket 68's size cap) — the fallback trigger for "too large for QR". */
export function fitsInQrCode(pattern: Pattern): boolean {
  return patternQrMatrix(pattern) !== undefined
}

/**
 * Decodes whatever QR code is in a picture (ticket 68's import side — scanning on another device, then picking the
 * photo/screenshot here), reusing imageDecode.ts's PixelData shape so this shares the same file-to-pixels step
 * Convert image already has, rather than a second one of its own. Undefined when no QR code is found in the picture.
 */
export function decodeQrText(pixels: PixelData): string | undefined {
  const data = pixels.data instanceof Uint8ClampedArray ? pixels.data : Uint8ClampedArray.from(pixels.data)
  return jsQR(data, pixels.width, pixels.height)?.data
}

/** The full import path: a picture believed to contain one of this app's QR exports, straight to the Pattern it encoded. Throws when the picture holds no QR code, or one this app didn't write. */
export function parsePatternFromQrImage(pixels: PixelData): Pattern {
  const text = decodeQrText(pixels)
  if (text === undefined) {
    throw new Error('No QR code found in that picture')
  }
  return parsePatternFromQr(text)
}
