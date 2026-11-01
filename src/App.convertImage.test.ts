import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { beadColor, drawnProject, pressBead } from './testUtils/beads'
import { BEAD_CATALOG } from './domain/beads'
import type { PixelData } from './domain/imageConversion'
import { loadProjects } from './services/libraryStore'
import { ru } from './i18n/ru'
import { openNewProject, openPanel, pickColor } from './testUtils/pill'
import { mountWithProject } from './testUtils/seedProject'
import { chooseBeadInSection } from './testUtils/beadPicker'
import { layersView } from './testUtils/layerFields'

// Convert image end to end through the app shell (spec 0645, ADRs 0085, 0086): New Project's button, the Menu's row or a
// dropped picture opens the page, the Progress bar steps it, Create adds the Project; leaving asks once a picture is set. Only the decode is stubbed (jsdom decodes no image bytes, see
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

// The Bead's Color catalog is not this file's subject: it stays loading, so the matches are the Default Palette's however
// fast the catalog would arrive (since ticket 0695 TOHO's covers the 1.5 mm cube, and it loads before Create is pressed).
vi.mock('./services/colorCatalogs', () => ({ loadColorCatalog: () => new Promise(() => undefined) }))

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

const page = (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-testid="convert-image-wizard"]')
const leaveModal = (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-testid="leave-converter-modal"]')
const undoOff = (wrapper: ReturnType<typeof mount>) => wrapper.get('[data-testid="strip-undo"]').attributes('aria-disabled') === 'true'
const redoOff = (wrapper: ReturnType<typeof mount>) => wrapper.get('[data-testid="strip-redo"]').attributes('aria-disabled') === 'true'

/** Opens Menu's Convert image row from the editor, a Project open. */
async function openFromMenu(wrapper: ReturnType<typeof mount>) {
  await openPanel(wrapper, 'strip-menu')
  await wrapper.get('[data-testid="menu-convert-image"]').trigger('click')
  await flushPromises()
}

describe('App Convert image as an App page (ADR 0086)', () => {
  it('opens from New Project on the form’s Bead, steps through the Progress bar, and creates the Project it shows', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    await openWizard(wrapper)
    expect(page(wrapper).exists()).toBe(true)
    // The page fills the canvas box, the strip above it and the Progress bar its footer; the modal is gone.
    const box = wrapper.get('[data-testid="app-canvas"]').element
    expect(box.firstElementChild?.getAttribute('data-testid')).toBe('canvas-strip')
    expect(box.lastElementChild?.getAttribute('data-testid')).toBe('convert-bar')
    expect(page(wrapper).element.closest('[data-testid="app-canvas"]')).toBe(box)
    expect(wrapper.find('.app-modal').exists()).toBe(false)

    await chooseImage(wrapper)
    // One step at a time: Next goes from Picture to Bead & Technique, where the form's Bead was carried over.
    expect(wrapper.find('[data-testid="convert-section-size"]').exists()).toBe(false)
    await wrapper.get('[data-testid="convert-next"]').trigger('click')
    expect(wrapper.find('[data-testid="convert-section-picture"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="convert-section-bead-summary"]').exists()).toBe(true)
    // A dot jumps to its step; Review ends in Create Project.
    await wrapper.get('[data-testid="convert-step-review"]').trigger('click')
    expect(wrapper.find('[data-testid="convert-next"]').exists()).toBe(false)
    await wrapper.get('[data-testid="convert-image-create"]').trigger('click')
    await flushPromises()

    expect(page(wrapper).exists()).toBe(false)
    // An 8 px picture opens at its largest Width (ticket 0757), 4× its pixels: 32 × 32 beads of 1.5 mm cubes, the left
    // half red, the right half blue.
    expect(layersView(drawnProject(wrapper))).toMatchObject({ beadId: cubeBead.id, frame: { technique: 'loom' as const, rows: 32, columns: 32 } })
    expect(beadColor(wrapper, 0)).toBe('#e63746')
    expect(beadColor(wrapper, 31)).toBe('#2f6fed')
    wrapper.unmount()
  })

  it('hides the editor’s Project and Frame buttons and side panels for a Close, keeping Menu', async () => {
    const wrapper = await mountWithProject(15, 30, { attachTo: document.body })
    await openFromMenu(wrapper)

    expect(page(wrapper).exists()).toBe(true)
    expect(wrapper.find('[data-testid="strip-menu"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="convert-close"]').exists()).toBe(true)
    for (const gone of ['strip-project', 'strip-frame', 'strip-export', 'strip-undo', 'canvas-strip-zoom']) expect(wrapper.find(`[data-testid="${gone}"]`).exists()).toBe(false)
    expect(wrapper.get('[data-testid="app-drawing-area"]').attributes('inert')).toBeDefined()
    expect(wrapper.find('[data-testid="selection-layer"]').exists() && wrapper.get('[data-testid="selection-layer"]').isVisible()).toBe(false)
    wrapper.unmount()
  })

  it('opens from the Menu’s Convert image row, under New Project, which shows as the current page while it is open', async () => {
    const wrapper = await mountWithProject(15, 30, { attachTo: document.body })
    await openPanel(wrapper, 'strip-menu')
    const rows = wrapper.findAll('[data-testid="menu-new-project"], [data-testid="menu-convert-image"]').map((row) => row.attributes('data-testid'))
    expect(rows).toEqual(['menu-new-project', 'menu-convert-image'])
    expect(wrapper.get('[data-testid="menu-convert-image"]').attributes('aria-current')).toBeUndefined()

    await wrapper.get('[data-testid="menu-convert-image"]').trigger('click')
    await flushPromises()
    expect(page(wrapper).exists()).toBe(true)

    await openPanel(wrapper, 'strip-menu')
    expect(wrapper.get('[data-testid="menu-convert-image"]').attributes('aria-current')).toBe('page')
    wrapper.unmount()
  })

  it('opens with the picture set when one is dropped on the app', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    const drop = new Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(drop, 'dataTransfer', { value: { files: [new File(['x'], 'dropped.png', { type: 'image/png' })], items: [] } })
    window.dispatchEvent(drop)
    await flushPromises()

    expect(page(wrapper).exists()).toBe(true)
    expect(wrapper.find('[data-testid="convert-file-name"]').text()).toBe('dropped.png')
    wrapper.unmount()
  })
})

describe('App Convert image leave guard (ADR 0085, ADR 0086)', () => {
  it('closes at once with no picture set, asking nothing, and gives the empty canvas back', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    await openWizard(wrapper)
    await wrapper.get('[data-testid="convert-close"]').trigger('click')
    await flushPromises()

    expect(leaveModal(wrapper).exists()).toBe(false)
    expect(page(wrapper).exists()).toBe(false)
    expect(loadProjects()).toEqual([])
    expect(wrapper.find('[data-testid="app-canvas-placeholder"]').exists()).toBe(true)
    wrapper.unmount()
  })

  for (const [way, leave] of [
    ['Close', (wrapper: ReturnType<typeof mount>) => wrapper.get('[data-testid="convert-close"]').trigger('click')],
    ['Escape', async () => void window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))],
  ] as const) {
    it(`asks "Leave the converter?" on ${way} once a picture is set, and Back to converter keeps everything`, async () => {
      const wrapper = mount(App, { attachTo: document.body })
      await openWizard(wrapper)
      await chooseImage(wrapper)
      await leave(wrapper)
      await flushPromises()

      const dialog = leaveModal(wrapper)
      expect(dialog.exists()).toBe(true)
      expect(dialog.text()).toContain(ru.convertImage.leave.title)
      expect(dialog.text()).toContain(ru.convertImage.leave.message)
      expect(dialog.get('[data-testid="confirm-modal-cancel"]').text()).toBe(ru.convertImage.leave.cancelButton)
      expect(dialog.get('[data-testid="confirm-modal-confirm"]').text()).toBe(ru.convertImage.leave.confirmButton)
      // Back to converter is the default.
      expect(document.activeElement).toBe(dialog.get('[data-testid="confirm-modal-cancel"]').element)

      await dialog.get('[data-testid="confirm-modal-cancel"]').trigger('click')
      await flushPromises()
      expect(leaveModal(wrapper).exists()).toBe(false)
      expect(wrapper.find('[data-testid="convert-file-name"]').text()).toBe('art.png')
      wrapper.unmount()
    })
  }

  it('leaves on Leave, back to the Project that was open with its Undo and Redo as they were, and adds nothing', async () => {
    const wrapper = await mountWithProject(15, 30, { attachTo: document.body })
    await pickColor(wrapper, 'red')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')
    const before = drawnProject(wrapper)
    expect(undoOff(wrapper)).toBe(false)
    expect(redoOff(wrapper)).toBe(true)

    await openFromMenu(wrapper)
    await chooseImage(wrapper)
    await wrapper.get('[data-testid="convert-close"]').trigger('click')
    await flushPromises()
    await leaveModal(wrapper).get('[data-testid="confirm-modal-confirm"]').trigger('click')
    await flushPromises()

    expect(page(wrapper).exists()).toBe(false)
    expect(loadProjects()).toHaveLength(1)
    expect(drawnProject(wrapper)).toEqual(before)
    expect(undoOff(wrapper)).toBe(false)
    expect(redoOff(wrapper)).toBe(true)
    expect(wrapper.get('[data-testid="app-drawing-area"]').attributes('inert')).toBeUndefined()
    // The stroke made before converting is still one Undo step.
    await wrapper.get('[data-testid="strip-undo"]').trigger('click')
    expect(undoOff(wrapper)).toBe(true)
    expect(redoOff(wrapper)).toBe(false)
    wrapper.unmount()
  })

  it('adds no Undo step of its own when it creates a Project', async () => {
    const wrapper = await mountWithProject(15, 30, { attachTo: document.body })
    await openFromMenu(wrapper)
    await chooseImage(wrapper)
    await wrapper.get('[data-testid="convert-step-review"]').trigger('click')
    await wrapper.get('[data-testid="convert-image-create"]').trigger('click')
    await flushPromises()

    expect(loadProjects()).toHaveLength(2)
    expect(undoOff(wrapper)).toBe(true)
    wrapper.unmount()
  })

  it('asks before a Menu action that leaves: a Projects library pick waits for the answer, then opens the pick', async () => {
    const wrapper = await mountWithProject(15, 30, { attachTo: document.body })
    const first = loadProjects()[0]!
    await openFromMenu(wrapper)
    await chooseImage(wrapper)
    await openPanel(wrapper, 'strip-menu')
    await wrapper.get('[data-testid="menu-saved-projects"]').trigger('click')
    await flushPromises()
    await wrapper.get(`[data-testid="select-project-${first.id}"]`).trigger('click')
    await flushPromises()

    // The pick is not made while the question stands; Back to converter drops it.
    expect(leaveModal(wrapper).exists()).toBe(true)
    expect(page(wrapper).exists()).toBe(true)
    await leaveModal(wrapper).get('[data-testid="confirm-modal-cancel"]').trigger('click')
    await flushPromises()
    expect(page(wrapper).exists()).toBe(true)
    wrapper.unmount()
  })

  it('asks before New Project too, and opens its form once the converter has gone', async () => {
    const wrapper = await mountWithProject(15, 30, { attachTo: document.body })
    await openFromMenu(wrapper)
    await chooseImage(wrapper)
    await openPanel(wrapper, 'strip-menu')
    await wrapper.get('[data-testid="menu-new-project"]').trigger('click')
    await flushPromises()
    expect(leaveModal(wrapper).exists()).toBe(true)
    expect(wrapper.find('[data-testid="create-project"]').exists()).toBe(false)

    await leaveModal(wrapper).get('[data-testid="confirm-modal-confirm"]').trigger('click')
    await flushPromises()
    expect(page(wrapper).exists()).toBe(false)
    expect(wrapper.find('[data-testid="create-project"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('leaves at once through a Menu action when the converter has no picture, and asks nothing', async () => {
    const wrapper = await mountWithProject(15, 30, { attachTo: document.body })
    await openFromMenu(wrapper)
    await openPanel(wrapper, 'strip-menu')
    await wrapper.get('[data-testid="menu-new-project"]').trigger('click')
    await flushPromises()

    expect(leaveModal(wrapper).exists()).toBe(false)
    expect(page(wrapper).exists()).toBe(false)
    expect(wrapper.find('[data-testid="create-project"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('does not ask a Menu action on the editor, which registers no guard', async () => {
    const wrapper = await mountWithProject(15, 30, { attachTo: document.body })
    await openPanel(wrapper, 'strip-menu')
    await wrapper.get('[data-testid="menu-new-project"]').trigger('click')
    await flushPromises()
    expect(leaveModal(wrapper).exists()).toBe(false)
    expect(wrapper.find('[data-testid="create-project"]').exists()).toBe(true)
    wrapper.unmount()
  })
})

describe('App empty canvas (tickets 158, 0748)', () => {
  it('keeps the canvas box with its empty positions, what is missing and what to do, an empty Canvas footer and no Tool pill', () => {
    const wrapper = mount(App)

    const empty = wrapper.find('[data-testid="app-canvas-placeholder"]')
    expect(empty.find('.empty-canvas__board').exists()).toBe(true)
    expect(empty.text()).toContain(ru.shell.canvasPlaceholder)
    expect(empty.text()).toContain(ru.shell.canvasPlaceholderHint)
    // The strip heads the canvas box, above the board (ticket 143).
    expect(wrapper.get('[data-testid="app-canvas"]').element.firstElementChild?.getAttribute('data-testid')).toBe('canvas-strip')
    // The footer is there as with a Project open, with nothing in it (ticket 0748).
    const footer = wrapper.get('[data-testid="progress-bar"]')
    expect(wrapper.get('[data-testid="app-canvas"]').element.lastElementChild).toBe(footer.element)
    expect(wrapper.find('[data-testid="tool-pill"]').exists()).toBe(false)
  })
})
