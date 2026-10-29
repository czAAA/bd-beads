import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ConvertImageWizard from './ConvertImageWizard.vue'
import type { ColorCatalog } from '../../domain/colorCatalog'
import type { CreateProjectInput } from '../../domain/createProject'
import { ImageConversionError, formatImageLimits, type PixelData } from '../../domain/imageConversion'
import type { Project } from '../../domain/project'
import { frameGrid } from '../../testUtils/frameGrid'
import { choosePanelOption } from '../../testUtils/choosePanelOption'
import { en } from '../../i18n/en'
import { frameOf } from '../../domain/layerRecord'
import { flatView } from '../../testUtils/flatFields'

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

function open(options: { draft?: CreateProjectInput; file?: File; decodeImage?: () => Promise<PixelData>; clipboard?: File } = {}) {
  const decodeImage = vi.fn(options.decodeImage ?? (async () => redAndWhite()))
  const draft = options.draft ?? cube
  const wrapper = mount(ConvertImageWizard, {
    props: {
      start: { draft, ...(options.file ? { file: options.file } : {}) },
      decodeImage,
      loadCatalog: async () => catalog,
      readClipboardImage: async () => options.clipboard,
    },
    attachTo: document.body,
  })
  return { wrapper, decodeImage, draft }
}

async function chooseFile(wrapper: VueWrapper, file: File, testid = 'convert-choose-file') {
  const input = wrapper.get(`[data-testid="${testid}"]`)
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
  await flushPromises()
}

const sectionDisabled = (wrapper: VueWrapper, step: string) => wrapper.get(`[data-testid="convert-section-${step}"]`).attributes('aria-disabled') === 'true'
const created = (wrapper: VueWrapper) => wrapper.emitted('create')?.[0]?.[0] as Project | undefined

describe('ConvertImageWizard before a picture is set', () => {
  it('disables every section after Picture, saying where to start, and has nothing to create', () => {
    const { wrapper } = open()

    expect(sectionDisabled(wrapper, 'picture')).toBe(false)
    for (const step of ['bead', 'size', 'colors', 'review']) {
      expect(sectionDisabled(wrapper, step)).toBe(true)
      expect(wrapper.get(`[data-testid="convert-section-${step}-summary"]`).text()).toBe(en.convertImage.wizard.addPictureFirst)
    }
    expect(wrapper.get('[data-testid="convert-footer-line"]').text()).toBe(en.convertImage.wizard.noPicture)
    expect(wrapper.get('[data-testid="convert-image-create"]').attributes('aria-disabled')).toBe('true')
  })

  it('lists every way in and the limits in the Note, until the first picture', async () => {
    const { wrapper } = open()
    expect(wrapper.get('[data-testid="convert-picture-note"]').text()).toBe(formatImageLimits(en.convertImage.wizard.pictureNote))

    await chooseFile(wrapper, picture())

    expect(wrapper.find('[data-testid="convert-picture-note"]').exists()).toBe(false)
    expect(sectionDisabled(wrapper, 'size')).toBe(false)
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

  it('takes a picture dropped on the popup', async () => {
    const { wrapper } = open()
    await wrapper.get('.convert-wizard').trigger('drop', { dataTransfer: { files: [picture('dropped.png')], types: ['Files'] } })
    await flushPromises()

    expect(wrapper.get('[data-testid="convert-file-name"]').text()).toBe('dropped.png')
  })

  it('takes a picture from Paste, and says so when the clipboard holds none', async () => {
    const empty = open()
    await empty.wrapper.get('[data-testid="convert-paste"]').trigger('click')
    await flushPromises()
    expect(empty.wrapper.get('[data-testid="convert-nothing-to-paste"]').text()).toBe(en.convertImage.wizard.nothingToPaste)
    empty.wrapper.unmount()

    const { wrapper } = open({ clipboard: picture('clipboard.png') })
    await wrapper.get('[data-testid="convert-paste"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="convert-file-name"]').text()).toBe('clipboard.png')
  })

  it('takes a picture pasted with Ctrl+V anywhere in the popup', async () => {
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
      await wrapper.get('.convert-wizard').trigger('drop', { dataTransfer: { files: [file], types: ['Files'] } })
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
    const wrapper = mount(ConvertImageWizard, {
      props: { start: { draft: delica }, decodeImage: async () => redAndWhite(), loadCatalog: () => Promise.reject(new Error('offline')), readClipboardImage: async () => undefined },
      attachTo: document.body,
    })
    await chooseFile(wrapper, picture())
    expect(wrapper.get('[data-testid="convert-catalog-failed"]').text()).toBe(en.palette.beadColors.failed)
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
  it('works on its own copy of the form’s values: what it creates follows the popup, the form’s are untouched', async () => {
    const { wrapper, draft } = open()
    const before = structuredClone(draft)
    await chooseFile(wrapper, picture())
    await choosePanelOption(wrapper, 'convert-technique', 'peyote')
    await wrapper.get('[data-testid="convert-image-create"]').trigger('click')

    expect(flatView(created(wrapper)!)).toMatchObject({ technique: 'peyote', name: 'fox' })
    expect(draft).toEqual(before)
  })

  it('offers Bead colors only for a Bead with a Color catalog, and starts on it there', async () => {
    const withCatalog = open({ draft: delica })
    await chooseFile(withCatalog.wrapper, picture())
    const options = (wrapper: VueWrapper) => wrapper.findAll('[data-testid="convert-color-source"] [data-value]').map((option) => option.attributes('data-value'))
    expect(options(withCatalog.wrapper)).toEqual(['bead-colors', 'default', 'exact'])
    expect(withCatalog.wrapper.get('[data-testid="convert-color-source"] [aria-checked="true"]').attributes('data-value')).toBe('bead-colors')
    withCatalog.wrapper.unmount()

    const without = open()
    await chooseFile(without.wrapper, picture())
    expect(options(without.wrapper)).toEqual(['default', 'exact'])
  })
})

describe('ConvertImageWizard Create Project', () => {
  it('makes the Project of the picture, one pixel one bead for a small picture, in the Bead’s colors', async () => {
    const { wrapper } = open({ draft: delica })
    await chooseFile(wrapper, picture())
    await flushPromises()
    await wrapper.get('[data-testid="convert-image-create"]').trigger('click')

    const project = created(wrapper)!
    // 4 px on its long side starts By Pixel to bead ratio at 1:4: 16 × 8 beads.
    expect(frameOf(project)).toMatchObject({ columns: 16, rows: 8 })
    expect(frameGrid(project)[0]![0]!.color).toBe('#d02030')
    expect(project.paletteCodes).toEqual({ '#d02030': 'DB723' })
  })

  it('leaves a found color set to empty without beads', async () => {
    const { wrapper } = open()
    await chooseFile(wrapper, picture())
    const white = wrapper.findAll('[data-testid="found-color"]').find((row) => row.attributes('data-picture-hex') === '#ffffff')!
    await white.get('[data-testid="found-color-empty"]').trigger('click')
    expect(white.get('[data-testid="found-color-name"]').text()).toBe(en.convertImage.wizard.empty)

    await wrapper.get('[data-testid="convert-image-create"]').trigger('click')
    const grid = frameGrid(created(wrapper)!)
    expect(grid[0]!.at(-1)!.color).toBeNull()
    expect(grid[0]![0]!.color).not.toBeNull()
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

  it('leaves the keys alone once the popup is gone', async () => {
    const { wrapper } = open()
    await chooseFile(wrapper, picture())
    wrapper.unmount()
    expect(press('+').defaultPrevented).toBe(false)
  })
})

describe('ConvertImageWizard controls from the registry (ticket 0650)', () => {
  it('names Treat as empty and gives it a Tooltip saying what it does, keeping its pressed state', async () => {
    const { wrapper } = open()
    await chooseFile(wrapper, picture())
    const button = wrapper.get('button[data-testid="convert-treat-as-empty"]')

    expect(button.text()).toBe(en.convertImage.wizard.treatAsEmpty)
    expect(button.attributes('aria-pressed')).toBe('false')
    await button.trigger('click')
    expect(button.attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[data-testid="convert-eyedropper-banner"]').exists()).toBe(true)
    expect(wrapper.get('.convert-preview__top [role="tooltip"]').text()).toContain(en.tooltips.treatAsEmpty)
  })

  it('keeps the ratio chips one radiogroup of radios named for the ratio, a press choosing one', async () => {
    const { wrapper } = open()
    await chooseFile(wrapper, picture())
    const group = wrapper.get('[data-testid="pixel-ratio"] [role="radiogroup"]')
    const radios = group.findAll('[role="radio"]')

    expect(radios.map((radio) => radio.attributes('aria-label'))).toEqual([
      ...['1:4', '1:2', '1:1', '2:1', '4:1', '8:1'].map((ratio) => `${ratio}, picture pixels : beads`),
      en.convertImage.wizard.customRatio,
    ])
    // A 4 px picture starts at 1:4 (the Create Project test above).
    expect(group.get('[aria-checked="true"]').attributes('data-testid')).toBe('ratio-1-4')
    await group.get('[data-testid="ratio-2-1"]').trigger('click')
    expect(group.get('[aria-checked="true"]').attributes('data-testid')).toBe('ratio-2-1')
  })

  it('keeps the step rail one Tab stop named Steps, the arrows moving along it', async () => {
    const { wrapper } = open()
    const rail = wrapper.get('nav')
    const steps = rail.findAll('.convert-wizard__step')

    expect(rail.attributes('aria-label')).toBe(en.convertImage.wizard.railLabel)
    expect(steps.map((step) => step.attributes('tabindex'))).toEqual(['0', '-1', '-1', '-1', '-1'])
    expect(steps[0]!.attributes('aria-current')).toBe('step')
    expect(steps.map((step) => step.text())).toEqual(['1picture', '2bead', '3size', '4colors', '5review'])
    ;(steps[0]!.element as HTMLElement).focus()
    await steps[0]!.trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(steps[1]!.element)
  })
})

describe('ConvertImageWizard Cancel', () => {
  it('closes at once with no picture set', async () => {
    const { wrapper } = open()
    await wrapper.get('[data-testid="convert-image-cancel"]').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  // Ticket 0679: nothing asks first; with a picture set, Cancel, Close and Escape each close at once.
  for (const [way, close] of [
    ['Cancel', (wrapper: VueWrapper) => wrapper.get('[data-testid="convert-image-cancel"]').trigger('click')],
    ['Close', (wrapper: VueWrapper) => wrapper.get('[data-testid="convert-close"]').trigger('click')],
    ['Escape', () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))],
  ] as const) {
    it(`closes at once from ${way} with a picture set`, async () => {
      const { wrapper } = open()
      await chooseFile(wrapper, picture())

      await close(wrapper)
      await flushPromises()
      expect(wrapper.emitted('cancel')).toHaveLength(1)
    })
  }
})
