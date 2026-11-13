import { describe, expect, it } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { BACKGROUND_TOLERANCE } from '../../domain/convertBackground'
import type { PixelData } from '../../domain/imageConversion'
import { photoPictureSized, pixelArtPicture } from '../../testUtils/samplerPictures'
import { useConvertImageWizard } from './useConvertImageWizard'

/** A flat picture of this size, enough for the size arithmetic. */
function flat(width: number, height: number): PixelData {
  return { width, height, data: new Uint8ClampedArray(width * height * 4).fill(200) }
}

/** A picture of three colors in bands: red on the left third, blue in the middle, yellow on the right. */
function bands(width: number, height: number): PixelData {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const band = Math.floor((x * 3) / width)
      data.set(band === 0 ? [230, 55, 70, 255] : band === 1 ? [47, 111, 219, 255] : [250, 220, 60, 255], (y * width + x) * 4)
    }
  }
  return { width, height, data }
}

async function setup(picture: PixelData, beadId = 'toho/cube/1.5mm') {
  const scope = effectScope()
  const wizard = scope.run(() =>
    useConvertImageWizard({
      start: { technique: 'loom', beadId, name: '', makerName: '' },
      decodeImage: async () => picture,
      loadCatalog: () => Promise.reject(new Error('no catalog')),
    }),
  )!
  await wizard.setFile(new File(['x'], 'art.png', { type: 'image/png' }))
  await nextTick()
  return wizard
}

describe('useConvertImageWizard sizing (ticket 0747)', () => {
  it('starts on the whole picture at a small piece, the mark nearest 60 beads wide, linked (ticket 0863)', async () => {
    const wizard = await setup(flat(240, 160))
    expect(wizard.weave.value).toBe('whole')
    expect(wizard.linked.value).toBe(true)
    expect(wizard.sizing.value.width).toBe(60)
    expect(wizard.sizing.value.mark).toEqual({ width: 60, pixelsPerBead: 4 })
    expect(wizard.dimensions.value).toEqual({ columns: 60, rows: 40 })
  })

  it('follows the picture’s physical shape through the Bead between marks', async () => {
    const cube = await setup(flat(200, 100))
    cube.setWidth(40)
    expect(cube.dimensions.value).toEqual({ columns: 40, rows: 20 })

    const delica = await setup(flat(200, 100), 'miyuki/delica/11-0')
    delica.setWidth(40)
    expect(delica.dimensions.value).toEqual({ columns: 40, rows: 16 })
  })

  it('reads the Width in mm through the Bead', async () => {
    const wizard = await setup(flat(200, 100))
    wizard.setWidth(40)
    expect(wizard.widthMmOf(40)).toBe(60)
  })

  it('lets either slider lead while linked, and the other follow the picture', async () => {
    const wizard = await setup(flat(200, 100))
    wizard.setWidth(40)
    expect(wizard.dimensions.value).toEqual({ columns: 40, rows: 20 })
    wizard.setHeight(30)
    expect(wizard.dimensions.value).toEqual({ columns: 60, rows: 30 })
  })

  it('keeps the sizes on show when unlinked, sets them apart, and takes the shape back when linked again', async () => {
    const wizard = await setup(flat(200, 100))
    wizard.setWidth(40)
    wizard.setLinked(false)
    expect(wizard.dimensions.value).toEqual({ columns: 40, rows: 20 })
    wizard.setHeight(50)
    expect(wizard.dimensions.value).toEqual({ columns: 40, rows: 50 })
    wizard.setWidth(80)
    expect(wizard.dimensions.value).toEqual({ columns: 80, rows: 50 })
    wizard.setLinked(true)
    expect(wizard.dimensions.value).toEqual({ columns: 80, rows: 40 })
  })

  it('keeps the sizes when the part changes, dropping only to the part\'s pixels', async () => {
    const wizard = await setup(flat(200, 100))
    wizard.setWidth(120)
    wizard.setLinked(false)
    wizard.setHeight(60)
    wizard.setWeave('part')
    wizard.setPart({ x: 10, y: 10, width: 150, height: 80 })
    expect(wizard.dimensions.value).toEqual({ columns: 120, rows: 60 })
    wizard.setPart({ x: 40, y: 20, width: 100, height: 10 })
    expect(wizard.dimensions.value).toEqual({ columns: 100, rows: 40 })
    // Back to a bigger part: what was set comes back, nothing was lost by passing through a small one.
    wizard.setPart({ x: 10, y: 10, width: 150, height: 80 })
    expect(wizard.dimensions.value).toEqual({ columns: 120, rows: 60 })
  })

  it('weaves A part from 10% in, the range, grid and colors following it', async () => {
    const wizard = await setup(bands(60, 30))
    expect(wizard.colorsMax.value).toBe(3)

    wizard.setWeave('part')
    expect(wizard.part.value).toEqual({ x: 6, y: 3, width: 48, height: 24 })
    expect(wizard.sizing.value.range).toEqual({ min: 8, max: 192 })

    // The left third of the part is 12 px of red out of 48: still three colors; a part inside the blue band has one.
    wizard.setPart({ x: 22, y: 3, width: 16, height: 24 })
    await nextTick()
    expect(wizard.colorsMax.value).toBe(1)
    expect(wizard.sizing.value.range.max).toBe(64)
  })

  it('goes back to the whole picture on a turn and a flip', async () => {
    const wizard = await setup(flat(60, 30))
    wizard.setWeave('part')
    wizard.turn()
    expect(wizard.weave.value).toBe('whole')
    expect([wizard.image.value!.width, wizard.image.value!.height]).toEqual([30, 60])

    wizard.setWeave('part')
    wizard.flip()
    expect(wizard.weave.value).toBe('whole')
  })
})

describe('useConvertImageWizard colors (ticket 0747)', () => {
  it('starts the Colors slider at 12, or at every color the picture has where that is fewer', async () => {
    const wizard = await setup(bands(60, 30))
    expect(wizard.maxColors.value).toBe(3)
    expect(wizard.found.value).toHaveLength(3)
  })

  it('counts the bead colors after the match, and Make empty takes a bead color whole (ticket 0863)', async () => {
    // Two blues the Default Palette both matches to its Blue, and a red.
    const data = new Uint8ClampedArray(30 * 4)
    for (let x = 0; x < 30; x += 1) data.set(x < 10 ? [47, 111, 219, 255] : x < 20 ? [40, 100, 230, 255] : [230, 55, 70, 255], x * 4)
    const wizard = await setup({ width: 30, height: 1, data })
    wizard.setSource('default')
    expect(wizard.found.value).toHaveLength(3)
    expect(wizard.rows.value).toHaveLength(2)
    expect(wizard.usedColorCount.value).toBe(2)

    wizard.toggleEmptyAtBead(0)
    expect(wizard.usedColorCount.value).toBe(1)
    expect(wizard.emptyColorCount.value).toBe(1)
    wizard.toggleEmptyAtBead(0)
    expect(wizard.emptyColorCount.value).toBe(0)
  })

  it('reduces to the count the slider asks, inside the picture’s colors', async () => {
    const wizard = await setup(bands(60, 30))
    wizard.setMaxColors(1)
    expect(wizard.found.value).toHaveLength(1)
    wizard.setMaxColors(99)
    expect(wizard.maxColors.value).toBe(3)
  })

  it('offers at most 256 colors of a picture that has more: a pattern, not the picture itself', async () => {
    // 300 px wide, every column its own color.
    const data = new Uint8ClampedArray(300 * 4)
    for (let x = 0; x < 300; x += 1) data.set([x & 255, (x >> 8) * 90, 60, 255], x * 4)
    const wizard = await setup({ width: 300, height: 1, data })
    wizard.setWidth(300)
    expect(wizard.colorsMax.value).toBe(256)
    expect(wizard.colorsCapped.value).toBe(true)
  })
})

describe('useConvertImageWizard popovers (ticket 0896)', () => {
  it('opens one popover at a time, a second press closing it, and Background with its tool in one press', async () => {
    const wizard = await setup(flat(16, 16))
    wizard.togglePopover('size')
    expect(wizard.popover.value).toBe('size')
    wizard.togglePopover('colors')
    expect(wizard.popover.value).toBe('colors')
    wizard.togglePopover('colors')
    expect(wizard.popover.value).toBeUndefined()

    wizard.togglePopover('bead')
    wizard.togglePopover('background')
    expect([wizard.popover.value, wizard.tool.value, wizard.background.value]).toEqual(['background', 'background', 'find'])
    wizard.togglePopover('size')
    expect([wizard.popover.value, wizard.tool.value]).toEqual(['size', undefined])
  })

  it('turns the Background tool off when its popover closes, keeping what was decided', async () => {
    const wizard = await setup(flat(16, 16))
    wizard.togglePopover('background')
    wizard.setTolerance(30)
    wizard.closePopover()
    expect([wizard.popover.value, wizard.tool.value, wizard.background.value, wizard.tolerance.value]).toEqual([undefined, undefined, 'find', 30])
  })

  it('names the file being read while it is read, and nothing once it is', async () => {
    let decoded: (picture: PixelData) => void = () => {}
    const scope = effectScope()
    const wizard = scope.run(() =>
      useConvertImageWizard({
        start: { technique: 'loom', beadId: 'toho/cube/1.5mm', name: '', makerName: '' },
        decodeImage: () => new Promise<PixelData>((done) => (decoded = done)),
        loadCatalog: () => Promise.reject(new Error('no catalog')),
      }),
    )!
    const reading = wizard.setFile(new File(['12345'], 'img_2041.jpg', { type: 'image/jpeg' }))
    expect(wizard.readingFile.value).toEqual({ name: 'img_2041.jpg', bytes: 5 })
    decoded(flat(8, 8))
    await reading
    expect(wizard.readingFile.value).toBeUndefined()
    scope.stop()
  })
})

describe('useConvertImageWizard the Background tool’s steps (ticket 0787)', () => {
  /** A 12 × 12 white wall round a 4 × 4 red square: the wall is 128 of 144 beads, 89%. */
  function onAWall(): PixelData {
    const data: number[] = []
    for (let y = 0; y < 12; y += 1) for (let x = 0; x < 12; x += 1) data.push(...(x >= 4 && x < 8 && y >= 4 && y < 8 ? [230, 55, 70, 255] : [255, 255, 255, 255]))
    return { width: 12, height: 12, data: new Uint8ClampedArray(data) }
  }
  /** The lattice index of a Frame bead, as the preview hands it to the wizard. */
  const latticeIndex = (wizard: Awaited<ReturnType<typeof setup>>, row: number, column: number) => {
    const at = wizard.lattice.value!
    return (at.frameRow + row) * at.columns + at.frameColumn + column
  }
  const percent = (wizard: Awaited<ReturnType<typeof setup>>) => wizard.backgroundFound.value?.percent
  /** The wall at one bead a pixel (the starting Width of a small picture is larger), with Remove background on. */
  async function wall() {
    const wizard = await setup(onAWall())
    wizard.setWidth(12)
    expect(wizard.dimensions.value).toEqual({ columns: 12, rows: 12 })
    return wizard
  }

  it('keeps the patch under a step on a found bead, and takes it back and forth with Undo, Redo and Start over', async () => {
    const wizard = await wall()
    wizard.setRemoveBackground(true)
    expect(percent(wizard)).toBe(89)
    wizard.beginMark(latticeIndex(wizard, 0, 0))
    wizard.endMark()
    expect(percent(wizard)).toBe(0)
    expect(wizard.hasMarks.value).toBe(true)
    expect(wizard.canRedo.value).toBe(false)

    wizard.undo()
    expect(percent(wizard)).toBe(89)
    expect(wizard.canRedo.value).toBe(true)
    wizard.redo()
    expect(percent(wizard)).toBe(0)
    wizard.resetMarks()
    expect(percent(wizard)).toBe(89)
    expect(wizard.hasMarks.value).toBe(false)
    wizard.undo()
    expect(percent(wizard)).toBe(0)
  })

  it('rolls back every background decision: the switch, Tolerance as one step, Remove and Show what was found', async () => {
    const wizard = await wall()
    expect(wizard.canUndo.value).toBe(false)
    wizard.setRemoveBackground(true)
    wizard.setTolerance(10)
    wizard.setTolerance(11)
    wizard.setTolerance(12)
    wizard.removeFound()
    expect(wizard.background.value).toBe('removed')

    wizard.undo()
    expect(wizard.background.value).toBe('find')
    expect(wizard.tolerance.value).toBe(12)
    wizard.undo()
    expect(wizard.tolerance.value).toBe(BACKGROUND_TOLERANCE.start)
    wizard.undo()
    expect(wizard.background.value).toBe('off')
    expect(wizard.canUndo.value).toBe(false)

    wizard.redo()
    wizard.redo()
    wizard.redo()
    expect(wizard.background.value).toBe('removed')
    expect(wizard.tolerance.value).toBe(12)
    expect(wizard.canRedo.value).toBe(false)

    // A new decision drops what was undone.
    wizard.undo()
    wizard.setTolerance(20)
    expect(wizard.canRedo.value).toBe(false)
  })

  it('keeps the Background tool, and so its popover, on when the switch or Undo turns Remove background off (ticket 0896)', async () => {
    const wizard = await wall()
    wizard.setTool('background')
    expect(wizard.background.value).toBe('find')
    wizard.undo()
    expect([wizard.background.value, wizard.tool.value]).toEqual(['off', 'background'])
    wizard.setRemoveBackground(true)
    wizard.setRemoveBackground(false)
    expect([wizard.background.value, wizard.popover.value]).toEqual(['off', 'background'])
  })

  it('makes the patch under a step on a kept bead background, a drag one step, and replays it on a new Width', async () => {
    const wizard = await wall()
    wizard.setRemoveBackground(true)
    wizard.beginMark(latticeIndex(wizard, 5, 5))
    wizard.extendMark(latticeIndex(wizard, 6, 6))
    wizard.endMark()
    expect(percent(wizard)).toBe(100)
    expect(wizard.hasMarks.value).toBe(true)

    // A smaller Width: the step's pixels now fall on the red square's beads of the 8 × 8 grid, so it is still removed.
    wizard.setWidth(8)
    expect(wizard.dimensions.value).toEqual({ columns: 8, rows: 8 })
    expect(percent(wizard)).toBe(100)
    wizard.undo()
    expect(percent(wizard)).toBe(94)
  })

  it('drops the steps on a turn, a flip or a new picture, and keeps them while Remove background is off', async () => {
    const wizard = await wall()
    wizard.setRemoveBackground(true)
    wizard.beginMark(latticeIndex(wizard, 5, 5))
    wizard.endMark()
    expect(percent(wizard)).toBe(100)

    wizard.setRemoveBackground(false)
    expect(wizard.backgroundFound.value).toBeUndefined()
    wizard.setRemoveBackground(true)
    expect(percent(wizard)).toBe(100)

    wizard.turn()
    expect(wizard.canUndo.value).toBe(false)
    expect(percent(wizard)).toBe(89)
  })

  it('turns Remove background on with the tool, and a step on an off background too', async () => {
    const wizard = await wall()
    wizard.setTool('background')
    expect(wizard.tool.value).toBe('background')
    expect(wizard.background.value).toBe('find')
    wizard.setRemoveBackground(false)
    expect(wizard.tool.value).toBe('background')

    wizard.beginMark(latticeIndex(wizard, 0, 0))
    wizard.endMark()
    expect(wizard.background.value).toBe('find')
    expect(percent(wizard)).toBe(0)
  })
})

describe('useConvertImageWizard photo or flat art (ticket 0889)', () => {
  /** A wizard handed these pictures in turn, one each time a file is set. */
  async function opening(...pictures: PixelData[]) {
    const queue = [...pictures]
    const wizard = effectScope().run(() =>
      useConvertImageWizard({
        start: { technique: 'loom', beadId: 'toho/cube/1.5mm', name: '', makerName: '' },
        decodeImage: async () => queue.shift()!,
        loadCatalog: () => Promise.reject(new Error('no catalog')),
      }),
    )!
    const setNext = () => wizard.setFile(new File(['x'], 'picture.jpg', { type: 'image/jpeg' }))
    await setNext()
    return { wizard, setNext }
  }

  it('opens two photos of different pixel widths at the same Width, 60, though one has a mark at 50', async () => {
    for (const width of [800, 1000]) {
      const { wizard } = await opening(photoPictureSized(width, 600))
      expect(wizard.pictureKind.value).toBe('photo')
      expect(wizard.sizing.value.width).toBe(60)
    }
  })

  it('opens flat art on a mark, as before', async () => {
    const { wizard } = await opening(pixelArtPicture(200))
    expect(wizard.pictureKind.value).toBe('flat')
    expect(wizard.sizing.value.mark).toEqual({ width: 50, pixelsPerBead: 4 })
  })

  it('tells a replaced picture again, and never changes the Width the person set', async () => {
    const { wizard, setNext } = await opening(pixelArtPicture(200), photoPictureSized(800, 600))
    wizard.setWidth(42)
    await setNext()
    expect(wizard.pictureKind.value).toBe('photo')
    expect(wizard.sizing.value.width).toBe(42)
  })
})
