import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, effectScope, h } from 'vue'
import ConvertImageWizard from './ConvertImageWizard.vue'
import InfoButton from '../ui/InfoButton.vue'
import { useConvertImageWizard, type ConvertImageWizard as Wizard } from '../../composables/import/useConvertImageWizard'
import type { ColorCatalog } from '../../domain/colorCatalog'
import type { CreateProjectInput } from '../../domain/createProject'
import { ImageConversionError, type PixelData } from '../../domain/imageConversion'
import { imageLimitsText } from '../../i18n/imageLimits'
import type { Project } from '../../domain/project'
import { frameGrid } from '../../testUtils/frameGrid'
import { choosePanelOption } from '../../testUtils/choosePanelOption'
import { en } from '../../i18n/en'
import { fillBlanks } from '../../domain/fillBlanks'
import { frameOf } from '../../domain/layerRecord'
import { layersView } from '../../testUtils/layerFields'
import { fakeMatchMedia } from '../../testUtils/fakeMatchMedia'
import { resetKeyHintsDevice } from '../../composables/ui/useKeyHints'
import { NARROW_CONVERTER } from '../../composables/import/useConvertCompare'

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

/** The page as the canvas box mounts it for one converter session (ticket 0756), its Create Project making the Project. */
const Page = defineComponent({
  props: { wizard: { type: Object as () => Wizard, required: true }, readClipboardImage: { type: Function, required: true } },
  emits: ['create', 'close'],
  setup: (props, { emit }) => () =>
    h(ConvertImageWizard, {
      wizard: props.wizard,
      readClipboardImage: props.readClipboardImage as () => Promise<File | undefined>,
      onClose: () => emit('close'),
      onCreate: () => emit('create', props.wizard.createProject()),
    }),
})

function open(options: { draft?: CreateProjectInput; file?: File; decodeImage?: () => Promise<PixelData>; clipboard?: File; loadCatalog?: () => Promise<ColorCatalog> } = {}) {
  const decodeImage = vi.fn(options.decodeImage ?? (async () => redAndWhite()))
  const draft = options.draft ?? cube
  const wizard = effectScope().run(() => useConvertImageWizard({ start: draft, decodeImage, loadCatalog: options.loadCatalog ?? (async () => catalog) }))!
  if (options.file) void wizard.setFile(options.file)
  const wrapper = mount(Page, { props: { wizard, readClipboardImage: async () => options.clipboard }, attachTo: document.body })
  return { wrapper, decodeImage, draft, wizard }
}

/** Opens one of the column's popovers by its button (ticket 0896), unless it is open already. */
async function show(wrapper: VueWrapper, popover: 'bead' | 'size' | 'colors') {
  const button = wrapper.get(`[data-testid="${popover === 'bead' ? 'convert-bead-button' : `convert-${popover}-more`}"]`)
  if (button.attributes('aria-expanded') !== 'true') await button.trigger('click')
  await flushPromises()
}

/** A slider on the doubling scale (ValueSlider card): its value as heard, and a move of its thumb to a value. */
const sliderValue = (wrapper: VueWrapper, testid: string) => Number(wrapper.get(`[data-testid="${testid}-range"]`).attributes('aria-valuenow'))
const sliderRange = (wrapper: VueWrapper, testid: string) => {
  const range = wrapper.get(`[data-testid="${testid}-range"]`)
  return { min: Number(range.attributes('aria-valuemin')), max: Number(range.attributes('aria-valuemax')) }
}
async function slide(wrapper: VueWrapper, testid: string, value: number) {
  const { min, max } = sliderRange(wrapper, testid)
  await wrapper.get(`[data-testid="${testid}-range"]`).setValue(String(Math.round((Math.log(value / min) / Math.log(max / min)) * 1000)))
}

async function chooseFile(wrapper: VueWrapper, file: File, testid = 'convert-choose-file') {
  const input = wrapper.get(`[data-testid="${testid}"]`)
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
  await flushPromises()
}

const isOff = (wrapper: VueWrapper, testid: string) => wrapper.get(`[data-testid="${testid}"]`).attributes('aria-disabled') === 'true'
const created = (wrapper: VueWrapper) => wrapper.emitted('create')?.[0]?.[0] as Project | undefined
/** Color by color is open in the Colors popover (ticket 0896): its rows are one press away. */
const openColorByColor = (wrapper: VueWrapper) => show(wrapper, 'colors')
/** The Tooltip body of the Info button with this test id (ticket 0894). */
const infoBody = (wrapper: VueWrapper, testid: string) =>
  wrapper.findAllComponents(InfoButton).find((info) => info.vm.$attrs['data-testid'] === testid)?.props('body')
/** The match to menu's items, opened from its button (ConvertImage card DS-2). */
async function sourceItems(wrapper: VueWrapper) {
  const button = wrapper.get('[data-testid="convert-color-source"]')
  if (button.attributes('aria-expanded') !== 'true') await button.trigger('click')
  return wrapper.findAll('[data-testid="convert-color-source-option"]')
}
/** Match to a source, as its menu item does (the step opens on the Bead's palette, ticket 0863). */
async function matchTo(wrapper: VueWrapper, value: string) {
  const item = (await sourceItems(wrapper)).find((option) => option.attributes('data-value') === value)!
  await item.trigger('click')
}

describe('ConvertImageWizard before a picture is set', () => {
  it('holds the drop zone and the column, Width, Colors, their buttons and Create Project off with why, Bead and Technique live (ticket 0896)', async () => {
    const { wrapper } = open()
    expect(wrapper.find('[data-testid="convert-step-pane"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="convert-drop-zone"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="convert-no-picture"]').text()).toBe(en.convertImage.wizard.bandEmpty)
    for (const testid of ['convert-width-range', 'convert-colors-slider-range', 'convert-size-more', 'convert-colors-more', 'convert-image-create']) {
      expect(isOff(wrapper, testid), testid).toBe(true)
    }
    expect(wrapper.get('[data-testid="convert-width-value"]').text()).toBe('—')
    expect(wrapper.find('[data-testid="convert-preview-tools"]').exists()).toBe(false)

    // Bead and Technique can be chosen before a picture.
    await show(wrapper, 'bead')
    expect(wrapper.find('[data-testid="convert-technique"]').exists()).toBe(true)
    // An off slider does not move.
    await wrapper.get('[data-testid="convert-size-more"]').trigger('click')
    expect(wrapper.find('[data-testid="convert-size-popover"]').exists()).toBe(false)
  })

  it('says what pictures work behind an Info button in the drop zone, and names the picture once one is set', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
    const { wrapper } = open()
    expect(infoBody(wrapper, 'convert-picture-note')).toBe(imageLimitsText('en', en.convertImage.wizard.pictureNote, { pasteKey: 'Ctrl+V' }))

    await chooseFile(wrapper, picture())

    expect(wrapper.find('[data-testid="convert-drop-zone"]').exists()).toBe(false)
    expect(isOff(wrapper, 'convert-size-more')).toBe(false)
    expect(wrapper.get('[data-testid="convert-picture-size"]').text()).toBe('4×2 px')
    vi.restoreAllMocks()
  })
})

describe('ConvertImageWizard help lines by device (ticket 0846)', () => {
  const realMatchMedia = window.matchMedia
  function onDevice(media: Record<string, boolean>, userAgent: string) {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent)
    window.matchMedia = fakeMatchMedia(media).matchMedia
    resetKeyHintsDevice()
  }
  afterEach(() => {
    window.matchMedia = realMatchMedia
    vi.restoreAllMocks()
    resetKeyHintsDevice()
  })
  const emptyLines = (wrapper: VueWrapper) => ['.convert-drop__title-text', '.convert-drop__line'].map((line) => wrapper.get(line).text())

  it('names ⌘V on an Apple keyboard, in the drop zone and its Info', () => {
    onDevice({ '(any-pointer: fine) and (any-hover: hover)': true }, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)')
    const { wrapper } = open()
    expect(emptyLines(wrapper)).toEqual(['Drop a picture here', 'or paste one with ⌘V'])
    expect(infoBody(wrapper, 'convert-picture-note')).toContain('paste one with ⌘V.')
  })

  it('offers nothing to drop on touch: where the picture shows and the ways in, Take photo among them', () => {
    onDevice({ '(pointer: coarse)': true }, 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)')
    const { wrapper } = open()
    expect(emptyLines(wrapper)).toEqual(['Your picture shows here', 'Choose a file, paste or take a photo'])
    expect(infoBody(wrapper, 'convert-picture-note')).toBe(imageLimitsText('en', en.convertImage.wizard.pictureNoteTouch))
    expect(wrapper.find('[data-testid="convert-take-photo"]').exists()).toBe(true)
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
    ['an oversize resolution', new ImageConversionError('tooManyPixels'), imageLimitsText('en', en.convertImage.errors.tooManyPixels)],
    ['a corrupt file', new ImageConversionError('decodeFailed'), en.convertImage.errors.decodeFailed],
    ['an unexpected failure', new Error('something else'), en.convertImage.errors.decodeFailed],
  ])('reports %s, which only the decode can see', async (_kind, error, message) => {
    const { wrapper } = open({ decodeImage: async () => Promise.reject(error) })
    await chooseFile(wrapper, picture())
    expect(wrapper.get('[data-testid="convert-image-error"]').text()).toBe(message)
  })

  it('shows the catalog could not be read, matching to the Default Palette meanwhile', async () => {
    const { wrapper } = open({ draft: delica, loadCatalog: () => Promise.reject(new Error('offline')) })
    await chooseFile(wrapper, picture())
    await show(wrapper, 'colors')
    await matchTo(wrapper, 'bead-colors')
    expect(wrapper.get('[data-testid="convert-catalog-failed"]').text()).toBe(en.palette.beadColors.failed)
    await openColorByColor(wrapper)
    expect(wrapper.get('[data-picture-hex~="#e63746"] [data-testid="found-color-source"]').text()).toBe(en.convertImage.wizard.defaultPalette)
  })

  it('keeps a picture already set when another is turned away, and clears the message once one goes through', async () => {
    const { wrapper } = open()
    await chooseFile(wrapper, picture('first.png'))
    await chooseFile(wrapper, picture('logo.svg', 'image/svg+xml'), 'convert-replace-input')

    expect(wrapper.get('[data-testid="convert-file-name"]').text()).toBe('first.png')
    expect(wrapper.find('[data-testid="convert-image-error"]').exists()).toBe(true)

    await chooseFile(wrapper, picture('second.png'), 'convert-replace-input')
    expect(wrapper.find('[data-testid="convert-image-error"]').exists()).toBe(false)
  })
})

describe('ConvertImageWizard setup', () => {
  it('works on its own copy of the form’s values: what it creates follows the page, the form’s are untouched', async () => {
    const { wrapper, draft } = open()
    const before = structuredClone(draft)
    await chooseFile(wrapper, picture())
    await show(wrapper, 'bead')
    await choosePanelOption(wrapper, 'convert-technique', 'peyote')
    await wrapper.get('[data-testid="convert-image-create"]').trigger('click')

    expect(layersView(created(wrapper)!)).toMatchObject({ technique: 'peyote', name: 'fox' })
    expect(draft).toEqual(before)
  })

  // Every catalog Bead has a Color catalog since ticket 0694, so the sources without Bead colors have no Bead to show.
  it('offers the Bead’s palette, the Default Palette and Exact for a Bead with a Color catalog, and opens on the Bead’s palette (tickets 0758, 0863)', async () => {
    const withCatalog = open({ draft: delica })
    await chooseFile(withCatalog.wrapper, picture())
    await show(withCatalog.wrapper, 'colors')
    const options = await sourceItems(withCatalog.wrapper)

    expect(options.map((option) => option.attributes('data-value'))).toEqual(['bead-colors', 'default', 'exact'])
    expect(options.map((option) => option.text())).toEqual(['Miyuki Delica 11/0 palette1', en.convertImage.wizard.defaultPalette, en.convertImage.wizard.exact])
    expect(options.find((option) => option.attributes('aria-current') === 'true')!.attributes('data-value')).toBe('bead-colors')
    expect(withCatalog.wrapper.get('[data-testid="convert-color-source"]').text()).toBe('Miyuki Delica 11/0 palette')
  })

  it('says what each choice does behind an Info button, and under Exact that a color is one bead color (tickets 0758, 0863, 0894)', async () => {
    const { wrapper } = open({ draft: delica })
    await chooseFile(wrapper, picture())
    await show(wrapper, 'colors')
    const words = en.convertImage.wizard
    const note = () => infoBody(wrapper, 'convert-color-source-info')
    const hint = () => infoBody(wrapper, 'convert-colors-slider-info')

    // The three notes share one Info, each led by its choice's name (ticket 0896).
    expect(note()).toBe(
      `Miyuki Delica 11/0 palette: The codes are real Miyuki Delica 11/0 beads. Their colors are approximate, made from the color family and the finish. ${words.defaultPalette}: ${words.defaultPaletteNote} ${words.exact}: ${words.exactNote} ${words.finish.note}`,
    )
    expect(hint()).toBe(fillBlanks(words.colorsHint, { n: '2' }))
    expect(wrapper.get('[data-testid="convert-matched"]').text()).toBe('miyuki delica 11/0')
    await matchTo(wrapper, 'default')
    expect(wrapper.get('[data-testid="convert-matched"]').text()).toBe(words.matchedDefault)
    await matchTo(wrapper, 'exact')
    expect(hint()).toBe(fillBlanks(words.colorsHintExact, { n: '2' }))
    expect(wrapper.get('[data-testid="convert-matched"]').text()).toBe(words.matchedExact)
  })

  it('matches the found colors to the Bead’s colors at first, and heads their table From picture, Becomes, Beads, Change, Empty (tickets 0758, 0863)', async () => {
    const { wrapper } = open({ draft: delica })
    await chooseFile(wrapper, picture())
    await show(wrapper, 'colors')
    await openColorByColor(wrapper)
    const words = en.convertImage.wizard

    expect(wrapper.get('[data-picture-hex~="#e63746"] [data-testid="found-color-source"]').text()).toBe(words.beadColors)
    expect(wrapper.findAll('[data-testid="found-colors-header"] span').map((cell) => cell.text())).toEqual([
      words.fromPicture,
      words.becomes,
      words.beadsColumn,
      words.change,
      words.empty,
    ])
  })

  it('names the bead a found color becomes by its code and name, with its hex in a Tooltip (ticket 0760)', async () => {
    const { wrapper } = open({ draft: delica })
    await chooseFile(wrapper, picture())
    await show(wrapper, 'colors')
    await matchTo(wrapper, 'bead-colors')
    await openColorByColor(wrapper)
    const label = wrapper.get('[data-picture-hex~="#e63746"] [data-testid="found-color-name"]')

    expect(label.get('[data-testid="color-label"]').text()).toBe('DB723 Opaque Red')
    expect(label.get('[role="tooltip"]').text()).toBe('#D02030')
  })

  it('changes a found color with the palette icon, which opens the colour popover’s body: Keep exact, the new Palette, Bead colors (ticket 0758)', async () => {
    const { wrapper } = open({ draft: delica })
    await chooseFile(wrapper, picture())
    await show(wrapper, 'colors')
    await openColorByColor(wrapper)
    const row = wrapper.get('[data-picture-hex~="#e63746"]')
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
    const { wrapper } = open({ draft: delica })
    await chooseFile(wrapper, picture())
    await show(wrapper, 'colors')
    await openColorByColor(wrapper)
    const row = wrapper.get('[data-picture-hex~="#e63746"]')

    await row.get('[data-testid="found-color-remap"]').trigger('click')
    await row.get('[data-testid="bead-colors-toggle"]').trigger('click')

    expect(row.findAll('[data-testid="bead-colors-family"]').map((button) => button.attributes('aria-label'))).toEqual(['Red, 1'])
    expect(row.findAll('[data-testid="bead-colors-finish"]').map((button) => button.attributes('aria-label'))).toEqual(['Opaque, 1'])
  })
})

describe('ConvertImageWizard Create Project', () => {
  it('makes the Project of the picture from the column’s foot, one pixel one bead for a small picture, in the Bead’s colors', async () => {
    const { wrapper } = open({ draft: delica })
    await chooseFile(wrapper, picture())
    await show(wrapper, 'colors')
    await matchTo(wrapper, 'bead-colors')
    await wrapper.get('[data-testid="convert-image-create"]').trigger('click')

    const project = created(wrapper)!
    // A 4 px wide picture goes from 8 beads up to 16 and starts at the least, on the ×2 mark: 8 × 4 beads.
    expect(frameOf(project)).toMatchObject({ columns: 8, rows: 4 })
    expect(frameGrid(project)[0]![0]!.color).toBe('#d02030')
    expect(project.paletteCodes).toEqual({ '#d02030': 'DB723' })
  })

  it('shows the size and the colors over the button', async () => {
    const { wrapper } = open()
    await chooseFile(wrapper, picture())
    expect(wrapper.get('[data-testid="convert-result"]').text()).toContain('8×4 beads')
    expect(wrapper.get('[data-testid="convert-result-colors"]').text()).toBe('2 colors')
  })

  it('leaves a found color set to empty without beads', async () => {
    const { wrapper } = open()
    await chooseFile(wrapper, picture())
    await openColorByColor(wrapper)
    const white = wrapper.findAll('[data-testid="found-color"]').find((row) => row.attributes('data-picture-hex')!.split(' ').includes('#ffffff'))!
    await white.get('[data-testid="found-color-empty"]').trigger('click')
    expect(white.get('[data-testid="found-color-name"]').text()).toBe(en.convertImage.wizard.empty)

    await wrapper.get('[data-testid="convert-image-create"]').trigger('click')
    const grid = frameGrid(created(wrapper)!)
    expect(grid[0]!.at(-1)!.color).toBeNull()
    expect(grid[0]![0]!.color).not.toBeNull()
  })
})

describe('ConvertImageWizard Color by color rows (ticket 0863)', () => {
  it('joins the found colors that become one bead color into one row, its count the popover’s, and Empty takes them all', async () => {
    // Red and white both become the catalog's one code, DB723.
    const { wrapper } = open({ draft: delica })
    await chooseFile(wrapper, picture())
    await openColorByColor(wrapper)
    const rows = () => wrapper.findAll('[data-testid="found-color"]')

    expect(rows()).toHaveLength(1)
    expect(rows()[0]!.attributes('data-picture-hex')).toBe('#e63746 #ffffff')
    expect(rows()[0]!.get('[role="group"]').attributes('aria-label')).toBe('#e63746 and #ffffff to DB723 Opaque Red, 32 beads')
    expect(wrapper.get('[data-testid="convert-found-count"]').text()).toBe('1 color')

    await rows()[0]!.get('[data-testid="found-color-empty"]').trigger('click')
    expect(rows()).toHaveLength(1)
    expect(wrapper.get('[data-testid="convert-found-count"]').text()).toBe('0 colors · 1 empty')
  })
})

describe('ConvertImageWizard popovers (ticket 0896)', () => {
  it('opens a setting’s more in a popover of its button, one at a time, closed by its button, a press outside or Escape, focus back home', async () => {
    const { wrapper } = open()
    await chooseFile(wrapper, picture())
    const more = wrapper.get('[data-testid="convert-size-more"]')
    const popover = (name: string) => wrapper.find(`[data-testid="convert-${name}-popover"]`)

    await more.trigger('click')
    await flushPromises()
    expect(popover('size').exists()).toBe(true)
    expect(more.attributes('aria-expanded')).toBe('true')
    expect(popover('size').element.contains(document.activeElement)).toBe(true)
    await more.trigger('click')
    expect(popover('size').exists()).toBe(false)

    await show(wrapper, 'size')
    await show(wrapper, 'colors')
    expect([popover('size').exists(), popover('colors').exists()]).toEqual([false, true])

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(popover('colors').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('[data-testid="convert-colors-more"]').element)
    // Escape closed the popover, not the page.
    expect(wrapper.emitted('close')).toBeUndefined()

    await show(wrapper, 'bead')
    const outside = document.createElement('button')
    document.body.append(outside)
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
    await flushPromises()
    expect(popover('bead').exists()).toBe(false)
  })

  it('names the Bead and Technique on its button, and opens their pickers', async () => {
    const { wrapper } = open({ draft: delica })
    expect(wrapper.get('[data-testid="convert-bead-button"]').text()).toBe('Miyuki Delica 11/0 · Loom')
    await show(wrapper, 'bead')
    await choosePanelOption(wrapper, 'convert-technique', 'peyote')
    expect(wrapper.get('[data-testid="convert-bead-button"]').text()).toBe('Miyuki Delica 11/0 · Peyote')
  })
})

describe('ConvertImageWizard preview zoom (ticket 0650)', () => {
  const zoomLevel = (wrapper: VueWrapper) => wrapper.get('[data-testid="convert-zoom-level"]').text()
  function press(key: string) {
    const event = new KeyboardEvent('keydown', { key, ctrlKey: true, cancelable: true })
    window.dispatchEvent(event)
    return event
  }

  it('zooms the preview with Ctrl/⌘ + plus, minus and 0, the zoom chip on the bar only while zoomed in (ticket 0896)', async () => {
    const { wrapper } = open()
    await chooseFile(wrapper, picture())
    expect(wrapper.find('[data-testid="convert-zoom-chip"]').exists()).toBe(false)

    expect(press('+').defaultPrevented).toBe(true)
    await flushPromises()
    expect(zoomLevel(wrapper)).toBe('150%')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '=', metaKey: true }))
    await flushPromises()
    expect(zoomLevel(wrapper)).toBe('200%')
    press('-')
    await flushPromises()
    expect(zoomLevel(wrapper)).toBe('150%')
    expect(press('0').defaultPrevented).toBe(true)
    await flushPromises()
    expect(wrapper.find('[data-testid="convert-zoom-chip"]').exists()).toBe(false)

    press('+')
    await flushPromises()
    await wrapper.get('[data-testid="convert-zoom-fit"]').trigger('click')
    expect(wrapper.find('[data-testid="convert-zoom-chip"]').exists()).toBe(false)
  })

  it('names the zoom chip’s buttons as the Canvas strip does, and says why one at its limit is off', async () => {
    const { wrapper } = open()
    await chooseFile(wrapper, picture())
    press('+')
    await flushPromises()
    expect(wrapper.get('[data-testid="convert-zoom-out"]').attributes('aria-label')).toBe(en.canvas.zoomOutLabel)
    const zoomIn = wrapper.get('[data-testid="convert-zoom-in"]')
    expect(zoomIn.attributes('aria-label')).toBe(en.canvas.zoomInLabel)

    // Five more presses climb the preview's seven zoom stops to the top.
    for (let step = 0; step < 5; step += 1) press('+')
    await flushPromises()
    expect(zoomIn.attributes('aria-disabled')).toBe('true')
    const trigger = new DOMWrapper(zoomIn.element.closest('.app-tooltip')!)
    await trigger.trigger('pointerenter', { pointerType: 'mouse' })
    expect(trigger.get('.app-tooltip__body').text()).toBe(en.tooltips.zoomInLimit)
  })

  it('leaves the keys alone once the page is gone', async () => {
    const { wrapper } = open()
    await chooseFile(wrapper, picture())
    wrapper.unmount()
    expect(press('+').defaultPrevented).toBe(false)
  })
})

describe('ConvertImageWizard the floating bar (tickets 0780, 0896)', () => {
  const tool = (wrapper: VueWrapper, name: string) => wrapper.get(`[data-testid="convert-tool-${name}"]`)
  const box = (wrapper: VueWrapper) => wrapper.get('[data-testid="convert-image-box"]')
  const chip = (wrapper: VueWrapper) => wrapper.find('[data-testid="convert-chip"]')
  afterEach(() => vi.useRealTimers())

  it('holds Background, Make empty and Compare, named from the registry, once a picture is set: no Select, Undo or Redo', async () => {
    const { wrapper } = open()
    expect(wrapper.find('[data-testid="convert-preview-tools"]').exists()).toBe(false)
    await chooseFile(wrapper, picture())

    const bar = wrapper.get('[data-testid="convert-preview-tools"]')
    const words = en.convertImage.wizard
    expect(bar.findAll('button').map((button) => button.text())).toEqual([words.backgroundTool, words.makeEmpty, words.compare])
    for (const gone of ['convert-tool-select', 'convert-undo', 'convert-redo', 'convert-turn', 'convert-flip']) expect(bar.find(`[data-testid="${gone}"]`).exists(), gone).toBe(false)
  })

  it('turns the picture and flips it from More for the picture beside its name', async () => {
    const { wrapper, wizard } = open()
    await chooseFile(wrapper, picture())
    await wrapper.get('[data-testid="convert-picture-more"]').trigger('click')
    await wrapper.get('[data-testid="convert-turn"]').trigger('click')
    expect([wizard.image.value!.width, wizard.image.value!.height]).toEqual([2, 4])
    await wrapper.get('[data-testid="convert-picture-more"]').trigger('click')
    expect(wrapper.get('[data-testid="convert-flip"]').text()).toBe(en.convertImage.wizard.flipLeftRight)
  })

  it('makes a color empty with Make empty’s tap, and brings it back with a tap on its empty place, in step with Color by color', async () => {
    const { wrapper, wizard } = open()
    await chooseFile(wrapper, picture())
    expect(box(wrapper).attributes('style')).not.toContain('cursor')
    await tool(wrapper, 'make-empty').trigger('click')

    expect(tool(wrapper, 'make-empty').attributes('aria-pressed')).toBe('true')
    expect(box(wrapper).attributes('style')).toContain('cursor: url(')
    expect(chip(wrapper).text()).toBe(en.convertImage.wizard.bandMakeEmpty)
    wizard.toggleEmptyAtBead(0)
    await flushPromises()
    expect(wizard.emptyColorCount.value).toBe(1)
    await openColorByColor(wrapper)
    const red = wrapper.findAll('[data-testid="found-color"]').find((row) => row.attributes('data-picture-hex')!.split(' ').includes('#e63746'))!
    expect(red.get('[data-testid="found-color-name"]').text()).toBe(en.convertImage.wizard.empty)

    wizard.toggleEmptyAtBead(0)
    await flushPromises()
    expect(wizard.emptyColorCount.value).toBe(0)
    // Pressed again, the tool is off.
    await tool(wrapper, 'make-empty').trigger('click')
    expect(tool(wrapper, 'make-empty').attributes('aria-pressed')).toBe('false')
  })

  it('opens Background’s popover with its tool in one press, and takes its steps back with the popover’s Undo, Redo and Start over (ticket 0787)', async () => {
    const { wrapper, wizard } = open()
    await chooseFile(wrapper, picture())
    const found = () => wrapper.get('[data-testid="convert-background-found"]').text()

    await tool(wrapper, 'background').trigger('click')
    await flushPromises()
    expect(tool(wrapper, 'background').attributes('aria-pressed')).toBe('true')
    expect(wizard.background.value).toBe('find')
    const popover = wrapper.get('[data-testid="convert-background-popover"]')
    expect(popover.get('[data-testid="convert-background-tool-line"]').text()).toBe(en.convertImage.wizard.bandBackground)
    expect(wrapper.find('[data-testid="convert-reset-marks"]').exists()).toBe(false)
    expect(found()).toBe('found · 100% of the picture')

    // Both halves touch the edge, so all is found; a step on the white half keeps it.
    const at = wizard.lattice.value!
    wizard.beginMark((at.frameRow + 1) * at.columns + at.frameColumn + 3)
    wizard.endMark()
    await flushPromises()
    expect(found()).toBe('found · 50% of the picture')
    expect(popover.get('[data-testid="convert-redo"]').attributes('aria-disabled')).toBe('true')
    await popover.get('[data-testid="convert-undo"]').trigger('click')
    expect(found()).toBe('found · 100% of the picture')
    await popover.get('[data-testid="convert-redo"]').trigger('click')
    expect(found()).toBe('found · 50% of the picture')
    await wrapper.get('[data-testid="convert-reset-marks"]').trigger('click')
    expect(found()).toBe('found · 100% of the picture')
    await popover.get('[data-testid="convert-undo"]').trigger('click')
    expect(found()).toBe('found · 50% of the picture')

    // Closing the popover turns the tool off and keeps what was decided.
    await tool(wrapper, 'background').trigger('click')
    expect(tool(wrapper, 'background').attributes('aria-pressed')).toBe('false')
    expect(wrapper.find('[data-testid="convert-background-popover"]').exists()).toBe(false)
    expect(wizard.background.value).toBe('find')
  })

  it('shows the picture in the beads’ place while Compare is held past 300 ms, with its chip, and leaves Compare as it was', async () => {
    const { wrapper } = open()
    await chooseFile(wrapper, picture())
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const compare = wrapper.get('[data-testid="convert-compare"]')
    const canvas = () => wrapper.get('[data-testid="convert-image-canvas"]')

    await compare.trigger('pointerdown', { button: 0 })
    vi.advanceTimersByTime(300)
    await flushPromises()
    expect(canvas().attributes('data-comparing')).toBe('true')
    expect(canvas().attributes('aria-label')).toBe(en.convertImage.wizard.comparePictureName)
    expect(chip(wrapper).text()).toBe('picture · let go to see the beads')
    await compare.trigger('pointerup')
    await compare.trigger('click')
    expect(canvas().attributes('data-comparing')).toBeUndefined()
    expect(chip(wrapper).exists()).toBe(false)
    expect(compare.attributes('aria-pressed')).toBe('false')
  })
})

describe('ConvertImageWizard Compare, the picture beside the beads (ticket 0909)', () => {
  const chips = (wrapper: VueWrapper) => wrapper.findAll('[data-testid="convert-chip"]').map((chip) => [chip.attributes('data-half'), chip.text()])
  const halves = (wrapper: VueWrapper) => wrapper.findAll('[data-testid^="convert-half-"]').map((half) => half.attributes('data-testid'))
  const realMatchMedia = window.matchMedia
  afterEach(() => {
    window.matchMedia = realMatchMedia
    vi.useRealTimers()
  })

  it('puts the picture beside the beads on a press, named together, the crop’s handles on the picture, until pressed again', async () => {
    const { wrapper } = open()
    await chooseFile(wrapper, picture())
    const compare = wrapper.get('[data-testid="convert-compare"]')
    expect(halves(wrapper)).toEqual(['convert-half-beads'])

    await compare.trigger('click')
    expect(compare.attributes('aria-pressed')).toBe('true')
    expect(halves(wrapper)).toEqual(['convert-half-picture', 'convert-half-beads'])
    expect(chips(wrapper)).toEqual([['picture', 'picture'], ['beads', 'beads']])
    expect(wrapper.get('[data-testid="convert-image-canvas"]').attributes('aria-label')).toBe('The picture and the beads side by side: 8×4 beads, 2 colors')
    const pictureHalf = wrapper.get('[data-testid="convert-half-picture"]')
    expect(pictureHalf.find('[data-testid="convert-crop-topLeft"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="convert-half-beads"]').find('[data-testid="convert-crop-topLeft"]').exists()).toBe(false)
    // The column's result lines do not change with Compare.
    expect(wrapper.get('[data-testid="convert-result"]').text()).toContain('8×4 beads')

    await compare.trigger('click')
    expect(compare.attributes('aria-pressed')).toBe('false')
    expect(halves(wrapper)).toEqual(['convert-half-beads'])
    expect(chips(wrapper)).toEqual([])
  })

  it('reaches Compare’s action from the keys', async () => {
    const { wrapper } = open()
    await chooseFile(wrapper, picture())
    const compare = wrapper.get('[data-testid="convert-compare"]')
    await compare.trigger('keydown', { key: 'Enter' })
    await compare.trigger('keyup', { key: 'Enter' })
    expect(compare.attributes('aria-pressed')).toBe('true')
  })

  it('under 1024 px holds Background and Make empty as icons and Beads | Picture, a tap on Picture staying', async () => {
    const media = fakeMatchMedia({ [NARROW_CONVERTER]: true })
    window.matchMedia = media.matchMedia
    const { wrapper } = open()
    await chooseFile(wrapper, picture())
    const bar = wrapper.get('[data-testid="convert-preview-tools"]')
    expect(bar.find('[data-testid="convert-compare"]').exists()).toBe(false)
    expect(bar.get('[data-testid="convert-tool-make-empty"]').attributes('aria-label')).toBe(en.convertImage.wizard.makeEmpty)
    expect(bar.get('[data-testid="convert-tool-make-empty"]').text()).toBe('')
    const show = bar.get('[data-testid="convert-show"]')
    expect(show.attributes('aria-label')).toBe('Show')
    const choice = (value: string) => show.get(`[role="radio"][data-value="${value}"]`)
    expect([choice('beads').text(), choice('beads').attributes('aria-checked')]).toEqual(['Beads', 'true'])

    await choice('picture').trigger('click')
    expect(choice('picture').attributes('aria-checked')).toBe('true')
    expect(chips(wrapper)).toEqual([['beads', 'picture']])
    expect(wrapper.get('[data-testid="convert-image-canvas"]').attributes('aria-label')).toBe(en.convertImage.wizard.comparePictureName)
    await choice('beads').trigger('click')
    expect(chips(wrapper)).toEqual([])

    // A page that widens while Picture is chosen shows the beads alone.
    await choice('picture').trigger('click')
    media.set(NARROW_CONVERTER, false)
    await flushPromises()
    expect(halves(wrapper)).toEqual(['convert-half-beads'])
    expect(wrapper.get('[data-testid="convert-compare"]').attributes('aria-pressed')).toBe('false')
  })

  it('under 1024 px shows the picture only while Picture is held, Beads staying chosen', async () => {
    window.matchMedia = fakeMatchMedia({ [NARROW_CONVERTER]: true }).matchMedia
    const { wrapper } = open()
    await chooseFile(wrapper, picture())
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const picture_ = wrapper.get('[data-testid="convert-show"] [data-value="picture"]')
    await picture_.trigger('pointerdown', { button: 0 })
    vi.advanceTimersByTime(300)
    await flushPromises()
    expect(chips(wrapper)).toEqual([['beads', 'picture · let go to see the beads']])
    await picture_.trigger('pointerup')
    await picture_.trigger('click')
    expect(chips(wrapper)).toEqual([])
    expect(picture_.attributes('aria-checked')).toBe('false')
  })
})

describe('ConvertImageWizard the crop on the picture (ticket 0898)', () => {
  /** An 80 × 40 picture, red left and white right: one pixel one bead at Width 80, 80 × 40 beads. */
  const eightyWide = async (): Promise<PixelData> => {
    const data: number[] = []
    for (let y = 0; y < 40; y += 1) for (let x = 0; x < 80; x += 1) data.push(...(x < 40 ? [230, 55, 70, 255] : [255, 255, 255, 255]))
    return { width: 80, height: 40, data: new Uint8ClampedArray(data) }
  }
  const handle = (wrapper: VueWrapper, name: string) => wrapper.get(`[data-testid="convert-crop-${name}"]`)

  it('stands its eight named handles on the whole picture, before the Bead and Technique, with no line round it', async () => {
    const { wrapper } = open({ decodeImage: eightyWide })
    expect(wrapper.find('[data-testid="convert-crop-topLeft"]').exists()).toBe(false)
    await chooseFile(wrapper, picture())

    const handles = wrapper.findAll('[data-testid^="convert-crop-"]').filter((found) => found.element.tagName === 'BUTTON')
    expect(handles.map((found) => found.attributes('aria-label'))).toEqual([
      'Crop: top-left corner', 'Crop: top edge', 'Crop: top-right corner', 'Crop: right edge',
      'Crop: bottom-right corner', 'Crop: bottom edge', 'Crop: bottom-left corner', 'Crop: left edge',
    ])
    const bead = wrapper.get('[data-testid="convert-bead-button"]').element
    expect(handles[0]!.element.compareDocumentPosition(bead) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(wrapper.find('[data-testid="convert-crop-line"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="convert-kept"]').exists()).toBe(false)
  })

  it('moves a focused handle a bead per arrow and ten with Shift, keeping only the beads inside, the result reading the part', async () => {
    const { wrapper, wizard } = open({ decodeImage: eightyWide })
    await chooseFile(wrapper, picture())
    wizard.setWidth(80)
    await flushPromises()
    await handle(wrapper, 'bottomRight').trigger('keydown', { key: 'ArrowLeft', shiftKey: true })
    await handle(wrapper, 'bottomRight').trigger('keydown', { key: 'ArrowUp' })

    expect(wrapper.find('[data-testid="convert-crop-line"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="convert-kept"]').text()).toContain('keeping 70×39')
    expect(wrapper.get('[data-testid="convert-result"]').text()).toContain('70×39 beads')
    expect(wrapper.get('[data-testid="convert-result-colors"]').text()).toContain('kept from 80×40')
    expect(sliderValue(wrapper, 'convert-width')).toBe(70)
  })

  it('puts the whole picture back at the Width it had with Keep all', async () => {
    const { wrapper, wizard } = open({ decodeImage: eightyWide })
    await chooseFile(wrapper, picture())
    wizard.setWidth(80)
    await flushPromises()
    await handle(wrapper, 'left').trigger('keydown', { key: 'ArrowRight', shiftKey: true })
    await slide(wrapper, 'convert-width', 35)
    expect(wizard.dimensions.value.columns).toBe(35)

    await wrapper.get('[data-testid="convert-keep-all"]').trigger('click')
    expect(wizard.dimensions.value).toEqual({ columns: 80, rows: 40 })
    expect(wrapper.find('[data-testid="convert-kept"]').exists()).toBe(false)
  })

  it('hides the handles while Make empty is on', async () => {
    const { wrapper } = open({ decodeImage: eightyWide })
    await chooseFile(wrapper, picture())
    await wrapper.get('[data-testid="convert-tool-make-empty"]').trigger('click')
    expect(wrapper.find('[data-testid="convert-crop-topLeft"]').exists()).toBe(false)
  })
})

describe('ConvertImageWizard Background (ticket 0780)', () => {
  /** A 6 × 6 picture: a white wall round a red square. */
  const onAWall = async (): Promise<PixelData> => {
    const data: number[] = []
    for (let y = 0; y < 6; y += 1) for (let x = 0; x < 6; x += 1) data.push(...(x > 1 && x < 4 && y > 1 && y < 4 ? [230, 55, 70, 255] : [255, 255, 255, 255]))
    return { width: 6, height: 6, data: new Uint8ClampedArray(data) }
  }

  it('finds the background first, hatched and counted, removes it only on Remove what was found, and puts it back when turned off', async () => {
    const { wrapper, wizard } = open({ decodeImage: onAWall })
    await chooseFile(wrapper, picture())
    // On the ×4 mark, each pixel whole beads.
    wizard.setWidth(24)
    await wrapper.get('[data-testid="convert-tool-background"]').trigger('click')
    await wrapper.get('[data-testid="convert-remove-background"]').trigger('click')
    expect(wizard.background.value).toBe('off')
    // What the switch does is behind its Info button, not a line under it (ticket 0894).
    expect(infoBody(wrapper, 'convert-remove-background-info')).toBe(en.convertImage.wizard.removeBackgroundOff)
    const colorsBefore = wizard.usedColorCount.value

    await wrapper.get('[data-testid="convert-remove-background"]').trigger('click')
    // The wall is 32 of the 36 pixels, so 89% of the beads, however many beads a pixel makes.
    expect(wrapper.get('[data-testid="convert-background-found"]').text()).toBe('found · 89% of the picture')
    expect(wizard.usedColorCount.value).toBe(colorsBefore)
    // The stage in hand is a plain numbered line, not a pair of chips (ticket 0863).
    expect(wrapper.get('[data-testid="convert-background-stages"]').text()).toBe(en.convertImage.wizard.stageFind)

    await wrapper.get('[data-testid="convert-remove-found"]').trigger('click')
    expect(wrapper.get('[data-testid="convert-background-stages"]').text()).toBe(en.convertImage.wizard.stageRemove)
    expect(wrapper.get('[data-testid="convert-background-removed"]').text()).toContain('beads left out')
    expect(wizard.usedColorCount.value).toBe(1)
    await wrapper.get('[data-testid="convert-image-create"]').trigger('click')
    const removed = frameGrid(created(wrapper)!)
    expect(removed[0]![0]!.color).toBeNull()
    expect(removed[removed.length / 2]![removed[0]!.length / 2]!.color).not.toBeNull()
  })

  it('says what Tolerance does behind an info button beside its name, its ends in full words (tickets 0817, 0863)', async () => {
    const { wrapper } = open({ decodeImage: onAWall })
    await chooseFile(wrapper, picture())
    await wrapper.get('[data-testid="convert-tool-background"]').trigger('click')
    expect(wrapper.get('[data-testid="convert-tolerance-info"]').attributes('aria-label')).toBe(en.convertImage.wizard.toleranceInfoLabel)
    expect(wrapper.get('[data-testid="convert-tolerance"] .vs-ends').text()).toBe(`${en.convertImage.wizard.toleranceMin}${en.convertImage.wizard.toleranceMax}`)
  })
})

describe('ConvertImageWizard Width, Size and Colors (tickets 0747, 0896)', () => {
  it('sizes with the Width slider on a doubling scale, read in both units, the height following', async () => {
    const { wrapper } = open()
    await chooseFile(wrapper, picture())
    const range = wrapper.get('[data-testid="convert-width-range"]')

    // A 4 px wide picture goes from 8 to 16 beads and starts at the least, the ×2 mark; a cube bead is 1.5 mm.
    expect([sliderRange(wrapper, 'convert-width'), sliderValue(wrapper, 'convert-width')]).toEqual([{ min: 8, max: 16 }, 8])
    expect(wrapper.get('[data-testid="convert-width-value"]').text()).toBe('8 beads · 12 mm')
    expect(range.attributes('aria-valuetext')).toBe('8 beads, 12 mm, 1 px of your picture = 2 × 2 beads')
    expect(wrapper.findAll('[data-testid="convert-width-mark"]').map((mark) => mark.attributes('data-value'))).toEqual(['8', '16'])
    expect(wrapper.get('[data-testid="convert-width"] .vs-ends').text()).toBe('8max 16')
    expect(wrapper.get('[data-testid="convert-result"]').text()).toContain('8×4 beads')

    await slide(wrapper, 'convert-width', 12)
    expect(sliderValue(wrapper, 'convert-width')).toBe(12)
    expect(wrapper.get('[data-testid="convert-result"]').text()).toContain('12×6 beads')
    expect(range.attributes('aria-valuetext')).toBe('12 beads, 18 mm')
    await range.trigger('keydown', { key: 'ArrowRight' })
    expect(sliderValue(wrapper, 'convert-width')).toBe(13)

    await show(wrapper, 'size')
    expect(infoBody(wrapper, 'convert-width-info')).toBe(en.convertImage.wizard.widthHint)
    expect(wrapper.get('[data-testid="convert-size-ratio"]').text()).toMatch(/^About [\d.]+ × [\d.]+ px of your picture = 1 bead$/)
    await wrapper.get('[data-testid="convert-size-unit"] [data-value="mm"]').trigger('click')
    expect(wrapper.get('[data-testid="convert-width-value"]').text()).toBe('20 mm · 13 beads')
  })

  it('joins Width with the Size popover’s Height and Keep the picture’s shape: on they move together, off each stretches the picture (tickets 0757, 0780)', async () => {
    const wide = async (): Promise<PixelData> => ({ width: 40, height: 20, data: new Uint8ClampedArray(40 * 20 * 4).fill(200) })
    const { wrapper } = open({ decodeImage: wide })
    await chooseFile(wrapper, picture())
    await show(wrapper, 'size')
    const keepShape = wrapper.get('[data-testid="convert-keep-shape"]')
    const line = () => infoBody(wrapper, 'convert-keep-shape-info')

    // Opens one bead per pixel, under 60 beads wide (ticket 0863): 40 px goes up to 160 beads. Height has its own range
    // over the picture's 20 px.
    expect([sliderRange(wrapper, 'convert-width').max, sliderValue(wrapper, 'convert-width')]).toEqual([160, 40])
    expect([sliderRange(wrapper, 'convert-height'), sliderValue(wrapper, 'convert-height')]).toEqual([{ min: 8, max: 80 }, 20])
    expect(keepShape.attributes('aria-checked')).toBe('true')
    expect(line()).toBe(en.convertImage.wizard.keepShapeOn)

    await slide(wrapper, 'convert-height', 40)
    expect(sliderValue(wrapper, 'convert-width')).toBe(80)

    await keepShape.trigger('click')
    expect(line()).toBe(en.convertImage.wizard.keepShapeOff)
    await slide(wrapper, 'convert-height', 20)
    expect([sliderValue(wrapper, 'convert-width'), sliderValue(wrapper, 'convert-height')]).toEqual([80, 20])
    expect(wrapper.get('[data-testid="convert-result"]').text()).toContain('80×20 beads')
  })

  it('offers a Colors slider up to every color the picture has, Color by color one press away', async () => {
    const { wrapper } = open()
    await chooseFile(wrapper, picture())
    // Red and white: two colors, so the slider starts at its max of 2.
    expect([sliderRange(wrapper, 'convert-colors-slider').max, sliderValue(wrapper, 'convert-colors-slider')]).toEqual([2, 2])
    expect(wrapper.get('[data-testid="convert-colors-slider-value"]').text()).toBe('2 colors')
    expect(wrapper.get('[data-testid="convert-colors-slider"] .vs-ends').text()).toBe('1max 2')

    await slide(wrapper, 'convert-colors-slider', 1)
    expect(wrapper.get('[data-testid="convert-result-colors"]').text()).toBe('1 color')
    await slide(wrapper, 'convert-colors-slider', 2)
    await openColorByColor(wrapper)
    expect(wrapper.findAll('[data-testid="found-color"]')).toHaveLength(2)
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

describe('ConvertImageWizard My beads (ticket 0902)', () => {
  const words = en.convertImage.wizard.myBeads
  /** Delica's catalog with a second code, so a list of one is shorter than the picture's two colors. */
  const twoCodes: ColorCatalog = {
    id: 'miyuki-delica',
    codes: [...catalog.codes, { code: 'DB200', family: ['White'], finish: 'opaque', wording: 'Opaque', sizes: ['11/0'], hex: '#ffffff' }],
  }
  async function opened() {
    const opening = open({ draft: delica, loadCatalog: async () => twoCodes })
    await chooseFile(opening.wrapper, picture())
    await show(opening.wrapper, 'colors')
    return opening
  }
  async function editMyBeads(wrapper: VueWrapper) {
    await sourceItems(wrapper)
    await wrapper.get('[data-testid="convert-edit-my-beads"]').trigger('click')
    await flushPromises()
  }
  const row = (wrapper: VueWrapper, code: string) => wrapper.get(`[data-testid="convert-my-beads-row"][data-code="${code}"]`)

  it('offers no My beads with an empty list, and Choose My beads opens the view with its empty state', async () => {
    const { wrapper } = await opened()
    expect((await sourceItems(wrapper)).map((option) => option.attributes('data-value'))).not.toContain('my-beads')
    expect(wrapper.get('[data-testid="convert-edit-my-beads"]').text()).toBe(`${words.choose}${words.noCodes}`)

    await editMyBeads(wrapper)
    expect(wrapper.get('[data-testid="convert-my-beads-empty"]').text()).toBe(words.empty)
    expect(wrapper.get('[data-testid="convert-my-beads-count"]').text()).toBe(words.noCodes)
    expect(wrapper.text()).toContain('color catalog · miyuki delica')
    expect(document.activeElement).toBe(wrapper.get('[data-testid="convert-my-beads-back"]').element)
  })

  it('ticks a code with a press on its row, which then names it as in My beads, and offers My beads with its count', async () => {
    const { wrapper } = await opened()
    await editMyBeads(wrapper)
    await row(wrapper, 'DB723').trigger('click')

    expect(row(wrapper, 'DB723').attributes('aria-pressed')).toBe('true')
    expect(row(wrapper, 'DB723').attributes('aria-label')).toBe('DB723 red opaque, in My beads')
    expect(row(wrapper, 'DB200').attributes('aria-pressed')).toBe('false')
    expect(wrapper.get('[data-testid="convert-my-beads-count"]').text()).toBe('1 code')

    await wrapper.get('[data-testid="convert-my-beads-back"]').trigger('click')
    await flushPromises()
    const item = (await sourceItems(wrapper)).find((option) => option.attributes('data-value') === 'my-beads')
    expect(item?.text()).toBe(`${words.name}1`)
    expect(wrapper.get('[data-testid="convert-edit-my-beads"]').text()).toBe(`${words.edit}1 code`)
  })

  it('returns to the Colors view on Back and on Escape, focus on match to', async () => {
    const { wrapper } = await opened()
    await editMyBeads(wrapper)
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()

    expect(wrapper.find('[data-testid="convert-my-beads"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="convert-colors-popover"]').exists()).toBe(true)
    expect(document.activeElement).toBe(wrapper.get('[data-testid="convert-color-source"]').element)
  })

  it('matches to the list once chosen: the button, the count line, the line under Colors and the foot say so', async () => {
    const { wrapper } = await opened()
    await editMyBeads(wrapper)
    await row(wrapper, 'DB723').trigger('click')
    await wrapper.get('[data-testid="convert-my-beads-back"]').trigger('click')
    await flushPromises()
    await matchTo(wrapper, 'my-beads')

    expect(wrapper.get('[data-testid="convert-color-source"]').text()).toBe(words.name)
    expect(wrapper.get('[data-testid="convert-codes"]').text()).toBe('codes in my beads: 1')
    expect(wrapper.get('[data-testid="convert-matched"]').text()).toBe('my beads · 1 code')
    expect(wrapper.get('[data-testid="convert-result-colors"]').text()).toBe('1 color (your list has 1)')
    expect(wrapper.findAll('[data-testid="found-color"]')).toHaveLength(1)
    expect(infoBody(wrapper, 'convert-color-source-info')).toContain('My beads: only the codes you ticked as yours, and only those made in 11/0.')
  })

  it('adds the clipboard’s codes on ⌘V anywhere in the view, and empties the list on Clear list (ticket 0903)', async () => {
    const { wrapper } = await opened()
    await editMyBeads(wrapper)
    const paste = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(paste, 'clipboardData', { value: { getData: () => 'DB723, DB200', files: [] } })
    wrapper.get('[data-testid="convert-my-beads-back"]').element.dispatchEvent(paste)
    await flushPromises()
    expect(wrapper.get('[data-testid="convert-my-beads-count"]').text()).toBe('2 codes')

    await wrapper.get('[data-testid="my-beads-clear"]').trigger('click')
    await wrapper.get('[data-testid="my-beads-clear-confirm"]').trigger('click')
    expect(wrapper.get('[data-testid="convert-my-beads-count"]').text()).toBe(words.noCodes)
  })
})

describe('ConvertImageWizard the match kept to chosen Finishes (ticket 0901)', () => {
  const words = en.convertImage.wizard.finish
  /** Delica's catalog with a matte and a plated code beside the opaque red. */
  const finishes: ColorCatalog = {
    id: 'miyuki-delica',
    codes: [
      ...catalog.codes,
      { code: 'DB200', family: ['White'], finish: 'opaque', wording: 'Opaque', sizes: ['11/0'], hex: '#ffffff' },
      { code: 'DB351', family: ['White'], finish: 'matte', wording: 'Matte', sizes: ['11/0'], hex: '#f4f4f0' },
      { code: 'DB378', family: ['Red'], finish: 'matte', wording: 'Matte', sizes: ['11/0'], hex: '#d02838' },
      { code: 'DB34', family: ['Gold'], finish: 'plated', wording: 'Plated', sizes: ['11/0'], hex: '#c8a040' },
    ],
  }
  async function opened() {
    const opening = open({ draft: delica, loadCatalog: async () => finishes })
    await chooseFile(opening.wrapper, picture())
    await show(opening.wrapper, 'colors')
    return opening
  }
  async function openFinish(wrapper: VueWrapper) {
    const button = wrapper.get('[data-testid="convert-finish"]')
    if (button.attributes('aria-expanded') !== 'true') await button.trigger('click')
    await flushPromises()
  }
  const finishLine = (wrapper: VueWrapper, finish: string) => wrapper.get(`[data-testid="convert-finish-list"] [data-testid="bead-colors-finish"][data-value="${finish}"]`)
  const codesUsed = (wrapper: VueWrapper) => wrapper.findAll('[data-testid="found-color-name"]').map((name) => name.text())

  it('lists the Bead’s Finishes with their counts in the Palette popover’s own filter, and keeps the match to those ticked', async () => {
    const { wrapper } = await opened()
    await openFinish(wrapper)
    const list = wrapper.get('[data-testid="convert-finish-list"]')
    expect(list.findAll('[data-testid="bead-colors-finish"]').map((line) => line.attributes('aria-label'))).toEqual(['Opaque, 2', 'Matte, 2', 'Plated, 1'])
    expect(list.find('[data-testid="bead-colors-family"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="convert-codes"]').text()).toBe('codes in 11/0: 5')

    await finishLine(wrapper, 'matte').trigger('click')
    await flushPromises()
    expect(finishLine(wrapper, 'matte').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="convert-codes"]').text()).toBe('codes in 11/0: 2')
    expect(wrapper.get('[data-testid="convert-finish-codes"]').text()).toBe('codes in 11/0: 2')
    expect(codesUsed(wrapper).every((name) => name.startsWith('DB378') || name.startsWith('DB351'))).toBe(true)
    expect(wrapper.get('[data-testid="convert-finish"]').attributes('aria-label')).toBe('Finish, 1 on')
    expect(wrapper.get('[data-testid="convert-finish-badge"]').text()).toBe('1')

    await finishLine(wrapper, 'opaque').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="convert-matched"]').text()).toBe('miyuki delica 11/0 · opaque, matte')

    await wrapper.get('[data-testid="convert-finish-list"] [data-testid="bead-colors-filters-clear"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="convert-codes"]').text()).toBe('codes in 11/0: 5')
    expect(wrapper.find('[data-testid="convert-finish-badge"]').exists()).toBe(false)
  })

  it('says when too few codes are left, in the head and in the foot', async () => {
    const { wrapper } = await opened()
    await openFinish(wrapper)
    await finishLine(wrapper, 'plated').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="convert-too-few"]').text()).toBe('Only 1 code left: 1 color, not 2.')
    expect(wrapper.get('[data-testid="convert-result-colors"]').text()).toBe('1 color (only 1 code left)')
    expect(wrapper.get('[data-testid="convert-matched"]').text()).toBe('miyuki delica 11/0 · plated')
  })

  it('is off under Default Palette and Exact, saying why, and brings its Finishes back with the Bead’s palette', async () => {
    const { wrapper } = await opened()
    await openFinish(wrapper)
    await finishLine(wrapper, 'matte').trigger('click')
    await flushPromises()

    await matchTo(wrapper, 'default')
    await flushPromises()
    expect(isOff(wrapper, 'convert-finish')).toBe(true)
    expect(wrapper.findComponent({ name: 'ConvertFinishFilter' }).findComponent({ name: 'AppButton' }).props('disabledBody')).toBe(words.offDefault)
    await matchTo(wrapper, 'exact')
    await flushPromises()
    expect(wrapper.findComponent({ name: 'ConvertFinishFilter' }).findComponent({ name: 'AppButton' }).props('disabledBody')).toBe(words.offExact)

    await matchTo(wrapper, 'bead-colors')
    await flushPromises()
    expect(isOff(wrapper, 'convert-finish')).toBe(false)
    expect(wrapper.get('[data-testid="convert-matched"]').text()).toBe('miyuki delica 11/0 · matte')
  })

  it('opens Color by color’s Change picker on the converter’s Finishes, its Filters counting them', async () => {
    const { wrapper } = await opened()
    await openFinish(wrapper)
    await finishLine(wrapper, 'matte').trigger('click')
    await finishLine(wrapper, 'opaque').trigger('click')
    await flushPromises()
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()

    const row = wrapper.findAll('[data-testid="found-color"]')[0]!
    await row.get('[data-testid="found-color-remap"]').trigger('click')
    await row.get('[data-testid="bead-colors-toggle"]').trigger('click')
    expect(row.get('[data-testid="bead-colors-filters-badge"]').text()).toBe('2')
    expect(row.findAll('[data-testid="bead-colors-finish"][aria-pressed="true"]').map((line) => line.attributes('data-value'))).toEqual(['opaque', 'matte'])
  })
})
