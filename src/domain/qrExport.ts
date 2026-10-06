import { create as createQrCode } from 'qrcode'
import jsQR from 'jsqr'
import type { PixelData } from './imageConversion'
import { beadsInFrame } from './canvas'
import { normalizeProject, type Project } from './project'
import { decodeProject, encodeProject, type EncodedGridProject, type EncodedProject } from './projectEncoding'

/**
 * QR export (ticket 68, ADR 0015): a Project encoded with the same compact run-length color-table encoding
 * localStorage uses (ADR 0009) rather than the verbose, human-readable Project-file JSON (ADR 0009's own "exported
 * files keep today's readable JSON" decision) — a single QR code holds roughly 2.9KB, while an ordinary Project
 * file is already 103KB before a single Project gets anywhere near that.
 *
 * Its own minimal envelope, distinct from projectFile.ts's (`bd-beads/pattern`, pretty-printed) and
 * projectStorage.ts's (a whole-library array): one Project, no whitespace, since every byte here is budgeted.
 *
 * The code doesn't hold that envelope bare, it holds a link to this app with the envelope in the URL's fragment: a
 * phone or tablet camera opens a bare JSON payload as plain text, but opens a link in the browser, which loads the
 * app and (see projectFromShareLink) opens the Project on the device that scanned it. The fragment never goes to the
 * server, and needs no backend, so ADR 0014's local-only stance holds.
 */
const QR_FILE_KIND = 'bd-beads/qr-pattern'
/** Version 1 carried a fixed grid (`cells`); version 2 carries beads by position and a Frame (ADR 0026). Both are read, only 2 is written. */
const QR_FILE_VERSION = 2
const QR_FILE_VERSIONS: readonly number[] = [1, 2]

interface QrProjectFile {
  kind: typeof QR_FILE_KIND
  version: number
  // The key stays `pattern` on disk (ADR 0028): printed QR codes already use it.
  pattern: EncodedProject | EncodedGridProject
}

/** The fragment key the link carries the Project under: `<app url>#pattern=<base64url of the envelope>`. */
const SHARE_FRAGMENT_KEY = 'pattern='

/** URL-safe base64 (no padding, `-`/`_`) of the text's UTF-8 bytes: safe in a fragment untouched by any scanner or browser, and safe for a Project name in any script. */
function toBase64Url(text: string): string {
  const binary = Array.from(new TextEncoder().encode(text), (byte) => String.fromCharCode(byte)).join('')
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function fromBase64Url(encoded: string): string {
  const binary = atob(encoded.replaceAll('-', '+').replaceAll('_', '/'))
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)))
}

/**
 * The bytes a QR export's payload weighs: a link to `appUrl` (the address of this app's page, without any fragment
 * of its own) carrying the compactly encoded Project. What projectQrMatrix actually measures against a
 * QR code's real capacity — see createQrCode's own overflow, not a guessed byte count.
 */
export function serializeProjectForQr(project: Project, appUrl: string): string {
  // The code carries the Project, which is the Frame's beads: whatever else is on the canvas stays off it (v16).
  const carried = project.frame ? { ...project, beads: beadsInFrame(project.beads, project.frame) } : project
  const file: QrProjectFile = { kind: QR_FILE_KIND, version: QR_FILE_VERSION, pattern: encodeProject(carried) }
  return `${appUrl}#${SHARE_FRAGMENT_KEY}${toBase64Url(JSON.stringify(file))}`
}

/**
 * Reads a Project back out of what a QR export encoded (see serializeProjectForQr): the share link, or the bare
 * envelope JSON an earlier build wrote to its codes, which are still out there as printed or saved pictures. Throws
 * on anything else — a QR code this app didn't write, or a version this build doesn't know.
 */
export function parseProjectFromQr(text: string): Project {
  const fragmentStart = text.indexOf(`#${SHARE_FRAGMENT_KEY}`)
  if (fragmentStart !== -1) {
    return parseProjectFromShareFragment(text.slice(fragmentStart + 1))
  }
  return parseEnvelope(text)
}

/**
 * The Project a page was opened with, from its `location.hash` — what scanning a QR export's link lands on. Undefined
 * when the hash isn't a share link at all (the ordinary case: nothing to import); throws when it is one but can't be
 * read, so the caller can tell "nothing here" from "a link that's broken".
 */
export function projectFromShareLink(hash: string): Project | undefined {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash
  return fragment.startsWith(SHARE_FRAGMENT_KEY) ? parseProjectFromShareFragment(fragment) : undefined
}

function parseProjectFromShareFragment(fragment: string): Project {
  let json: string
  try {
    json = fromBase64Url(fragment.slice(SHARE_FRAGMENT_KEY.length))
  } catch {
    throw new Error('Not a bd-beads QR code: its link is damaged')
  }
  return parseEnvelope(json)
}

function parseEnvelope(text: string): Project {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Not a bd-beads QR code: it is not valid JSON')
  }

  const file = parsed as Partial<QrProjectFile> | null
  if (typeof file !== 'object' || file === null || file.kind !== QR_FILE_KIND) {
    throw new Error('Not a bd-beads QR code')
  }
  if (typeof file.version !== 'number' || !QR_FILE_VERSIONS.includes(file.version)) {
    throw new Error(`Unsupported bd-beads QR code version: ${String(file.version)}`)
  }
  if (!file.pattern) {
    throw new Error('This QR code does not contain a readable Project')
  }

  return normalizeProject(decodeProject(file.pattern))
}

/**
 * The most bytes any QR code can hold: version 40 at error-correction level 'L' in byte mode, fixed by the QR
 * specification. The payload is printable ASCII, so its length in characters is its length in bytes. Only a cheap
 * early "no" — a payload over it would make `createQrCode` do a full-size encode just to throw, tens of milliseconds
 * for a big Project — while createQrCode's own overflow stays the source of truth for everything under it.
 */
const MAX_QR_BYTES = 2953

/** A QR code's module grid, framework-agnostic so a component can render it however it likes (inline SVG here). */
export interface QrMatrix {
  size: number
  isDark(row: number, column: number): boolean
}

/**
 * The QR code for a Project's compact-encoded payload, at the lowest error-correction level ('L') for maximum
 * capacity — Convert image and the rest of this app have no redundancy need a scanner's own retry doesn't already
 * cover, so there's nothing this feature gains from a higher level's added robustness that its shrunk capacity is
 * worth trading away.
 *
 * Undefined once the payload is too large for even a version-40 QR code at that level (documented at roughly 2.9KB per
 * ADR 0015): `createQrCode`'s own overflow decides, past the MAX_QR_BYTES shortcut.
 */
export function projectQrMatrix(project: Project, appUrl: string): QrMatrix | undefined {
  const text = serializeProjectForQr(project, appUrl)
  if (text.length > MAX_QR_BYTES) {
    return undefined
  }
  try {
    const { modules } = createQrCode(text, { errorCorrectionLevel: 'L' })
    return { size: modules.size, isDark: (row, column) => modules.get(row, column) === 1 }
  } catch {
    return undefined
  }
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

/** The full import path: a picture believed to contain one of this app's QR exports, straight to the Project it encoded. Throws when the picture holds no QR code, or one this app didn't write. */
export function parseProjectFromQrImage(pixels: PixelData): Project {
  const text = decodeQrText(pixels)
  if (text === undefined) {
    throw new Error('No QR code found in that picture')
  }
  return parseProjectFromQr(text)
}
