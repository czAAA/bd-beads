import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { BEAD_CATALOG } from './domain/beads'
import { gridWidthPx } from './domain/grid'
import type { PixelData } from './domain/imageConversion'
import { ImageConversionError } from './domain/imageDecode'
import { loadPatterns } from './domain/patternStorage'
import { ru } from './i18n/ru'

/**
 * Convert image end to end through the app shell (ticket 58): the New Pattern form's file input, the framing step
 * taking the canvas panel over, and the Pattern it creates.
 *
 * The one thing stubbed is the decode itself — jsdom decodes no image bytes and paints no canvas (see imageDecode.ts),
 * so the picture arrives here as pixel data built by hand, which is exactly what the real adapter would have produced.
 */
const decodeState = vi.hoisted(() => ({
  image: undefined as PixelData | undefined,
  error: undefined as Error | undefined,
}))

vi.mock('./domain/imageDecode', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./domain/imageDecode')>()
  return {
    ...actual,
    decodeImageFile: async () => {
      if (decodeState.error) {
        throw decodeState.error
      }
      return decodeState.image!
    },
  }
})

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

/** A picture of two flat blocks: the left half red, the right half blue. */
function twoBlocks(width = 8, height = 8): PixelData {
  const rgba: number[][] = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      rgba.push(x < width / 2 ? [255, 0, 0, 255] : [0, 0, 255, 255])
    }
  }
  return { width, height, data: new Uint8ClampedArray(rgba.flat()) }
}

async function stateSize(wrapper: ReturnType<typeof mount>, width: string, height: string) {
  await wrapper.find('[data-testid="bead-select"]').setValue(cubeBead.id)
  await wrapper.find('[data-testid="width-input"]').setValue(width)
  await wrapper.find('[data-testid="height-input"]').setValue(height)
}

async function chooseImage(wrapper: ReturnType<typeof mount>, name = 'art.png', type = 'image/png') {
  const input = wrapper.find('[data-testid="convert-image-input"]')
  Object.defineProperty(input.element, 'files', {
    value: [new File(['pretend this is a picture'], name, { type })],
    configurable: true,
  })
  await input.trigger('change')
  await flushPromises()
}

/** Starts framing a 15 x 30mm Pattern (10 x 20 cells in 1.5mm cubes) from the two-block picture. */
async function startFraming(wrapper: ReturnType<typeof mount>, width = '15', height = '30') {
  await stateSize(wrapper, width, height)
  await chooseImage(wrapper)
}

beforeEach(() => {
  localStorage.clear()
  decodeState.image = twoBlocks()
  decodeState.error = undefined
})

describe('App Convert image framing (ticket 58)', () => {
  it('takes the canvas panel over, in the slot the empty-canvas placeholder occupies', async () => {
    const wrapper = mount(App)
    expect(wrapper.find('[data-testid="app-canvas-placeholder"]').exists()).toBe(true)

    await startFraming(wrapper)

    expect(wrapper.find('[data-testid="convert-image-frame"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="app-canvas-placeholder"]').exists()).toBe(false)
  })

  it('keeps the New Pattern form up and editable while framing', async () => {
    const wrapper = mount(App)
    await startFraming(wrapper)

    expect(wrapper.find('[data-testid="width-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="technique-select"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="bead-select"]').exists()).toBe(true)
  })

  it('moves the frame as the size fields are edited', async () => {
    const wrapper = mount(App)
    await startFraming(wrapper)

    const outline = () => wrapper.find('[data-testid="convert-image-frame-outline"]').attributes('style')
    expect(outline()).toContain(`width: ${gridWidthPx('loom', 10)}px`)

    await wrapper.find('[data-testid="width-input"]').setValue('7.5')

    expect(outline()).toContain(`width: ${gridWidthPx('loom', 5)}px`)
  })

  it('follows the Technique as it is changed, staggering the beads for peyote', async () => {
    const wrapper = mount(App)
    await startFraming(wrapper)

    expect(wrapper.find('[data-testid="convert-image-lattice"]').classes()).toContain(
      'convert-image-frame__lattice--loom',
    )

    await wrapper.find('[data-testid="technique-select"]').setValue('peyote')

    expect(wrapper.find('[data-testid="convert-image-lattice"]').classes()).toContain(
      'convert-image-frame__lattice--peyote',
    )
  })

  it('follows the Bead as it is changed, since the Bead footprint is what the frame cells are', async () => {
    const wrapper = mount(App)
    await startFraming(wrapper)

    const delica = BEAD_CATALOG.find((bead) => bead.id === 'miyuki-delica-11-0')!
    await wrapper.find('[data-testid="bead-select"]').setValue(delica.id)

    // 15mm across a 1.6mm Delica is 9 columns, not the 1.5mm cube's 10.
    expect(wrapper.find('[data-testid="convert-image-frame-outline"]').attributes('style')).toContain(
      `width: ${gridWidthPx('loom', 9)}px`,
    )
  })

  it('swaps the editor zoom cluster for the framing one, in the same panel corner', async () => {
    const wrapper = mount(App)
    await startFraming(wrapper)

    const controls = wrapper.findAll('[data-testid="zoom-controls"]')
    expect(controls).toHaveLength(1)
    expect(controls[0]!.classes()).toContain('app-shell__zoom-controls')
    expect(wrapper.find('[data-testid="zoom-level"]').text()).toBe('100%')
  })

  it('zooms the picture in steps, never below the scale that covers the frame', async () => {
    const wrapper = mount(App)
    await startFraming(wrapper)

    // Already at cover, which is this zoom's minimum (the whole 100–800% range is pinned in useConvertImage.test.ts
    // and clampConvertZoom's own tests, without re-rendering thousands of beads per step).
    await wrapper.find('[data-testid="zoom-out"]').trigger('click')
    expect(wrapper.find('[data-testid="zoom-level"]').text()).toBe('100%')

    await wrapper.find('[data-testid="zoom-in"]').trigger('click')
    expect(wrapper.find('[data-testid="zoom-level"]').text()).toBe('125%')

    await wrapper.find('[data-testid="zoom-reset"]').trigger('click')
    expect(wrapper.find('[data-testid="zoom-level"]').text()).toBe('100%')
  })

  it('reflows the beads as the picture is zoomed', async () => {
    const wrapper = mount(App)
    await startFraming(wrapper)
    const beads = () => wrapper.findAll('[data-testid="convert-image-bead"]').length

    const atCover = beads()
    await wrapper.find('[data-testid="zoom-in"]').trigger('click')

    expect(beads()).toBeGreaterThan(atCover)
  })

  it('stays put when the size fields grow the frame past what the zoom was set for', async () => {
    const wrapper = mount(App)
    await startFraming(wrapper)

    await wrapper.find('[data-testid="zoom-in"]').trigger('click')
    await wrapper.find('[data-testid="width-input"]').setValue('60')

    // 200% still means "twice the scale that covers this frame", whatever the frame has become.
    expect(wrapper.find('[data-testid="zoom-level"]').text()).toBe('125%')
    expect(wrapper.find('[data-testid="convert-image-frame-outline"]').attributes('style')).toContain(
      `width: ${gridWidthPx('loom', 40)}px`,
    )
  })
})

describe('App Convert image creating the Pattern (ticket 58)', () => {
  it('creates a Pattern from the picture and opens it', async () => {
    const wrapper = mount(App)
    await startFraming(wrapper)

    await wrapper.find('[data-testid="convert-image-create"]').trigger('click')

    expect(wrapper.find('[data-testid="convert-image-frame"]').exists()).toBe(false)
    const rows = wrapper.findAll('[data-testid="grid-row"]')
    expect(rows).toHaveLength(20)
    expect(rows[0]!.findAll('[data-testid="grid-cell"]')).toHaveLength(10)
    // The left half of the picture is red, the right half blue.
    expect(rows[0]!.findAll('[data-testid="grid-cell"]')[0]!.attributes('style')).toContain('rgb(255, 0, 0)')
    expect(rows[0]!.findAll('[data-testid="grid-cell"]')[9]!.attributes('style')).toContain('rgb(0, 0, 255)')
  })

  it('saves it with its Image colors, so it survives a reload', async () => {
    const wrapper = mount(App)
    await startFraming(wrapper)

    await wrapper.find('[data-testid="convert-image-create"]').trigger('click')

    const saved = loadPatterns()
    expect(saved).toHaveLength(1)
    expect(new Set(saved[0]!.imageColors)).toEqual(new Set(['#ff0000', '#0000ff']))
    expect(saved[0]!.columns).toBe(10)
    expect(saved[0]!.rows).toBe(20)
  })

  it('uses the name typed into the form, and the Bead label when none was', async () => {
    const wrapper = mount(App)
    await startFraming(wrapper)
    await wrapper.find('[data-testid="name-input"]').setValue('Fox')

    await wrapper.find('[data-testid="convert-image-create"]').trigger('click')

    expect(loadPatterns()[0]!.name).toBe('Fox')
  })

  it('offers the Image colors in the Colors group of the Pattern it created', async () => {
    const wrapper = mount(App)
    await startFraming(wrapper)

    await wrapper.find('[data-testid="convert-image-create"]').trigger('click')

    const swatches = wrapper.findAll('[data-testid="image-color-swatch"]')
    expect(swatches).toHaveLength(2)
    expect(wrapper.find('[data-testid="palette-picker"]').exists()).toBe(true)
  })

  it('paints with an Image color once it is chosen', async () => {
    const wrapper = mount(App)
    await startFraming(wrapper)
    await wrapper.find('[data-testid="convert-image-create"]').trigger('click')

    await wrapper.find('[data-color-hex="#0000ff"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')
    // A stroke saves when the button is released (ticket 55), so end it before reading storage back.
    await wrapper.find('.app-shell').trigger('mouseup')

    expect(wrapper.findAll('[data-testid="grid-cell"]')[0]!.attributes('style')).toContain('rgb(0, 0, 255)')
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#0000ff')
  })

  it('leaves Image colors alone when the converted Pattern is painted on afterwards', async () => {
    const wrapper = mount(App)
    await startFraming(wrapper)
    await wrapper.find('[data-testid="convert-image-create"]').trigger('click')

    // Paint a color the picture never had, then erase one it did.
    await wrapper.find('[data-color-id="green"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')
    await wrapper.findAll('[data-testid="grid-cell"]')[1]!.trigger('mousedown', { button: 2 })
    await wrapper.find('.app-shell').trigger('mouseup')

    expect(new Set(loadPatterns()[0]!.imageColors)).toEqual(new Set(['#ff0000', '#0000ff']))
  })

  it('leaves a Pattern created the ordinary way without Image colors', async () => {
    const wrapper = mount(App)
    await stateSize(wrapper, '15', '30')

    await wrapper.find('form').trigger('submit')

    expect(loadPatterns()[0]!.imageColors).toBeUndefined()
    expect(wrapper.find('[data-testid="image-colors-picker"]').exists()).toBe(false)
  })
})

describe('App Convert image cancelling (ticket 58)', () => {
  it('creates nothing and gives the empty canvas panel back', async () => {
    const wrapper = mount(App)
    await startFraming(wrapper)

    await wrapper.find('[data-testid="convert-image-cancel"]').trigger('click')

    expect(loadPatterns()).toEqual([])
    expect(wrapper.find('[data-testid="convert-image-frame"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="app-canvas-placeholder"]').exists()).toBe(true)
  })

  it('takes the panel over with a Pattern already open, and hands it back on Cancel', async () => {
    const wrapper = mount(App)
    await stateSize(wrapper, '15', '30')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.find('[data-testid="pattern-canvas-viewport"]').exists()).toBe(true)

    const savedId = loadPatterns()[0]!.id

    // Back to the New Pattern form, start framing, then reopen the saved Pattern underneath it.
    await wrapper.find('[data-testid="new-pattern-button"]').trigger('click')
    await startFraming(wrapper)
    await wrapper.find(`[data-testid="select-pattern-${savedId}"]`).trigger('click')

    expect(wrapper.find('[data-testid="convert-image-frame"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="pattern-canvas-viewport"]').exists()).toBe(false)
    // The open Pattern's editing tools go with its canvas: there is nothing visible to Undo, Rotate or Delete all.
    expect(wrapper.find('[data-testid="toolbox"]').exists()).toBe(false)

    await wrapper.find('[data-testid="convert-image-cancel"]').trigger('click')

    expect(wrapper.find('[data-testid="pattern-canvas-viewport"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="toolbox"]').exists()).toBe(true)
    expect(loadPatterns()).toHaveLength(1)
  })

  it('starts from a clean slate when framing is entered again', async () => {
    const wrapper = mount(App)
    await startFraming(wrapper)

    await wrapper.find('[data-testid="zoom-in"]').trigger('click')
    await wrapper.find('[data-testid="convert-image-colors-decrease"]').trigger('click')
    expect(wrapper.find('[data-testid="zoom-level"]').text()).toBe('125%')

    await wrapper.find('[data-testid="convert-image-cancel"]').trigger('click')
    await chooseImage(wrapper)

    expect(wrapper.find('[data-testid="zoom-level"]').text()).toBe('100%')
    expect(wrapper.find('[data-testid="convert-image-max-colors"]').text()).toContain('12')
  })
})

describe('App Convert image rejections (ticket 58)', () => {
  it('says why a picture was turned away and stays on the form', async () => {
    const wrapper = mount(App)
    await stateSize(wrapper, '15', '30')

    await chooseImage(wrapper, 'IMG_0001.HEIC', '')

    expect(wrapper.find('[data-testid="convert-image-error"]').text()).toBe(ru.convertImage.errors.heic)
    expect(wrapper.find('[data-testid="convert-image-frame"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="app-canvas-placeholder"]').exists()).toBe(true)
  })

  it('says so when the picture cannot be decoded at all', async () => {
    decodeState.error = new ImageConversionError('decodeFailed')
    const wrapper = mount(App)
    await stateSize(wrapper, '15', '30')

    await chooseImage(wrapper)

    expect(wrapper.find('[data-testid="convert-image-error"]').text()).toBe(
      ru.convertImage.errors.decodeFailed,
    )
    expect(wrapper.find('[data-testid="convert-image-frame"]').exists()).toBe(false)
  })
})

describe('App Convert image edge cases (ticket 58)', () => {
  it('converts a single-pixel picture, upscaled to the whole grid', async () => {
    decodeState.image = { width: 1, height: 1, data: new Uint8ClampedArray([1, 2, 3, 255]) }
    const wrapper = mount(App)
    await startFraming(wrapper)

    await wrapper.find('[data-testid="convert-image-create"]').trigger('click')

    const saved = loadPatterns()[0]!
    expect(saved.imageColors).toEqual(['#010203'])
    expect(saved.grid.flat().every((cell) => cell.color === '#010203')).toBe(true)
  })

  it('converts a fully transparent picture to a Pattern with nothing painted and no Image colors', async () => {
    decodeState.image = {
      width: 2,
      height: 2,
      data: new Uint8ClampedArray(Array.from({ length: 4 }, () => [255, 0, 0, 0]).flat()),
    }
    const wrapper = mount(App)
    await startFraming(wrapper)

    await wrapper.find('[data-testid="convert-image-create"]').trigger('click')

    const saved = loadPatterns()[0]!
    expect(saved.imageColors).toEqual([])
    expect(saved.grid.flat().every((cell) => cell.color === null)).toBe(true)
    expect(wrapper.find('[data-testid="image-colors-picker"]').exists()).toBe(false)
  })

  it('reduces a busier picture to the color count asked for, live', async () => {
    decodeState.image = {
      width: 16,
      height: 16,
      data: new Uint8ClampedArray(
        Array.from({ length: 256 }, (_unused, index) => [index, 255 - index, (index * 7) % 256, 255]).flat(),
      ),
    }
    const wrapper = mount(App)
    await startFraming(wrapper)

    const found = () => Number(wrapper.find('[data-testid="convert-image-found-colors"]').text().match(/\d+$/)![0])
    const atTwelve = found()
    expect(atTwelve).toBeGreaterThan(1)
    expect(atTwelve).toBeLessThanOrEqual(12)

    for (let step = 0; step < 8; step += 1) {
      await wrapper.find('[data-testid="convert-image-colors-decrease"]').trigger('click')
    }

    expect(found()).toBeLessThanOrEqual(4)
  })
})
