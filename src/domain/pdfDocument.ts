/**
 * A PDF made of whole-page pictures (ticket 74): every page is one JPEG laid over the paper. The page is drawn on a
 * canvas by the caller — text and all, so any language the app speaks prints the same, with no font to embed — and this
 * only wraps the pictures in the file format, which keeps the whole export free of a PDF library.
 */

export interface PdfPage {
  /** The page as a baseline JPEG. */
  jpeg: Uint8Array
  /** The picture's size in pixels. */
  pixelWidth: number
  pixelHeight: number
}

const encoder = new TextEncoder()

/** A PDF whose pages are the pictures, each laid over a sheet `widthPt` × `heightPt` points (1/72 in) big. */
export function buildPdf(pages: PdfPage[], widthPt: number, heightPt: number): Blob {
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

  // Objects: 1 catalog, 2 page tree, then a page, its content and its picture for each page.
  const pageObject = (index: number) => 3 + index * 3
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')
  object(1, ['<< /Type /Catalog /Pages 2 0 R >>'])
  object(2, [`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_p, i) => `${pageObject(i)} 0 R`).join(' ')}] >>`])

  pages.forEach((page, index) => {
    const number = pageObject(index)
    const size = `${widthPt.toFixed(2)} ${heightPt.toFixed(2)}`
    object(number, [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${size}] /Resources << /XObject << /Im0 ${number + 2} 0 R >> >> /Contents ${number + 1} 0 R >>`,
    ])
    const content = `q ${widthPt.toFixed(2)} 0 0 ${heightPt.toFixed(2)} 0 0 cm /Im0 Do Q`
    object(number + 1, [`<< /Length ${content.length} >>\nstream\n${content}\nendstream`])
    object(number + 2, [
      `<< /Type /XObject /Subtype /Image /Width ${page.pixelWidth} /Height ${page.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`,
      page.jpeg,
      '\nendstream',
    ])
  })

  const objectCount = 3 + pages.length * 3
  const crossReference = length
  push(`xref\n0 ${objectCount}\n0000000000 65535 f \n`)
  for (let number = 1; number < objectCount; number += 1) {
    push(`${String(offsets[number]).padStart(10, '0')} 00000 n \n`)
  }
  push(`trailer\n<< /Size ${objectCount} /Root 1 0 R >>\nstartxref\n${crossReference}\n%%EOF\n`)

  return new Blob(parts as BlobPart[], { type: 'application/pdf' })
}
