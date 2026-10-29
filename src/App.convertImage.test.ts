import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { beadColor, drawnProject } from './testUtils/beads'
import { BEAD_CATALOG } from './domain/beads'
import type { PixelData } from './domain/imageConversion'
import { loadProjects } from './services/libraryStore'
import { ru } from './i18n/ru'
import { openNewProject } from './testUtils/pill'
import { chooseBeadInSection } from './testUtils/beadPicker'
import { flatView } from './testUtils/flatFields'

// Convert image end to end through the app shell (spec 0645): New Project's button or a picture dropped on the app opens
// the wizard, and Create adds the Project it shows. Only the decode is stubbed (jsdom decodes no image bytes, see
// imageDecode.ts): the picture arrives as hand-built pixel data.
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

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!

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

/** Opens Convert image from the New Project form, after choosing the form's Bead. */
async function openWizard(wrapper: ReturnType<typeof mount>, beadId = cubeBead.id) {
  await openNewProject(wrapper)
  await chooseBeadInSection(wrapper, beadId)
  await wrapper.find('[data-testid="convert-image"]').trigger('click')
  await flushPromises()
}

async function chooseImage(wrapper: ReturnType<typeof mount>, name = 'art.png', type = 'image/png') {
  const input = wrapper.find('[data-testid="convert-choose-file"]')
  Object.defineProperty(input.element, 'files', { value: [new File(['pretend this is a picture'], name, { type })], configurable: true })
  await input.trigger('change')
  await flushPromises()
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'ru') // these tests read the Russian dictionary
  decodeState.image = twoBlocks()
  decodeState.error = undefined
})

describe('App Convert image (spec 0645)', () => {
  it('opens the wizard from New Project on the form’s Bead, and creates the Project it shows', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    await openWizard(wrapper)
    expect(wrapper.find('[data-testid="convert-image-wizard"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="convert-section-bead-summary"]').exists()).toBe(true)

    await chooseImage(wrapper)
    await wrapper.find('[data-testid="convert-image-create"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="convert-image-wizard"]').exists()).toBe(false)
    // 8 px on its long side starts at 1:4: 32 × 32 beads of 1.5 mm cubes, the left half red, the right half blue.
    expect(flatView(drawnProject(wrapper))).toMatchObject({ beadId: cubeBead.id, frame: { technique: 'loom' as const, rows: 32, columns: 32 } })
    expect(beadColor(wrapper, 0)).toBe('#e63746')
    expect(beadColor(wrapper, 31)).toBe('#2f6fed')
    wrapper.unmount()
  })

  it('creates nothing on Cancel and gives the empty canvas back', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    await openWizard(wrapper)
    await wrapper.find('[data-testid="convert-image-cancel"]').trigger('click')
    await flushPromises()

    expect(loadProjects()).toEqual([])
    expect(wrapper.find('[data-testid="convert-image-wizard"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="app-canvas-placeholder"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('opens with the picture set when one is dropped on the app', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    const drop = new Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(drop, 'dataTransfer', { value: { files: [new File(['x'], 'dropped.png', { type: 'image/png' })], items: [] } })
    window.dispatchEvent(drop)
    await flushPromises()

    expect(wrapper.find('[data-testid="convert-image-wizard"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="convert-file-name"]').text()).toBe('dropped.png')
    wrapper.unmount()
  })
})

describe('App empty canvas (ticket 158)', () => {
  it('keeps the canvas box with an empty board, what is missing and what to do, and no Progress bar or Tool pill', () => {
    const wrapper = mount(App)

    const empty = wrapper.find('[data-testid="app-canvas-placeholder"]')
    expect(empty.find('.empty-canvas__board').exists()).toBe(true)
    expect(empty.text()).toContain(ru.shell.canvasPlaceholder)
    expect(empty.text()).toContain(ru.shell.canvasPlaceholderHint)
    // The strip heads the canvas box, above the board (ticket 143).
    expect(wrapper.get('[data-testid="app-canvas"]').element.firstElementChild?.getAttribute('data-testid')).toBe('canvas-strip')
    expect(wrapper.find('[data-testid="progress-bar"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="tool-pill"]').exists()).toBe(false)
  })
})
