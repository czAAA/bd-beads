import { describe, expect, it } from 'vitest'
import { buildPdf } from './pdfDocument'

async function text(blob: Blob): Promise<string> {
  return new TextDecoder('latin1').decode(await blob.arrayBuffer())
}

const page = { jpeg: Uint8Array.of(0xff, 0xd8, 1, 2, 3, 0xff, 0xd9), pixelWidth: 10, pixelHeight: 20 }

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
    expect(pdf).toContain('/Filter /DCTDecode /Length 7')
    // The picture is scaled to the sheet by a full six-number matrix: a reader refuses a shorter one.
    expect(pdf).toContain('q 595.20 0 0 841.68 0 0 cm /Im0 Do Q')
  })

  it('points its cross-reference table at where each object really starts', async () => {
    const pdf = await text(buildPdf([page], 100, 100))

    const table = pdf.slice(pdf.indexOf('xref\n')).split('\n').slice(3)
    const offsets = table.filter((line) => line.endsWith(' n ')).map((line) => Number(line.slice(0, 10)))
    expect(offsets).toHaveLength(5)
    offsets.forEach((offset, index) => {
      expect(pdf.slice(offset).startsWith(`${index + 1} 0 obj`)).toBe(true)
    })
    expect(pdf).toContain(`startxref\n${pdf.indexOf('xref\n')}`)
  })
})
