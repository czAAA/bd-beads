import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, effectScope, h } from 'vue'
import ConvertImageWizard from './ConvertImageWizard.vue'
import ConvertStepBar from './ConvertStepBar.vue'
import BeadQuantities from '../palette/BeadQuantities.vue'
import { useConvertImageWizard, type ConvertImageWizard as Wizard } from '../../composables/import/useConvertImageWizard'
import type { ConvertStep } from '../../domain/convertSize'
import type { ColorCatalog } from '../../domain/colorCatalog'
import type { CreateProjectInput } from '../../domain/createProject'
import { ImageConversionError, formatImageLimits, type PixelData } from '../../domain/imageConversion'
import type { Project } from '../../domain/project'
import { frameGrid } from '../../testUtils/frameGrid'
import { choosePanelOption } from '../../testUtils/choosePanelOption'
import { en } from '../../i18n/en'
import { frameOf } from '../../domain/layerRecord'
import { layersView } from '../../testUtils/layerFields'

beforeEach(() => localStorage.setItem('openbeads:locale', 'en'))
afterEach(() => {
  document.body.innerHTML = ''
})

/** A 4 × 2 picture: the left half red, the right half white. */
function redAndWhite(): PixelData {
  const data: number[] = []
  for (let y = 0; y < 2; y += 1) for (let x = 0; x < 4; x += 1) data.push(...(x < 2 ? [230, 55, 70, 255] : [255, 255, 255, 255]))
  return { width: 4, height: 2, data: new Uint8ClampedArray(data) }
}

const catalog: ColorCatalog = {
  id: 'miyuki-delica',
  codes: [{ code: 'DB723', family: ['Red'], finish: 'opaque', wording: 'Opaque', sizes: ['11/0'], hex: '#d02030' }],
}

const cube: CreateProjectInput = { technique: 'loom', beadId: 'toho/cube/1.5mm', name: '', makerName: '' }
const delica: CreateProjectInput = { ...cube, beadId: 'miyuki/delica/11-0' }

function picture(name = 'fox.png', type = 'image/png', size?: number): File {
  const file = new File(['pretend this is a picture'], name, { type })
  if (size !== undefined) Object.defineProperty(file, 'size', { value: size })
  return file
}

/** The page and its Progress bar, as the canvas box mounts them for one converter session (ticket 0756). */
const Page = defineComponent({
  props: { wizard: { type: Object as () => Wizard, required: true }, readClipboardImage: { type: Function, required: true } },
  emits: ['create', 'close'],
  setup: (props, { emit }) => () => [
    h(ConvertImageWizard, { wizard: props.wizard, readClipboardImage: props.readClipboardImage as () => Promise<File | undefined>, onClose: () => emit('close') }),
    h(ConvertStepBar, { wizard: props.wizard, onCreate: () => emit('create', props.wizard.createProject()) }),
  ],
})

function open(options: { draft?: CreateProjectInput; file?: File; decodeImage?: () => Promise<PixelData>; clipboard?: File; loadCatalog?: () => Promise<ColorCatalog> } = {}) {
  const decodeImage = vi.fn(options.decodeImage ?? (async () => redAndWhite()))
  const draft = options.draft ?? cube
  const wizard = effectScope().run(() => useConvertImageWizard({ start: draft, decodeImage, loadCatalog: options.loadCatalog ?? (async () => catalog) }))!
  if (options.file) void wizard.setFile(options.file)
  const wrapper = mount(Page, { props: { wizard, readClipboardImage: async () => options.clipboard }, attachTo: document.body })
  return { wrapper, decodeImage, draft, wizard }
}

/** Shows a step, as its dot or Next on the Progress bar does. */
async function show(wizard: Wizard, step: ConvertStep) {
  wizard.goTo(step)
  await flushPromises()
}

async function chooseFile(wrapper: VueWrapper, file: File, testid = 'convert-choose-file') {
  const input = wrapper.get(`[data-testid="${testid}"]`)
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
  await flushPromises()
}

const dotDisabled = (wrapper: VueWrapper, step: string) => wrapper.get(`[data-testid="convert-step-${step}"]`).attributes('aria-disabled') === 'true'
const created = (wrapper: VueWrapper) => wrapper.emitted('create')?.[0]?.[0] as Project | undefined
/** Color by color is closed when the page opens (ticket 0747): the found-color rows are behind it. */
const openColorByColor = (wrapper: VueWrapper) => wrapper.get('[data-testid="convert-color-by-color"]').trigger('click')
/** Match to a source, as its option does (the step opens on Exact, ticket 0758). */
const matchTo = (wrapper: VueWrapper, value: string) => wrapper.get(`[data-testid="convert-color-source"] [data-value="${value}"]`).trigger('click')

describe('ConvertImageWizard before a picture is set', () => {
  it('shows Picture alone, keeps every step after it shut on the Progress bar and has nothing to create', async () => {
    const { wrapper, wizard } = open()

    expect(wrapper.findAll('[data-testid^="convert-section-"]:not([data-testid$="-header"]):not([data-testid$="-summary"])').map((section) => section.attributes('data-testid'))).toEqual([
      'convert-section-picture',
    ])
    expect(dotDisabled(wrapper, 'picture')).toBe(false)
    for (const step of ['bead', 'size', 'colors', 'review']) expect(dotDisabled(wrapper, step)).toBe(true)
    expect(wrapper.get('[data-testid="convert-next"]').attributes('aria-disabled')).toBe('true')

    await wrapper.get('[data-testid="convert-step-review"]').trigger('click')
    expect(wizard.step.value).toBe('picture')
  })

  it('lists every way in and the limits in the Note, until the first picture', async () => {
    const { wrapper } = open()
    expect(wrapper.get('[data-testid="convert-picture-note"]').text()).toBe(formatImageLimits(en.convertImage.wizard.pictureNote))

    await chooseFile(wrapper, picture())

    expect(wrapper.find('[data-testid="convert-picture-note"]').exists()).toBe(false)
    expect(dotDisabled(wrapper, 'size')).toBe(false)
    expect(wrapper.get('[data-testid="convert-picture-size"]').text()).toBe('4×2 px · png')
  })
})

describe('ConvertImageWizard ways in', () => {
  it('reads a picture handed over at opening, as one dropped or pasted on the app', async () => {
    const { wrapper, decodeImage } = open({ file: picture('pasted.png') })
    await flushPromises()

    expect(decodeImage).toHaveBeenCalledOnce()
    expect(wrapper.get('[data-testid="convert-file-name"]').text()).toBe('pasted.png')
  })

  it('takes a picture dropped on the page', async () => {
    const { wrapper } = open()
    await wrapper.get('.convert-page').trigger('drop', { dataTransfer: { files: [picture('dropped.png')], types: ['Files'] } })
    await flushPromises()

    expect(wrapper.get('[data-testid="convert-file-name"]').text()).toBe('dropped.png')
  })

  it('takes a picture from Paste, and says nothing when the clipboard holds none', async () => {
    const empty = open()
    await empty.wrapper.get('[data-testid="convert-paste"]').trigger('click')
    await flushPromises()
    expect(empty.wizard.hasPicture.value).toBe(false)
    expect(empty.wrapper.find('[data-testid="convert-nothing-to-paste"]').exists()).toBe(false)
    empty.wrapper.unmount()

    const { wrapper } = open({ clipboard: picture('clipboard.png') })
    await wrapper.get('[data-testid="convert-paste"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="convert-file-name"]').text()).toBe('clipboard.png')
  })

  it('takes a picture pasted with Ctrl+V anywhere on the page', async () => {
    const { wrapper } = open()
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', { value: { files: [picture('keys.png')] } })
    document.dispatchEvent(event)
    await flushPromises()

    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.get('[data-testid="convert-file-name"]').text()).toBe('keys.png')
  })

  it.each([
    ['dropped', async (wrapper: VueWrapper, file: File) => {
      await wrapper.get('.convert-page').trigger('drop', { dataTransfer: { files: [file], types: ['Files'] } })
      await flushPromises()
    }],
    ['chosen', (wrapper: VueWrapper, file: File) => chooseFile(wrapper, file)],
  ])('turns a HEIC file %s away with its own message and never decodes it', async (_way, giveFile) => {
    const { wrapper, decodeImage } = open()
    await giveFile(wrapper, picture('IMG_0001.HEIC', ''))

    expect(decodeImage).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="convert-image-error"]').text()).toBe(en.convertImage.errors.heic)
  })
})

describe('ConvertImageWizard rejections', () => {
  it.each([
    ['an oversize resolution', new ImageConversionError('tooManyPixels'), formatImageLimits(en.convertImage.errors.tooManyPixels)],
    ['a corrupt file', new ImageConversionError('decodeFailed'), en.convertImage.errors.decodeFailed],
    ['an unexpected failure', new Error('something else'), en.convertImage.errors.decodeFailed],
  ])('reports %s, which only the decode can see', async (_kind, error, message) => {
    const { wrapper } = open({ decodeImage: async () => Promise.reject(error) })
    await chooseFile(wrapper, picture())
    expect(wrapper.get('[data-testid="convert-image-error"]').text()).toBe(message)
  })

  it('shows the catalog could not be read, matching to the Default Palette meanwhile', async () => {
    const { wrapper, wizard } = open({ draft: delica, loadCatalog: () => Promise.reject(new Error('offline')) })
    await chooseFile(wrapper, picture())
    await show(wizard, 'colors')
    await matchTo(wrapper, 'bead-colors')
    expect(wrapper.get('[data-testid="convert-catalog-failed"]').text()).toBe(en.palette.beadColors.failed)
    await openColorByColor(wrapper)
    expect(wrapper.get('[data-picture-hex="#e63746"] [data-testid="found-color-source"]').text()).toBe(en.convertImage.wizard.defaultPalette)
  })

  it('keeps a picture already set when another is turned away, and clears the message once one goes through', async () => {
    const { wrapper } = open()
    await chooseFile(wrapper, picture('first.png'))
    await chooseFile(wrapper, picture('logo.svg', 'image/svg+xml'), 'convert-replace-file')

    expect(wrapper.get('[data-testid="convert-file-name"]').text()).toBe('first.png')
    expect(wrapper.find('[data-testid="convert-image-error"]').exists()).toBe(true)

    await chooseFile(wrapper, picture('second.png'), 'convert-replace-file')
    expect(wrapper.find('[data-testid="convert-image-error"]').exists()).toBe(false)
  })
})

describe('ConvertImageWizard setup', () => {
  it('works on its own copy of the form’s values: what it creates follows the page, the form’s are untouched', async () => {
    const { wrapper, wizard, draft } = open()
    const before = structuredClone(draft)
    await chooseFile(wrapper, picture())
    await show(wizard, 'bead')
    await choosePanelOption(wrapper, 'convert-technique', 'peyote')
    await show(wizard, 'review')
    await wrapper.get('[data-testid="convert-image-create"]').trigger('click')

    expect(layersView(created(wrapper)!)).toMatchObject({ technique: 'peyote', name: 'fox' })
    expect(draft).toEqual(before)
  })

  // Every catalog Bead has a Color catalog since ticket 0694, so the sources without Bead colors have no Bead to show.
  it('offers the Bead’s palette, the Default Palette and Exact for a Bead with a Color catalog, and opens on Exact (ticket 0758)', async () => {
    const withCatalog = open({ draft: delica })
    await chooseFile(withCatalog.wrapper, picture())
    await show(withCatalog.wizard, 'colors')
    const options = () => withCatalog.wrapper.findAll('[data-testid="convert-color-source"] [data-value]')

    expect(options().map((option) => option.attributes('data-value'))).toEqual(['bead-colors', 'default', 'exact'])
    expect(options().map((option) => option.text())).toEqual(['Miyuki Delica 11/0 palette', en.convertImage.wizard.defaultPalette, en.convertImage.wizard.exact])
    expect(withCatalog.wrapper.get('[data-testid="convert-color-source"] [aria-checked="true"]').attributes('data-value')).toBe('exact')
  })

  it('says each color is matched to the closest in the Bead’s catalog, under the Bead’s palette only (ticket 0758)', async () => {
    const { wrapper, wizard } = open({ draft: delica })
    await chooseFile(wrapper, picture())
    await show(wizard, 'colors')

    await matchTo(wrapper, 'bead-colors')
    expect(wrapper.get('[data-testid="convert-source-note"]').text()).toBe('Each color in the picture is matched to the closest color in Miyuki Delica 11/0’s catalog.')
    await matchTo(wrapper, 'default')
    expect(wrapper.find('[data-testid="convert-source-note"]').exists()).toBe(false)
    await matchTo(wrapper, 'exact')
    expect(wrapper.find('[data-testid="convert-source-note"]').exists()).toBe(false)
  })

  it('keeps the found colors exact at first, and heads their table From picture, Becomes, Beads, Change, Empty (ticket 0758)', async () => {
    const { wrapper, wizard } = open({ draft: delica })
    await chooseFile(wrapper, picture())
    await show(wizard, 'colors')
    await openColorByColor(wrapper)
    const words = en.convertImage.wizard

    expect(wrapper.get('[data-picture-hex="#e63746"] [data-testid="found-color-source"]').text()).toBe(en.palette.customColorLabel)
    expect(wrapper.findAll('[data-testid="found-colors-header"] span').map((cell) => cell.text())).toEqual([
      words.fromPicture,
      words.becomes,
      words.beadsColumn,
      words.change,
      words.empty,
    ])
  })

  it('names the bead a found color becomes by its code and name, with its hex in a Tooltip (ticket 0760)', async () => {
    const { wrapper, wizard } = open({ draft: delica })
    await chooseFile(wrapper, picture())
    await show(wizard, 'colors')
    await matchTo(wrapper, 'bead-colors')
    await openColorByColor(wrapper)
    const label = wrapper.get('[data-picture-hex="#e63746"] [data-testid="found-color-name"]')

    expect(label.get('[data-testid="color-label"]').text()).toBe('DB723 Opaque Red')
    expect(label.get('[role="tooltip"]').text()).toBe('#D02030')
  })

  it('changes a found color with the palette icon, which opens the colour popover’s body: Keep exact, the new Palette, Bead colors (ticket 0758)', async () => {
    const { wrapper, wizard } = open({ draft: delica })
    await chooseFile(wrapper, picture())
    await show(wizard, 'colors')
    await openColorByColor(wrapper)
    const row = wrapper.get('[data-picture-hex="#e63746"]')
    const change = row.get('[data-testid="found-color-remap"]')

    expect(change.find('[data-icon="palette"]').exists()).toBe(true)
    await change.trigger('click')

    expect(row.find('[data-testid="found-color-picker"]').exists()).toBe(true)
    expect(row.find('[data-testid="color-popover-close"]').exists()).toBe(true)
    expect(row.find('[data-testid="found-color-keep-exact"]').exists()).toBe(true)
    expect(row.text()).toContain(en.convertImage.wizard.newPalette)
    expect(row.find('[data-testid="bead-colors-toggle"]').text()).toContain('Miyuki Delica 11/0')
    await row.get('[data-testid="color-popover-close"]').trigger('click')
    expect(row.find('[data-testid="found-color-picker"]').exists()).toBe(false)
  })

  it('remaps a found color through the Bead colors list with its filter rows (ticket 0713)', async () => {
    const { wrapper, wizard } = open({ draft: delica })
    await chooseFile(wrapper, picture())
    await show(wizard, 'colors')
    await openColorByColor(wrapper)
    const row = wrapper.get('[data-picture-hex="#e63746"]')

    await row.get('[data-testid="found-color-remap"]').trigger('click')
    await row.get('[data-testid="bead-colors-toggle"]').trigger('click')

    expect(row.findAll('[data-testid="bead-colors-family"]').map((button) => button.attributes('aria-label'))).toEqual(['Red, 1'])
    expect(row.findAll('[data-testid="bead-colors-finish"]').map((button) => button.attributes('aria-label'))).toEqual(['Opaque, 1'])
  })
})

describe('ConvertImageWizard Create Project', () => {
  it('makes the Project of the picture, one pixel one bead for a small picture, in the Bead’s colors', async () => {
    const { wrapper, wizard } = open({ draft: delica })
    await chooseFile(wrapper, picture())
    await show(wizard, 'colors')
    await matchTo(wrapper, 'bead-colors')
    await show(wizard, 'review')
    await wrapper.get('[data-testid="convert-image-create"]').trigger('click')

    const project = created(wrapper)!
    // A 4 px wide picture goes up to 16 beads and starts there, on the ×4 mark: 16 × 8 beads.
    expect(frameOf(project)).toMatchObject({ columns: 16, rows: 8 })
    expect(frameGrid(project)[0]![0]!.color).toBe('#d02030')
    expect(project.paletteCodes).toEqual({ '#d02030': 'DB723' })
  })

  it('leaves a found color set to empty without beads', async () => {
    const { wrapper, wizard } = open()
    await chooseFile(wrapper, picture())
    await show(wizard, 'colors')
    await openColorByColor(wrapper)
    const white = wrapper.findAll('[data-testid="found-color"]').find((row) => row.attributes('data-picture-hex') === '#ffffff')!
    await white.get('[data-testid="found-color-empty"]').trigger('click')
    expect(white.get('[data-testid="found-color-name"]').text()).toBe(en.convertImage.wizard.empty)

    await show(wizard, 'review')
    await wrapper.get('[data-testid="convert-image-create"]').trigger('click')
    const grid = frameGrid(created(wrapper)!)
    expect(grid[0]!.at(-1)!.color).toBeNull()
    expect(grid[0]![0]!.color).not.toBeNull()
  })
})

describe('ConvertImageWizard Review (ticket 0759)', () => {
  const header = (wrapper: VueWrapper) => wrapper.get('[data-testid="bead-quantities"] button[aria-expanded]')

  it('shows the app’s Beads needed closed, with its total on the row, and no list of its own', async () => {
    const { wrapper, wizard } = open({ draft: delica })
    await chooseFile(wrapper, picture())
    await show(wizard, 'review')

    expect(header(wrapper).attributes('aria-expanded')).toBe('false')
    expect(header(wrapper).text()).toContain(en.quantities.heading)
    // 16 × 8 beads, and the Delica's weight, as the Frame panel writes them.
    expect(wrapper.get('[data-testid="quantity-total"]').text()).toMatch(/^128 · ≈ [\d.]+ g$/)
    expect(wrapper.find('[data-testid="quantity-row"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="convert-summary-colors"]').exists()).toBe(false)
  })

  it('opens on a press with the same counts, grams and color names as the created Project’s Beads needed', async () => {
    const { wrapper, wizard } = open({ draft: delica })
    await chooseFile(wrapper, picture())
    await show(wizard, 'colors')
    await matchTo(wrapper, 'bead-colors')
    await show(wizard, 'review')
    await header(wrapper).trigger('click')
    const rowsOf = (from: VueWrapper) => from.findAll('[data-testid="quantity-row"]').map((row) => row.text())
    const total = (from: VueWrapper) => from.get('[data-testid="quantity-total"]').text()

    await wrapper.get('[data-testid="convert-image-create"]').trigger('click')
    const project = created(wrapper)!
    // The Frame panel's section is open on a first visit.
    const real = mount(BeadQuantities, { props: { project, catalog } })

    expect(header(wrapper).attributes('aria-expanded')).toBe('true')
    expect(rowsOf(wrapper)).toEqual(rowsOf(real))
    expect(rowsOf(wrapper).length).toBeGreaterThan(0)
    expect(rowsOf(wrapper).join(' ')).toContain('DB723 Opaque Red')
    expect(total(wrapper)).toBe(total(real))
  })

  it('opens closed again each time the step is shown', async () => {
    const { wrapper, wizard } = open({ draft: delica })
    await chooseFile(wrapper, picture())
    await show(wizard, 'review')
    await header(wrapper).trigger('click')
    await show(wizard, 'colors')
    await show(wizard, 'review')

    expect(header(wrapper).attributes('aria-expanded')).toBe('false')
  })
})

describe('ConvertImageWizard preview zoom (ticket 0650)', () => {
  const zoomLevel = (wrapper: VueWrapper) => wrapper.get('[data-testid="convert-zoom-level"]').text()
  function press(key: string) {
    const event = new KeyboardEvent('keydown', { key, ctrlKey: true, cancelable: true })
    window.dispatchEvent(event)
    return event
  }

  it('zooms the preview with Ctrl/⌘ + plus, minus and 0, taking the keys from the browser', async () => {
    const { wrapper } = open()
    await chooseFile(wrapper, picture())

    expect(press('+').defaultPrevented).toBe(true)
    await flushPromises()
    expect(zoomLevel(wrapper)).toBe('150%')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '=', metaKey: true }))
    await flushPromises()
    expect(zoomLevel(wrapper)).toBe('200%')
    press('-')
    await flushPromises()
    expect(zoomLevel(wrapper)).toBe('150%')
    press('+')
    expect(press('0').defaultPrevented).toBe(true)
    await flushPromises()
    expect(zoomLevel(wrapper)).toBe('100%')
  })

  it('names the zoom buttons as the Canvas strip does, and says why one at its limit is off', async () => {
    const { wrapper } = open()
    await chooseFile(wrapper, picture())
    const zoomOut = wrapper.get('[data-testid="convert-zoom-out"]')

    expect(zoomOut.attributes()).toMatchObject({ 'aria-label': en.canvas.zoomOutLabel, 'aria-disabled': 'true' })
    expect(wrapper.get('[data-testid="convert-zoom-in"]').attributes('aria-label')).toBe(en.canvas.zoomInLabel)
    const tip = wrapper.findAll('[data-testid="convert-preview-zoom"] .app-tooltip')[0]!
    await tip.trigger('pointerenter', { pointerType: 'mouse' })
    expect(tip.get('.app-tooltip__body').text()).toBe(en.tooltips.zoomOutLimit)

    // Six presses climb the preview's seven zoom stops to the top.
    for (let step = 0; step < 6; step += 1) press('+')
    await flushPromises()
    expect(wrapper.get('[data-testid="convert-zoom-in"]').attributes('aria-disabled')).toBe('true')
    expect(zoomOut.attributes('aria-disabled')).toBeUndefined()
  })

  it('leaves the keys alone once the page is gone', async () => {
    const { wrapper } = open()
    await chooseFile(wrapper, picture())
    wrapper.unmount()
    expect(press('+').defaultPrevented).toBe(false)
  })
})

describe('ConvertImageWizard controls from the registry (ticket 0650)', () => {
  it('names Treat as empty in the Colors step as a switch with a Tooltip saying what it does, and gives the preview the eyedropper while it is on (ticket 0758)', async () => {
    const { wrapper, wizard } = open()
    await chooseFile(wrapper, picture())
    expect(wrapper.find('[data-testid="convert-treat-as-empty"]').exists()).toBe(false)
    await show(wizard, 'colors')
    const toggle = wrapper.get('[data-testid="convert-treat-as-empty"]')
    const box = () => wrapper.get('[data-testid="convert-image-box"]')

    expect(toggle.attributes('role')).toBe('switch')
    expect(toggle.attributes('aria-label')).toBe(en.convertImage.wizard.treatAsEmpty)
    expect(toggle.attributes('aria-checked')).toBe('false')
    expect(box().attributes('style')).not.toContain('cursor')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-checked')).toBe('true')
    expect(box().attributes('style')).toContain('cursor: url(')
    expect(wrapper.find('.convert-preview [data-testid="convert-treat-as-empty"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="convert-colors"] [role="tooltip"]').text()).toContain(en.tooltips.treatAsEmpty)
  })

  it('ends Treat as empty when the Colors step is left, and counts what a tap made empty (ticket 0758)', async () => {
    const { wrapper, wizard } = open()
    await chooseFile(wrapper, picture())
    await show(wizard, 'colors')
    await wrapper.get('[data-testid="convert-treat-as-empty"]').trigger('click')
    wizard.emptyAtBead(0)
    await flushPromises()

    expect(wizard.emptyColorCount.value).toBe(1)
    await show(wizard, 'review')
    expect(wizard.treatAsEmpty.value).toBe(false)
  })
})

describe('ConvertImageWizard weave, Width and Colors (ticket 0747)', () => {
  const handles = (wrapper: VueWrapper) => wrapper.findAll('[data-testid^="convert-crop-"]')

  it('weaves the whole picture at first, with no handles; A part shows them and says what follows it', async () => {
    const { wrapper, wizard } = open()
    await chooseFile(wrapper, picture())
    expect(wrapper.get('[data-testid="convert-weave"] [aria-checked="true"]').attributes('data-value')).toBe('whole')
    expect(handles(wrapper)).toHaveLength(0)

    await wrapper.get('[data-testid="convert-weave"] [data-value="part"]').trigger('click')

    expect(handles(wrapper)).toHaveLength(8)
    expect(wrapper.get('[data-testid="convert-part-hint"]').text()).toBe(en.convertImage.wizard.partHint)
    await show(wizard, 'size')
    expect(wrapper.get('[data-testid="convert-part-follows"]').text()).toBe(en.convertImage.wizard.partFollows)
  })

  it('sizes with one Width slider over the picture’s range, read in both units, the height following', async () => {
    const { wrapper, wizard } = open()
    await chooseFile(wrapper, picture())
    await show(wizard, 'size')
    const range = wrapper.get('[data-testid="convert-width-range"]')
    const input = range.element as HTMLInputElement

    // A 4 px wide picture goes from 8 to 16 beads and starts at the ×4 mark; a cube bead is 1.5 mm.
    expect([input.min, input.max, input.value]).toEqual(['8', '16', '16'])
    expect(wrapper.get('[data-testid="convert-width-value"]').text()).toBe('16 beads · 24 mm')
    expect(range.attributes('aria-valuetext')).toBe('16 beads, 24 mm, 1 px = 4 × 4 beads')
    expect(wrapper.findAll('[data-testid="convert-width-mark"]').map((mark) => mark.attributes('data-value'))).toEqual(['8', '16'])
    expect(wrapper.get('[data-testid="convert-result"]').text()).toContain('16×8 beads')

    await range.setValue('12')
    expect(wrapper.get('[data-testid="convert-result"]').text()).toContain('12×6 beads')
    expect(range.attributes('aria-valuetext')).toBe('12 beads, 18 mm')

    await wrapper.get('[data-testid="convert-size-unit"] [data-value="mm"]').trigger('click')
    expect(wrapper.get('[data-testid="convert-width-value"]').text()).toBe('18 mm · 12 beads')
  })

  it('joins Width with a Height slider and a chain: linked they move together, unlinked each stretches the picture (ticket 0757)', async () => {
    const wide = async (): Promise<PixelData> => ({ width: 40, height: 20, data: new Uint8ClampedArray(40 * 20 * 4).fill(200) })
    const { wrapper, wizard } = open({ decodeImage: wide })
    await chooseFile(wrapper, picture())
    await show(wizard, 'size')
    const input = (name: string) => wrapper.get(`[data-testid="convert-${name}-range"]`).element as HTMLInputElement
    const chain = wrapper.get('[data-testid="convert-size-chain"]')

    // Opens at the largest Width: 40 px goes up to 160 beads. Height has its own range over the picture's 20 px.
    expect([input('width').max, input('width').value]).toEqual(['160', '160'])
    expect([input('height').min, input('height').max, input('height').value]).toEqual(['8', '80', '80'])
    expect(chain.attributes('aria-label')).toBe(en.convertImage.wizard.sizeLinked)

    await wrapper.get('[data-testid="convert-height-range"]').setValue('40')
    expect(input('width').value).toBe('80')
    await wrapper.get('[data-testid="convert-width-range"]').setValue('100')
    expect(input('height').value).toBe('50')

    await chain.trigger('click')
    expect(chain.attributes('aria-label')).toBe(en.convertImage.wizard.sizeUnlinked)
    await wrapper.get('[data-testid="convert-height-range"]').setValue('20')
    expect([input('width').value, input('height').value]).toEqual(['100', '20'])
    expect(wrapper.get('[data-testid="convert-result"]').text()).toContain('100×20 beads')

    // Linked again, the side moved last holds and the other takes the picture's shape back.
    await chain.trigger('click')
    expect([input('width').value, input('height').value]).toEqual(['40', '20'])
  })

  it('gives the chain the tooltip of its state', async () => {
    const { wrapper, wizard } = open()
    await chooseFile(wrapper, picture())
    await show(wizard, 'size')
    const chain = () => wrapper.get('[data-testid="convert-size-chain"]').element.closest('.app-tooltip')!

    expect(chain().textContent).toContain(en.tooltips.sizeLinked)
    await wrapper.get('[data-testid="convert-size-chain"]').trigger('click')
    expect(chain().textContent).toContain(en.tooltips.sizeUnlinked)
  })

  it('offers a Colors slider up to every color the picture has, and keeps Color by color closed with its summary', async () => {
    const { wrapper, wizard } = open()
    await chooseFile(wrapper, picture())
    await show(wizard, 'colors')
    const range = wrapper.get('[data-testid="convert-colors-slider-range"]')
    const summary = () => wrapper.get('[data-testid="convert-color-by-color-summary"]').text()

    // Red and white: two colors, so the slider starts at its max of 2.
    expect([(range.element as HTMLInputElement).max, (range.element as HTMLInputElement).value]).toEqual(['2', '2'])
    expect(wrapper.get('[data-testid="convert-colors-slider-value"]').text()).toBe('2 colors')
    expect(wrapper.find('[data-testid="convert-color-by-color-content"]').exists()).toBe(false)
    expect(summary()).toBe('2 colors')

    await range.setValue('1')
    expect(wrapper.get('[data-testid="convert-section-colors-summary"]').text()).toMatch(/· 1$/)

    await range.setValue('2')
    await openColorByColor(wrapper)
    expect(wrapper.findAll('[data-testid="found-color"]')).toHaveLength(2)
    const white = wrapper.findAll('[data-testid="found-color"]').find((row) => row.attributes('data-picture-hex') === '#ffffff')!
    await white.get('[data-testid="found-color-empty"]').trigger('click')
    expect(summary()).toBe('1 color · 1 empty')
  })
})

describe('ConvertImageWizard Close', () => {
  // Ticket 0756: the page only asks; the shell's leave guard decides whether to ask the person.
  it('asks to close on Escape, with a picture set or not', async () => {
    const { wrapper } = open()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(wrapper.emitted('close')).toHaveLength(1)

    await chooseFile(wrapper, picture())
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(wrapper.emitted('close')).toHaveLength(2)
  })

  it('lets a press outside it through, as on the strip’s Menu', async () => {
    const { wrapper } = open()
    const outside = document.createElement('button')
    document.body.append(outside)
    const press = new PointerEvent('pointerdown', { bubbles: true, cancelable: true })
    outside.dispatchEvent(press)
    expect(press.defaultPrevented).toBe(false)
    expect(wrapper.emitted('close')).toBeUndefined()
  })
})
