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

    expect(created(wrapper)).toMatchObject({ technique: 'peyote', name: 'fox' })
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
    expect(project.frame).toMatchObject({ columns: 16, rows: 8 })
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

describe('ConvertImageWizard Cancel', () => {
  it('closes at once with no picture set', async () => {
    const { wrapper } = open()
    await wrapper.get('[data-testid="convert-image-cancel"]').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('asks in the footer once a picture is set, from Cancel, Close and Escape alike', async () => {
    const { wrapper } = open()
    await chooseFile(wrapper, picture())

    for (const ask of [
      () => wrapper.get('[data-testid="convert-image-cancel"]').trigger('click'),
      () => wrapper.get('[data-testid="convert-close"]').trigger('click'),
      () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })),
    ]) {
      await ask()
      await flushPromises()
      expect(wrapper.get('[data-testid="convert-discard"]').text()).toContain(en.convertImage.wizard.discardQuestion)
      expect(wrapper.emitted('cancel')).toBeUndefined()
      await wrapper.get('[data-testid="convert-discard-keep"]').trigger('click')
      expect(wrapper.find('[data-testid="convert-discard"]').exists()).toBe(false)
    }

    await wrapper.get('[data-testid="convert-image-cancel"]').trigger('click')
    await wrapper.get('[data-testid="convert-discard-confirm"]').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
