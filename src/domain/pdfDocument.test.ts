import { describe, expect, it } from 'vitest'
import { buildPdf } from './pdfDocument'

async function text(blob: Blob): Promise<string> {
  return new TextDecoder('latin1').decode(await blob.arrayBuffer())
}

const page = { flate: [Uint8Array.of(0x78, 0x9c, 1, 2), Uint8Array.of(3, 4, 5)], pixelWidth: 10, pixelHeight: 20 }

describe('buildPdf (ticket 74)', () => {
  it('makes a PDF with a page per picture, at the sheet size', async () => {
    const blob = buildPdf([page, page], 595.2, 841.68)
    const pdf = await text(blob)

    expect(blob.type).toBe('application/pdf')
    expect(pdf.startsWith('%PDF-1.4')).toBe(true)
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true)
    expect(pdf).toContain('/Count 2')
    expect(pdf).toContain('/MediaBox [0 0 595.20 841.68]')
    expect(pdf.match(/\/Type \/Page /g)).toHaveLength(2)
    expect(pdf).toContain('/Filter /FlateDecode')
    expect(pdf).toContain('/Columns 10 >> /Length 7')
    // The picture is scaled to the sheet by a full six-number matrix: a reader refuses a shorter one.
    expect(pdf).toContain('q 595.20 0 0 841.68 0 0 cm /Im0 Do Q')
  })

  it('asks viewers to print at 100 % and carries the Project\'s name as its title (ticket 0584)', async () => {
    const pdf = await text(buildPdf([page], 100, 100, 'Aé'))

    expect(pdf).toContain('/ViewerPreferences << /PrintScaling /None >>')
    expect(pdf).toContain('/Title <feff004100e9>')
    expect(pdf).toMatch(/\/Info 8 0 R/)
    expect(pdf).toContain('/Size 9')
  })

  it('lays a chart page\'s drawing over its picture, with the two built-in Helvetica faces to set its letters in (ticket 0585)', async () => {
    const drawing = Uint8Array.of(0x78, 0x9c, 9, 9)
    const pdf = await text(buildPdf([{ ...page, drawing }, page], 100, 100))

    expect(pdf).toContain('/BaseFont /Helvetica /Encoding /WinAnsiEncoding')
    expect(pdf).toContain('/BaseFont /Helvetica-Bold')
    expect(pdf).toContain('/Font << /F1 3 0 R /F2 4 0 R >>')
    // The first page has four objects (page, content, picture, drawing), so the second starts at 9.
    expect(pdf).toContain('/Contents [6 0 R 8 0 R]')
    expect(pdf).toContain('/Kids [5 0 R 9 0 R]')
    expect(pdf).toContain('8 0 obj\n<< /Filter /FlateDecode /Length 4 >>')
    expect(pdf.match(/\/Subtype \/Image/g)).toHaveLength(2)
  })

  it('points its cross-reference table at where each object really starts', async () => {
    const pdf = await text(buildPdf([page], 100, 100))

    const table = pdf.slice(pdf.indexOf('xref\n')).split('\n').slice(3)
    const offsets = table.filter((line) => line.endsWith(' n ')).map((line) => Number(line.slice(0, 10)))
    expect(offsets).toHaveLength(7)
    offsets.forEach((offset, index) => {
      expect(pdf.slice(offset).startsWith(`${index + 1} 0 obj`)).toBe(true)
    })
    expect(pdf).toContain(`startxref\n${pdf.indexOf('xref\n')}`)
  })
})
