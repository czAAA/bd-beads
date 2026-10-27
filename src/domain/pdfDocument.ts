/** A PDF of whole-page pictures (tickets 74, 572), a page optionally with drawing over its picture (ticket 0585, ADR 0043).
 * The caller draws each picture on a canvas and a chart page's lines and letters as operators (`PdfContent`); this only
 * wraps them in the file format, keeping the export free of a PDF library. */

export interface PdfPage {
  /** The page as zlib-compressed RGB scanlines, each led by a PNG filter byte (`deflateRgb`); lossless (ticket 572). */
  flate: Uint8Array[]
  /** The picture's size in pixels. */
  pixelWidth: number
  pixelHeight: number
  /** The page's drawing operators (`PdfContent`), zlib-compressed, laid over the picture: its letters are text in the
   * built-in Helvetica faces. */
  drawing?: Uint8Array
}

const encoder = new TextEncoder()

/** A PDF text string: UTF-16BE with a byte-order mark in hex, so any name survives. */
function pdfText(value: string): string {
  const units = ['feff', ...Array.from({ length: value.length }, (_, index) => value.charCodeAt(index).toString(16).padStart(4, '0'))]
  return `<${units.join('')}>`
}

/** A PDF whose pages are the pictures, each laid over a sheet `widthPt` × `heightPt` points (1/72 in) big. It asks
 * viewers to print at 100 % (ticket 0584: a 3 mm bead stays 3 mm) and carries `title` for a tab's name. */
export function buildPdf(pages: PdfPage[], widthPt: number, heightPt: number, title = ''): Blob {
  const parts: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0
  const push = (bytes: Uint8Array | string) => {
    const chunk = typeof bytes === 'string' ? encoder.encode(bytes) : bytes
    parts.push(chunk)
    length += chunk.length
  }
  const object = (number: number, body: (Uint8Array | string)[]) => {
    offsets[number] = length
    push(`${number} 0 obj\n`)
    body.forEach(push)
    push('\nendobj\n')
  }

  // Objects: 1 catalog, 2 page tree, 3 and 4 the two Helvetica faces, then a page, its content, its picture and, for a
  // chart page, its drawing.
  let next = 5
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')
  object(1, ['<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /PrintScaling /None >> >>'])
  const numbers = pages.map((page) => {
    const at = next
    next += page.drawing ? 4 : 3
    return at
  })
  object(2, [`<< /Type /Pages /Count ${pages.length} /Kids [${numbers.map((at) => `${at} 0 R`).join(' ')}] >>`])
  object(3, ['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'])
  object(4, ['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'])

  pages.forEach((page, index) => {
    const number = numbers[index]!
    const size = `${widthPt.toFixed(2)} ${heightPt.toFixed(2)}`
    const contents = page.drawing ? `[${number + 1} 0 R ${number + 3} 0 R]` : `${number + 1} 0 R`
    object(number, [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${size}] /Resources << /XObject << /Im0 ${number + 2} 0 R >> /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contents} >>`,
    ])
    const content = `q ${widthPt.toFixed(2)} 0 0 ${heightPt.toFixed(2)} 0 0 cm /Im0 Do Q`
    object(number + 1, [`<< /Length ${content.length} >>\nstream\n${content}\nendstream`])
    const length = page.flate.reduce((sum, part) => sum + part.length, 0)
    // Predictor 15: every scanline leads with its PNG filter byte, as deflateRgb writes them.
    const parms = `<< /Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns ${page.pixelWidth} >>`
    object(number + 2, [
      `<< /Type /XObject /Subtype /Image /Width ${page.pixelWidth} /Height ${page.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /DecodeParms ${parms} /Length ${length} >>\nstream\n`,
      ...page.flate,
      '\nendstream',
    ])
    if (page.drawing) {
      object(number + 3, [`<< /Filter /FlateDecode /Length ${page.drawing.length} >>\nstream\n`, page.drawing, '\nendstream'])
    }
  })

  const info = next
  if (title) object(info, [`<< /Title ${pdfText(title)} >>`])
  const objectCount = title ? info + 1 : info
  const crossReference = length
  push(`xref\n0 ${objectCount}\n0000000000 65535 f \n`)
  for (let number = 1; number < objectCount; number += 1) {
    push(`${String(offsets[number]).padStart(10, '0')} 00000 n \n`)
  }
  push(`trailer\n<< /Size ${objectCount} /Root 1 0 R${title ? ` /Info ${info} 0 R` : ''} >>\nstartxref\n${crossReference}\n%%EOF\n`)

  return new Blob(parts as BlobPart[], { type: 'application/pdf' })
}
