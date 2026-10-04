// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG } from './beads'
import type { PixelData } from './imageConversion'
import { createProject, withFrameGrid, type Project } from './project'
import { encodeProject } from './projectEncoding'
import {
  decodeQrText,
  fitsInQrCode,
  parseProjectFromQr,
  parseProjectFromQrImage,
  projectFromShareLink,
  projectQrMatrix,
  serializeProjectForQr,
} from './qrExport'
import { denselyColoredGrid } from '../testUtils/denselyColoredGrid'
import { rasterizeQrMatrix } from '../testUtils/rasterizeQrMatrix'

const APP_URL = 'https://czaaa.github.io/bd-beads/'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

function smallProject(): Project {
  // 6 columns x 6 rows.
  return createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 9, height: 9, unit: 'mm' } })
}

/** 60 x 90 -- the exact size ADR 0009 measures its own compact encoding against. */
function largeProject(): Project {
  return createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 90, height: 135, unit: 'mm' } })
}

describe('serializeProjectForQr / parseProjectFromQr', () => {
  it('round-trips a Project exactly', () => {
    let project = smallProject()
    project = withFrameGrid(project, denselyColoredGrid(project.frame!.columns, project.frame!.rows))

    const text = serializeProjectForQr(project, APP_URL)

    expect(parseProjectFromQr(text)).toEqual(project)
  })

  it('round-trips an unpainted Project', () => {
    const project = smallProject()

    expect(parseProjectFromQr(serializeProjectForQr(project, APP_URL))).toEqual(project)
  })

  it('is a link to the app, so a camera opens it in the browser instead of showing text', () => {
    const text = serializeProjectForQr(smallProject(), APP_URL)

    expect(text.startsWith(`${APP_URL}#pattern=`)).toBe(true)
    expect(text).toMatch(/^[\x21-\x7e]+$/) // printable ASCII only: nothing a scanner or browser would re-escape
  })

  it('round-trips a Project whose name is not ASCII', () => {
    const project = { ...smallProject(), name: 'Узор «Ёлка» 🎄' }

    expect(parseProjectFromQr(serializeProjectForQr(project, APP_URL))).toEqual(project)
  })

  it('still reads the bare JSON an earlier build wrote to its codes', () => {
    const project = smallProject()
    const bare = JSON.stringify({ kind: 'bd-beads/qr-pattern', version: 1, pattern: encodeProject(project) })

    expect(parseProjectFromQr(bare)).toEqual(project)
  })

  it('rejects a link whose payload is damaged', () => {
    expect(() => parseProjectFromQr(`${APP_URL}#pattern=***`)).toThrow()
    expect(() => parseProjectFromQr(`${APP_URL}#pattern=e30`)).toThrow() // "{}": valid base64, not this app's envelope
  })

  it('rejects text that is not valid JSON', () => {
    expect(() => parseProjectFromQr('not json')).toThrow()
  })

  it('rejects a QR code this app did not write', () => {
    expect(() => parseProjectFromQr(JSON.stringify({ hello: 'world' }))).toThrow()
  })

  it('rejects an unsupported format version', () => {
    const link = serializeProjectForQr(smallProject(), APP_URL)
    const envelope = JSON.parse(atob(link.slice(link.indexOf('#pattern=') + 9).replaceAll('-', '+').replaceAll('_', '/')))
    const tampered = { ...envelope, version: 999 }

    expect(() => parseProjectFromQr(JSON.stringify(tampered))).toThrow(/version/)
  })
})

describe('what a QR code carries (ticket 233)', () => {
  it('holds the Frame\'s beads only, leaving out what lies outside it', () => {
    const base = smallProject()
    const project: Project = { ...base, beads: { ...base.beads, 0: { ...base.beads[0], 0: '#e63746' }, 90: { 90: '#2f6fed' } } }
    const read = parseProjectFromQr(serializeProjectForQr(project, APP_URL))

    expect(read.frame).toEqual(project.frame)
    expect(read.beads[0]![0]).toBe('#e63746')
    expect(read.beads[90]).toBeUndefined()
  })
})

describe('projectQrMatrix / fitsInQrCode', () => {
  it('fits an ordinary small Project in a single QR code', () => {
    const project = smallProject()

    expect(fitsInQrCode(project, APP_URL)).toBe(true)
    const matrix = projectQrMatrix(project, APP_URL)
    expect(matrix).toBeDefined()
    expect(matrix!.size).toBeGreaterThanOrEqual(21) // smallest possible QR (version 1) is 21x21
  })

  it('has at least one dark and one light module (a real QR code, not a blank grid)', () => {
    const matrix = projectQrMatrix(smallProject(), APP_URL)!

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

  it('reports a densely-painted large Project as too large for a single QR code', () => {
    let project = largeProject()
    project = withFrameGrid(project, denselyColoredGrid(project.frame!.columns, project.frame!.rows))

    // Same shape ADR 0009 measures as its own worst case; well past a QR code's ~2.9KB capacity even RLE-compressed.
    expect(serializeProjectForQr(project, APP_URL).length).toBeGreaterThan(3000)
    expect(fitsInQrCode(project, APP_URL)).toBe(false)
    expect(projectQrMatrix(project, APP_URL)).toBeUndefined()
  })
})

describe('projectFromShareLink (what the page does with its own URL after a scan)', () => {
  it('reads the Project out of a location.hash', () => {
    const project = smallProject()
    const link = serializeProjectForQr(project, APP_URL)

    expect(projectFromShareLink(link.slice(link.indexOf('#')))).toEqual(project)
  })

  it('is undefined for an ordinary page load', () => {
    expect(projectFromShareLink('')).toBeUndefined()
    expect(projectFromShareLink('#something-else')).toBeUndefined()
  })
})

describe('decodeQrText / parseProjectFromQrImage (the import side -- ticket 68)', () => {
  it('decodes a generated QR code back to its exact text (a jsQR decode standing in for a phone camera scan)', () => {
    const project = smallProject()
    const text = serializeProjectForQr(project, APP_URL)
    const matrix = projectQrMatrix(project, APP_URL)!

    expect(decodeQrText(rasterizeQrMatrix(matrix))).toBe(text)
  })

  it('reproduces the exact Project end to end: create -> QR matrix -> rasterized picture -> decode -> parse', () => {
    let project = smallProject()
    project = withFrameGrid(project, denselyColoredGrid(project.frame!.columns, project.frame!.rows))
    const matrix = projectQrMatrix(project, APP_URL)!

    const imported = parseProjectFromQrImage(rasterizeQrMatrix(matrix))

    expect(imported).toEqual(project)
  })

  it('reports no QR code found in a plain white picture', () => {
    const blank: PixelData = { width: 100, height: 100, data: new Uint8ClampedArray(100 * 100 * 4).fill(255) }

    expect(decodeQrText(blank)).toBeUndefined()
    expect(() => parseProjectFromQrImage(blank)).toThrow(/no qr code/i)
  })
})
