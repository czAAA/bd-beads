import { describe, expect, it } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { channelsOf } from '../../domain/color'
import type { PixelData } from '../../domain/imageConversion'
import { beadPhoto, drawPicture, type Rgb } from '../../testUtils/beadPhoto'
import { frameGrid } from '../../testUtils/frameGrid'
import { fakeCutOutDevice } from '../../testUtils/fakeCutOutDevice'
import { unusedCutOutService } from '../../testUtils/fakeCutOutService'
import { useConvertImageWizard, type ConvertImageWizard } from './useConvertImageWizard'

// A photo of beadwork through the wizard's state (ticket 0772): its bead grid is the Suggested Width, Use suggested
// snaps A part to the grid, and each bead then reads as its ring, not its hole.

const BLUE: Rgb = [30, 60, 200]
const CREAM: Rgb = [230, 230, 220]
const COLUMNS = 24

/** A photo of a cream piece with a blue 4 × 4 block of beads near its middle. */
const photo = beadPhoto(COLUMNS, 20, 18, 15, (column, row) => (column >= 10 && column < 14 && row >= 8 && row < 12 ? BLUE : CREAM))

async function convert(image: PixelData): Promise<ConvertImageWizard> {
  const wizard = effectScope().run(() =>
    useConvertImageWizard({
      start: { technique: 'loom', beadId: 'toho/cube/1.5mm', name: '', makerName: '' },
      decodeImage: async () => image,
      loadCatalog: () => Promise.reject(new Error('no catalog')),
      cutOutService: unusedCutOutService,
      cutOutDevice: fakeCutOutDevice().device,
    }),
  )!
  await wizard.setFile(new File(['x'], 'beads.jpg', { type: 'image/jpeg' }))
  await nextTick()
  return wizard
}

/** Whether a bead's hex is near a color: a photo's noise moves each channel a little. */
function near(hex: string | null | undefined, [r, g, b]: Rgb): boolean {
  if (!hex) return false
  const own = channelsOf(hex)
  return Math.abs(own.r - r) < 25 && Math.abs(own.g - g) < 25 && Math.abs(own.b - b) < 25
}
const beadOrBlue = (wizard: ConvertImageWizard) => frameGrid(wizard.createProject()!).flat().map((cell) => cell.color).every((hex) => near(hex, CREAM) || near(hex, BLUE))

describe('a photo of beadwork (ticket 0772)', () => {
  it('finds the bead grid and suggests its beads across as the Width', async () => {
    const wizard = await convert(photo)

    expect(wizard.beadGrid.value?.columns).toBeGreaterThanOrEqual(COLUMNS - 1)
    expect(wizard.suggestedWidth.value).toBe(wizard.beadGrid.value!.columns)
  })

  it('snaps A part to the grid on Use suggested, one bead a cell, each read from its ring', async () => {
    const wizard = await convert(photo)
    // Off the grid (the whole picture at its widest), cells straddle holes and the field: not every bead is a bead's color.
    expect(beadOrBlue(wizard)).toBe(false)

    wizard.useSuggestedWidth()
    await nextTick()

    const found = wizard.beadGrid.value!
    expect(wizard.weave.value).toBe('part')
    expect(wizard.dimensions.value).toEqual({ columns: found.columns, rows: found.rows })
    // Every bead is cream or blue: none the hole's dark brown, none the field between beads.
    expect(beadOrBlue(wizard)).toBe(true)
    // The blue block is there, 4 beads wide, where the picture has it.
    expect(frameGrid(wizard.createProject()!).find((row) => row.filter((cell) => near(cell.color, BLUE)).length === 4)).toBeDefined()
  })

  it('finds no grid in flat artwork, which keeps the Suggested Width of ticket 0770', async () => {
    const flat = drawPicture(240, 160, (x, y) => (x >= 200 && x < 208 && y >= 40 && y < 48 ? BLUE : x >= 40 && x < 136 && y >= 40 && y < 120 ? [220, 40, 50] : [250, 250, 250]), 0)
    const wizard = await convert(flat)

    expect(wizard.beadGrid.value).toBeUndefined()
    expect(wizard.suggestedWidth.value).toBe(30)
  })
})
