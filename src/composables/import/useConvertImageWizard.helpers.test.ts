import { describe, expect, it } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { PixelData } from '../../domain/imageConversion'
import { addedColorId } from '../../domain/palette'
import type { Technique } from '../../domain/weave'
import { frameGrid } from '../../testUtils/frameGrid'
import { useConvertImageWizard, type ConvertImageWizard } from './useConvertImageWizard'

// The Colors step's helpers (ticket 0766, spec 0761) through the wizard's state: Auto-fix lighting, Clean up stray
// beads and the Outline, as the maker would see them in the found colors, the beads and the Schema. Synthetic pictures.

type Rgb = [number, number, number]

/** A picture drawn by a function of each pixel's place; `null` is a transparent pixel. */
function draw(width: number, height: number, at: (x: number, y: number) => Rgb | null): PixelData {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = at(x, y)
      data.set(color ? [...color, 255] : [0, 0, 0, 0], (y * width + x) * 4)
    }
  }
  return { width, height, data }
}

const RED: Rgb = [220, 40, 50]
const GREY: Rgb = [200, 200, 200]
const inBox = (x: number, y: number, left: number, top: number, width: number, height: number) =>
  x >= left && x < left + width && y >= top && y < top + height

/** The wizard with the first picture set at one bead per pixel. */
async function convert(picture: PixelData, technique: Technique = 'loom'): Promise<ConvertImageWizard> {
  const wizard = effectScope().run(() =>
    useConvertImageWizard({
      start: { technique, beadId: 'toho/cube/1.5mm', name: '', makerName: '' },
      decodeImage: async () => picture,
      loadCatalog: () => Promise.reject(new Error('no catalog')),
    }),
  )!
  await wizard.setFile(new File(['x'], 'picture.png', { type: 'image/png' }))
  wizard.setWidth(picture.width)
  await nextTick()
  return wizard
}

const foundHexes = (wizard: ConvertImageWizard) => wizard.found.value.map((color) => color.pictureHex)
const countOf = (wizard: ConvertImageWizard, hex: string) => wizard.found.value.find((color) => color.pictureHex === hex)?.count ?? 0
/** The Schema Create Project would make, as `#` for a bead of `hex`, `o` for any other bead and `.` for none. */
function schema(wizard: ConvertImageWizard, hex: string): string[] {
  return frameGrid(wizard.createProject()!).map((row) => row.map((cell) => (cell.color === hex ? '#' : cell.color ? 'o' : '.')).join(''))
}

describe('Auto-fix lighting (ticket 0766)', () => {
  /** Three patches under a warm, dim light: a grey, a muted red and a muted blue, all leaning yellow. */
  const warmPhoto = () => draw(12, 4, (x) => (x < 4 ? [190, 170, 120] : x < 8 ? [170, 90, 60] : [90, 100, 110]))

  it('is off at first, so pixel art keeps its exact colors', async () => {
    const wizard = await convert(warmPhoto())
    expect(wizard.autoFixLighting.value).toBe(false)
    expect(foundHexes(wizard).sort()).toEqual(['#5a646e', '#aa5a3c', '#beaa78'])
  })

  it('moves a cast picture’s colors while on: the grey comes nearer neutral, and off puts them back', async () => {
    const wizard = await convert(warmPhoto())
    wizard.setAutoFixLighting(true)
    const found = foundHexes(wizard)
    expect(found).toHaveLength(3)
    expect(found).not.toContain('#beaa78')
    // The patch that was the grey is the first by place: the bead at the left.
    const grey = wizard.beadColors.value[0]!
    const spread = (hex: string) => {
      const [r, , b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)) as [number, number, number]
      return Math.abs(r - b)
    }
    expect(spread(grey)).toBeLessThan(spread('#beaa78') / 2)

    wizard.setAutoFixLighting(false)
    expect(foundHexes(wizard).sort()).toEqual(['#5a646e', '#aa5a3c', '#beaa78'])
  })

  it('reads the cast from the subject alone while Cut out is on', async () => {
    // A yellowed grey subject on a strong blue field: from the whole picture the blue would set the balance.
    const picture = draw(16, 16, (x, y) => (inBox(x, y, 4, 4, 8, 8) ? [200, 180, 130] : [30, 60, 220]))
    const wizard = await convert(picture)
    wizard.setCutOut('simple')
    wizard.setAutoFixLighting(true)
    const [subject] = foundHexes(wizard)
    const [r, g, b] = [1, 3, 5].map((at) => parseInt(subject!.slice(at, at + 2), 16)) as [number, number, number]
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(15)
  })
})

describe('Clean up stray beads (ticket 0766)', () => {
  /** A grey 10 × 8 field with one red bead on its own at (2, 2) and a red line of two at (6, 5) and (6, 6). */
  const speckled = () => draw(10, 8, (x, y) => ((x === 2 && y === 2) || (x === 6 && (y === 5 || y === 6)) ? RED : GREY))

  it.each<Technique>(['loom', 'peyote', 'brick'])('merges a bead on its own and keeps a two-bead line, through %s’s neighbours', async (technique) => {
    const wizard = await convert(speckled(), technique)
    expect(wizard.cleanUp.value).toBe(0)
    expect(countOf(wizard, '#dc2832')).toBe(3)

    wizard.setCleanUp(1)
    expect(countOf(wizard, '#dc2832')).toBe(2)
    expect(countOf(wizard, '#c8c8c8')).toBe(10 * 8 - 2)
  })

  it('takes a lone color out of the found colors altogether', async () => {
    const wizard = await convert(draw(8, 8, (x, y) => (x === 3 && y === 3 ? RED : GREY)))
    expect(foundHexes(wizard)).toEqual(['#c8c8c8', '#dc2832'])
    wizard.setCleanUp(1)
    expect(foundHexes(wizard)).toEqual(['#c8c8c8'])
    expect(schema(wizard, '#c8c8c8').join('')).toBe('#'.repeat(64))
  })

  it('lets Treat as empty’s tap empty the color a merged bead shows', async () => {
    const wizard = await convert(draw(8, 8, (x, y) => (x === 3 && y === 3 ? RED : GREY)))
    wizard.setCleanUp(1)
    wizard.emptyAtBead(3 * wizard.lattice.value!.columns + 3)
    expect(wizard.choices.value.get('#c8c8c8')).toEqual({ kind: 'empty' })
  })

  it('allows one more pass at each step', async () => {
    // A red cross of five on grey: its arms each touch only the middle, so the first pass keeps them all.
    const cross = draw(9, 9, (x, y) => ((x === 4 && y >= 3 && y <= 5) || (y === 4 && x >= 3 && x <= 5) ? RED : GREY))
    const wizard = await convert(cross)
    wizard.setCleanUp(1)
    expect(countOf(wizard, '#dc2832')).toBe(5)
    // A bead of a third color between two lone ones: one pass merges the lone ones, the next the one left alone.
    const chain = draw(9, 9, (x, y) => (y === 4 && x === 3 ? RED : y === 4 && x === 4 ? [20, 20, 160] : y === 4 && x === 5 ? RED : GREY))
    const stepped = await convert(chain)
    stepped.setCleanUp(2)
    expect(foundHexes(stepped)).toEqual(['#c8c8c8'])
  })

  it('leaves empty beads empty', async () => {
    const wizard = await convert(draw(8, 8, (x, y) => (x === 3 && y === 3 ? RED : inBox(x, y, 0, 0, 8, 3) ? null : GREY)))
    wizard.setCleanUp(3)
    expect(schema(wizard, '#c8c8c8').slice(0, 3)).toEqual(['........', '........', '........'])
  })
})

describe('Outline (ticket 0766)', () => {
  /** A red 4 × 4 square at (4, 4) on a plain grey 12 × 12 field. */
  const square = () => draw(12, 12, (x, y) => (inBox(x, y, 4, 4, 4, 4) ? RED : GREY))

  it('is shown only with empty beads round the subject', async () => {
    const wizard = await convert(square())
    expect(wizard.outlineShown.value).toBe(false)
    wizard.setCutOut('simple')
    expect(wizard.outlineShown.value).toBe(true)

    const transparent = await convert(draw(8, 8, (x, y) => (inBox(x, y, 2, 2, 2, 2) ? RED : null)))
    expect(transparent.outlineShown.value).toBe(true)
  })

  it('rings the subject one bead thick in the darkest found color, and grows the Schema by one bead each way', async () => {
    const wizard = await convert(draw(12, 12, (x, y) => (inBox(x, y, 4, 4, 4, 4) ? (x < 6 ? RED : [40, 20, 30]) : GREY)))
    wizard.setCutOut('simple')
    expect(wizard.outline.value).toBe(false)
    wizard.setOutline(true)
    expect(wizard.outlineColor.value?.hex).toBe('#28141e')

    const rows = schema(wizard, '#28141e')
    expect(rows).toHaveLength(14)
    expect(rows[0]).toHaveLength(14)
    expect(rows.slice(0, 4)).toEqual(['.'.repeat(14), '.'.repeat(14), '.'.repeat(14), '.'.repeat(14)])
    expect(rows[4]).toBe('.....####.....')
    expect(rows[5]).toBe('....#oo###....')
    expect(rows[9]).toBe('.....####.....')
    expect(rows.join('').split('#').length - 1).toBe(16 + 8)
  })

  it('takes the color chosen through the colour popover, which joins the Palette', async () => {
    const wizard = await convert(square())
    wizard.setCutOut('simple')
    wizard.setOutline(true)
    wizard.setOutlineColor({ hex: '#101010' })
    const rows = schema(wizard, '#101010')
    expect(rows.join('').split('#').length - 1).toBe(16)
    expect(rows[5]).toBe('....#oooo#....')
    expect(wizard.createProject()!.palette).toContain(addedColorId('#101010'))

    wizard.setOutlineColor(undefined)
    expect(wizard.outlineColor.value?.hex).toBe('#dc2832')
  })

  it('reaches past the picture’s edge where the subject touches it', async () => {
    const wizard = await convert(draw(8, 8, (x, y) => (inBox(x, y, 0, 0, 2, 8) ? RED : null)))
    wizard.setOutline(true)
    wizard.setOutlineColor({ hex: '#101010' })
    expect(schema(wizard, '#101010')).toEqual(['.##.......', ...Array<string>(8).fill('#oo#......'), '.##.......'])
  })

  it('grows a staggered Technique by a whole cycle at the top or left, so every bead keeps its offset', async () => {
    const brick = await convert(square(), 'brick')
    brick.setCutOut('simple')
    brick.setOutline(true)
    expect(brick.outlinePad.value).toEqual({ top: 2, left: 1, bottom: 1, right: 1 })
    expect(brick.schemaSize.value).toEqual({ columns: 14, rows: 15 })

    const peyote = await convert(square(), 'peyote')
    peyote.setCutOut('simple')
    peyote.setOutline(true)
    expect(peyote.schemaSize.value).toEqual({ columns: 15, rows: 14 })
  })

  it('shows the ring on the preview, past the picture, and a tap on it empties nothing', async () => {
    const wizard = await convert(draw(8, 8, (x, y) => (inBox(x, y, 0, 0, 2, 8) ? RED : null)))
    wizard.setOutline(true)
    wizard.setOutlineColor({ hex: '#101010' })
    const lattice = wizard.lattice.value!
    expect(lattice).toMatchObject({ frameRow: 2, frameColumn: 1 })
    expect(lattice.rows).toBe(2 + 8 + 1)
    expect(lattice.columns).toBe(1 + 8 + 1)
    const at = (row: number, column: number) => wizard.beadColors.value[row * lattice.columns + column]
    expect(at(1, 1)).toBe('#101010')
    expect(at(2, 0)).toBe('#101010')
    expect(at(2, 1)).toBe('#dc2832')
    expect(at(0, 1)).toBeUndefined()

    wizard.emptyAtBead(2 * lattice.columns)
    expect(wizard.emptyColorCount.value).toBe(0)
    wizard.emptyAtBead(2 * lattice.columns + 1)
    expect(wizard.emptyColorCount.value).toBe(1)
  })

  it('leaves the Schema as it was while off, and switched on with no empty beads round the subject', async () => {
    const wizard = await convert(square())
    wizard.setOutline(true)
    expect(wizard.schemaSize.value).toEqual({ columns: 12, rows: 12 })
    wizard.setCutOut('simple')
    wizard.setOutline(false)
    expect(wizard.schemaSize.value).toEqual({ columns: 12, rows: 12 })
    expect(frameGrid(wizard.createProject()!)).toHaveLength(12)
  })
})
