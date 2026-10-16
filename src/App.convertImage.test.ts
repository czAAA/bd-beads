import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { beadColor, drawnProject } from './testUtils/beads'
import { BEAD_CATALOG } from './domain/beads'
import { projectExtentPx } from './rendering/surfaceView'
import type { PixelData } from './domain/imageConversion'
import { loadProjects } from './services/libraryStore'
import { ru } from './i18n/ru'
import { openNewProject } from './testUtils/pill'

/**
 * Convert image end to end through the app shell (ticket 58): the New Project form's file input, the framing step
 * taking the canvas panel over, and the Project it creates.
 *
 * The one thing stubbed is the decode itself — jsdom decodes no image bytes and paints no canvas (see imageDecode.ts),
 * so the picture arrives here as pixel data built by hand, which is exactly what the real adapter would have produced.
 */
const decodeState = vi.hoisted(() => ({
  image: undefined as PixelData | undefined,
  error: undefined as Error | undefined,
}))

vi.mock('./services/imageDecode', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./services/imageDecode')>()
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

/** Raises the New Project sheet. The form states no size (ticket 342): all it has to settle before a picture is the Bead. */
async function pickBead(wrapper: ReturnType<typeof mount>, beadId = cubeBead.id) {
  await openNewProject(wrapper)
  await wrapper.find('[data-testid="bead-select"]').setValue(beadId)
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

/** Starts framing a 15 x 30mm Project (10 x 20 cells in 1.5mm cubes) from the two-block picture, its size stated in the size step. */
async function startFraming(
  wrapper: ReturnType<typeof mount>,
  width = '15',
  height = '30',
  form: { technique?: string; beadId?: string; name?: string } = {},
) {
  await pickBead(wrapper, form.beadId)
  if (form.technique) {
    await wrapper.find(`[data-testid="technique-select"] [data-value="${form.technique}"]`).trigger('click')
  }
  if (form.name) {
    await wrapper.find('[data-testid="name-input"]').setValue(form.name)
  }
  await chooseImage(wrapper)
  await stateSizeStep(wrapper, width, height)
}

/** Fills in the size step a chosen picture opens (ticket 342), in mm, and continues to framing. */
async function stateSizeStep(wrapper: ReturnType<typeof mount>, width = '15', height = '30') {
  await wrapper.find('[data-testid="convert-size-unit"] [data-value="mm"]').trigger('click')
  await wrapper.find('[data-testid="width-input"]').setValue(width)
  await wrapper.find('[data-testid="height-input"]').setValue(height)
  await wrapper.find('[data-testid="convert-size-continue"]').trigger('click')
  await flushPromises()
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'ru') // these tests read the Russian dictionary
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

  it('frames the size stated in the size step, a size in mm rounding up to whole beads (ticket 342)', async () => {
    const wrapper = mount(App)
    await startFraming(wrapper, '15.1', '30')

    // 15.1mm is 10.07 cubes across: 11 columns.
    expect(wrapper.find('[data-testid="convert-image-frame-outline"]').attributes('style')).toContain(
      `width: ${projectExtentPx('loom', 11, 1).width}px`,
    )
  })
})

describe('App Convert image creating the Project (ticket 58)', () => {
  it('creates a Project from the picture and opens it', async () => {
    const wrapper = mount(App)
    await startFraming(wrapper)

    await wrapper.find('[data-testid="convert-image-create"]').trigger('click')

    expect(wrapper.find('[data-testid="convert-image-frame"]').exists()).toBe(false)
    expect(drawnProject(wrapper)).toMatchObject({ frame: { rows: 20, columns: 10 } })
    // The left half of the picture is red, the right half blue.
    expect(beadColor(wrapper, 0)).toBe('#e63746')
    expect(beadColor(wrapper, 9)).toBe('#2f6fed')
  })
})

describe('App Convert image cancelling (ticket 58)', () => {
  it('creates nothing and gives the empty canvas panel back', async () => {
    const wrapper = mount(App)
    await startFraming(wrapper)

    await wrapper.find('[data-testid="convert-image-cancel"]').trigger('click')

    expect(loadProjects()).toEqual([])
    expect(wrapper.find('[data-testid="convert-image-frame"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="app-canvas-placeholder"]').exists()).toBe(true)
  })
})

describe('App Convert image rejections (ticket 58)', () => {
  it('says why a picture was turned away and stays on the form', async () => {
    const wrapper = mount(App)
    await pickBead(wrapper)

    await chooseImage(wrapper, 'IMG_0001.HEIC', '')

    expect(wrapper.find('[data-testid="convert-image-error"]').text()).toBe(ru.convertImage.errors.heic)
    expect(wrapper.find('[data-testid="convert-image-frame"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="app-canvas-placeholder"]').exists()).toBe(true)
  })
})

describe('App empty canvas (ticket 158)', () => {
  it('keeps the canvas box with an empty board, what is missing and what to do, and no Progress bar', () => {
    const wrapper = mount(App)

    const empty = wrapper.find('[data-testid="app-canvas-placeholder"]')
    expect(empty.find('.empty-canvas__board').exists()).toBe(true)
    expect(empty.text()).toContain(ru.shell.canvasPlaceholder)
    expect(empty.text()).toContain(ru.shell.canvasPlaceholderHint)
    expect(wrapper.find('[data-testid="app-canvas"] [data-testid="canvas-strip"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="progress-bar"]').exists()).toBe(false)
  })
})
