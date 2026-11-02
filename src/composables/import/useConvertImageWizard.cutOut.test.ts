import { describe, expect, it } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { PixelData } from '../../domain/imageConversion'
import { useConvertImageWizard, type ConvertImageWizard } from './useConvertImageWizard'

// Cut out's Simple and Fit to subject (ticket 0765, spec 0761), through the wizard's state: what the maker would see in
// the preview's beads, the found colors and the part. Synthetic pictures only.

type Rgb = [number, number, number]

/** A picture drawn by a function of each pixel's place. */
function draw(width: number, height: number, at: (x: number, y: number) => Rgb): PixelData {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) data.set([...at(x, y), 255], (y * width + x) * 4)
  }
  return { width, height, data }
}

const RED: Rgb = [220, 40, 50]
const GREY: Rgb = [200, 200, 200]
const NAVY: Rgb = [20, 25, 70]
const inBox = (x: number, y: number, left: number, top: number, width: number, height: number) =>
  x >= left && x < left + width && y >= top && y < top + height

/** A red 8 × 8 square at (12, 12) on a plain grey 32 × 32 field. */
const plainField = () => draw(32, 32, (x, y) => (inBox(x, y, 12, 12, 8, 8) ? RED : GREY))

/** A navy 8 × 8 square at (12, 12) on a field that lightens from mid grey at the edges to light grey at the middle. */
const shadedField = () =>
  draw(32, 32, (x, y) => {
    if (inBox(x, y, 12, 12, 8, 8)) return NAVY
    const shade = 150 + 5 * Math.min(x, y, 31 - x, 31 - y)
    return [shade, shade, shade]
  })

/** The wizard with the first picture set at one bead per pixel; each later file decodes to the next picture given. */
async function convert(...pictures: PixelData[]): Promise<ConvertImageWizard> {
  let read = 0
  const wizard = effectScope().run(() =>
    useConvertImageWizard({
      start: { technique: 'loom', beadId: 'toho/cube/1.5mm', name: '', makerName: '' },
      decodeImage: async () => pictures[Math.min(read++, pictures.length - 1)]!,
      loadCatalog: () => Promise.reject(new Error('no catalog')),
    }),
  )!
  await wizard.setFile(new File(['x'], 'picture.png', { type: 'image/png' }))
  wizard.setWidth(pictures[0]!.width)
  await nextTick()
  return wizard
}

/** The beads at rest, row by row: each its color, or undefined for no bead. */
function beads(wizard: ConvertImageWizard): (string | undefined)[][] {
  const { columns, rows } = wizard.lattice.value!
  return Array.from({ length: rows }, (_row, row) => wizard.beadColors.value.slice(row * columns, (row + 1) * columns))
}

/** Where the beads are, as `#` for a bead and `.` for none: the shape a cut out leaves. */
const shape = (wizard: ConvertImageWizard) => beads(wizard).map((row) => row.map((hex) => (hex ? '#' : '.')).join(''))
const beadCount = (wizard: ConvertImageWizard) => beads(wizard).flat().filter(Boolean).length
const foundHexes = (wizard: ConvertImageWizard) => wizard.found.value.map((color) => color.pictureHex)

describe('Cut out: Simple (ticket 0765)', () => {
  it('makes the plain field round the subject empty, and Off brings it back', async () => {
    const wizard = await convert(plainField())
    expect(wizard.cutOut.value).toBe('off')
    expect(beadCount(wizard)).toBe(32 * 32)

    wizard.setCutOut('simple')
    const rows = shape(wizard)
    expect(rows.filter((row) => row.includes('#'))).toHaveLength(8)
    expect(rows[12]).toBe(`${'.'.repeat(12)}${'#'.repeat(8)}${'.'.repeat(12)}`)
    expect(beads(wizard)[15]![15]).toBe('#dc2832')

    wizard.setCutOut('off')
    expect(beadCount(wizard)).toBe(32 * 32)
  })

  it('chooses the colors from the subject alone: the background color is never found', async () => {
    const wizard = await convert(plainField())
    expect(foundHexes(wizard)).toEqual(['#c8c8c8', '#dc2832'])

    wizard.setCutOut('simple')
    expect(foundHexes(wizard)).toEqual(['#dc2832'])
    expect(wizard.found.value[0]!.count).toBe(64)
    expect(wizard.colorsMax.value).toBe(1)
  })

  it('takes more of a shaded field as Tolerance rises, and never the subject', async () => {
    const wizard = await convert(shadedField())
    wizard.setCutOut('simple')

    wizard.setTolerance(3)
    const little = beadCount(wizard)
    expect(little).toBeGreaterThan(64)
    expect(little).toBeLessThan(32 * 32)
    expect(shape(wizard)[0]).toBe('.'.repeat(32))
    expect(shape(wizard)[12]).toContain('########')

    wizard.setTolerance(20)
    expect(beadCount(wizard)).toBe(64)
    expect(foundHexes(wizard)).toEqual(['#141946'])
  })
})

describe('Fit to subject (ticket 0765)', () => {
  it('sets A part to the box round what Cut out kept, keeping the Width the part allows', async () => {
    const wizard = await convert(plainField())
    wizard.setCutOut('simple')
    expect(wizard.subjectBounds.value).toEqual({ x: 12, y: 12, width: 8, height: 8 })

    wizard.setWidth(8)
    wizard.fitToSubject()
    expect(wizard.weave.value).toBe('part')
    expect(wizard.part.value).toEqual({ x: 12, y: 12, width: 8, height: 8 })
    expect(wizard.dimensions.value).toEqual({ columns: 8, rows: 8 })

    expect(beadCount(wizard)).toBe(64)
  })

  it('drops the Width only to the part’s pixels', async () => {
    const wizard = await convert(draw(160, 80, (x, y) => (inBox(x, y, 20, 20, 80, 40) ? RED : GREY)))
    wizard.setCutOut('simple')
    wizard.fitToSubject()
    expect(wizard.part.value).toEqual({ x: 20, y: 20, width: 80, height: 40 })
    expect(wizard.dimensions.value).toEqual({ columns: 80, rows: 40 })

    wizard.setWeave('whole')
    wizard.setWidth(20)
    wizard.fitToSubject()
    expect(wizard.dimensions.value).toEqual({ columns: 20, rows: 10 })
  })

  it('has no box, and does nothing, with Cut out Off', async () => {
    const wizard = await convert(plainField())
    expect(wizard.subjectBounds.value).toBeUndefined()
    wizard.fitToSubject()
    expect(wizard.weave.value).toBe('whole')
  })
})

describe('Cut out after a turn, a flip or a new picture (ticket 0765)', () => {
  /** A red 4 × 6 bar near the top-left corner of a grey 24 × 16 field. */
  const offCentre = () => draw(24, 16, (x, y) => (inBox(x, y, 2, 3, 4, 6) ? RED : GREY))

  it('works the mask out again on the turned picture', async () => {
    const wizard = await convert(offCentre())
    wizard.setCutOut('simple')
    wizard.fitToSubject()

    wizard.turn()
    wizard.setWidth(16)
    expect(wizard.cutOut.value).toBe('simple')
    expect(wizard.weave.value).toBe('whole')
    expect(wizard.subjectMask.value).toMatchObject({ width: 16, height: 24 })
    expect(wizard.subjectBounds.value).toEqual({ x: 7, y: 2, width: 6, height: 4 })
    expect(beadCount(wizard)).toBe(24)
  })

  it('works the mask out again on the flipped picture', async () => {
    const wizard = await convert(offCentre())
    wizard.setCutOut('simple')
    wizard.flip()
    expect(wizard.subjectBounds.value).toEqual({ x: 18, y: 3, width: 4, height: 6 })
    expect(beads(wizard)[3]![19]).toBe('#dc2832')
    expect(beads(wizard)[3]![3]).toBeUndefined()
  })

  it('works the mask out again for a new picture', async () => {
    const wizard = await convert(offCentre(), plainField())
    wizard.setCutOut('simple')
    await wizard.setFile(new File(['x'], 'other.png', { type: 'image/png' }))
    expect(wizard.subjectBounds.value).toEqual({ x: 12, y: 12, width: 8, height: 8 })
    expect(foundHexes(wizard)).toEqual(['#dc2832'])
  })
})
