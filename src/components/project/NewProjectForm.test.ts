import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import NewProjectForm from './NewProjectForm.vue'
import { PANEL_CONTEXT } from '../shell/panelContext'
import { BEAD_CATALOG, beadLabel } from '../../domain/beads'
import { chooseBeadInSection } from '../../testUtils/beadPicker'
import { choosePanelOption, panelOptionShown } from '../../testUtils/choosePanelOption'
import { fakeMatchMedia } from '../../testUtils/fakeMatchMedia'
import {
  IMAGE_MAX_BYTES,
  IMAGE_MAX_MEGABYTES,
  IMAGE_MAX_MEGAPIXELS,
  formatImageLimits,
  imageInputAccept,
  type PixelData,
} from '../../domain/imageConversion'
import { ImageConversionError } from '../../domain/imageConversion'
import { ru } from '../../i18n/ru'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'ru') // these tests read the Russian dictionary
})

/** A one-pixel decoded picture, standing in for whatever a browser would have decoded (jsdom decodes nothing). */
const onePixel: PixelData = { width: 1, height: 1, data: new Uint8ClampedArray([255, 0, 0, 255]) }

/** A file as the file input hands it over. `size` overrides what the bytes would otherwise weigh. */
function imageFile(name: string, type: string, size?: number): File {
  const file = new File(['pretend this is a picture'], name, { type })
  if (size !== undefined) {
    Object.defineProperty(file, 'size', { value: size })
  }
  return file
}

/** Chooses a file on the Convert image input, the way a file picker does. */
async function chooseImage(wrapper: ReturnType<typeof mount>, file: File) {
  const input = wrapper.find('[data-testid="convert-image-input"]')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
  await flushPromises()
}

/** A form whose Convert image is ready: the decoder is a stub, since jsdom decodes no image bytes. */
async function mountSizedForm(props: Record<string, unknown> = {}) {
  return mount(NewProjectForm, { props: { decodeImage: vi.fn(), ...props } })
}

/** States a size in the size step that opens after a picture is chosen, then continues to framing. */
async function stateSize(wrapper: ReturnType<typeof mount>, width: string, height: string) {
  await wrapper.find('[data-testid="width-input"]').setValue(width)
  await wrapper.find('[data-testid="height-input"]').setValue(height)
  await wrapper.find('[data-testid="convert-size-continue"]').trigger('click')
}

describe('NewProjectForm', () => {
  it('starts on the default Bead in the shared bead section (tickets 535, 568)', () => {
    const wrapper = mount(NewProjectForm)

    expect(panelOptionShown(wrapper, 'bead-brand')).toBe(BEAD_CATALOG[0]!.brand.name)
    expect(panelOptionShown(wrapper, 'bead-size')).toBe(BEAD_CATALOG[0]!.size)
  })

  it('opens with the Open canvas title and its subtitle, then the three accent buttons in order (ticket 568)', () => {
    const wrapper = mount(NewProjectForm)

    expect(wrapper.get('[data-testid="open-canvas-title"]').text()).toBe(ru.form.openCanvasTitle)
    expect(wrapper.text()).toContain(ru.form.openCanvasSubtitle)
    const buttons = [...wrapper.element.querySelectorAll('[data-testid="create-project"], .file-button__target--accent, [data-testid="pick-starter"]')]
    expect(buttons.map((button) => button.getAttribute('data-testid') ?? 'convert')).toEqual(['create-project', 'convert', 'pick-starter'])
  })

  it('opens the Starter gallery one level deeper from Pick a starter, focus to come back to it (ticket 0596)', async () => {
    const openSub = vi.fn()
    const wrapper = mount(NewProjectForm, { global: { provide: { [PANEL_CONTEXT as symbol]: { itemRole: ref(undefined), close: vi.fn(), openSub } } } })
    expect(wrapper.find('[data-testid="starter-gallery"]').exists()).toBe(false)
    await wrapper.get('[data-testid="pick-starter"]').trigger('click')
    expect(openSub).toHaveBeenCalledWith(ru.starters.title, { opener: 'pick-starter' })
  })

  it('focuses and selects the Name input as soon as the form opens (ticket 181)', () => {
    const wrapper = mount(NewProjectForm, { attachTo: document.body })
    const input = wrapper.find('[data-testid="name-input"]').element as HTMLInputElement

    expect(document.activeElement).toBe(input)
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(input.value.length)

    wrapper.unmount()
  })

  it('leaves the Name unfocused on a touch device until it is tapped, so the keyboard stays down (ticket 515)', async () => {
    vi.stubGlobal('matchMedia', fakeMatchMedia({ '(pointer: coarse)': true }).matchMedia)
    const wrapper = mount(NewProjectForm, { attachTo: document.body })
    const input = wrapper.find('[data-testid="name-input"]')

    expect(document.activeElement).not.toBe(input.element)
    await input.trigger('pointerdown')
    wrapper.vm.focusName()
    expect(document.activeElement).toBe(input.element)

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('has no Frame, Unit, Width or Height fields: the size is set afterwards in the Frame section (ticket 342)', () => {
    const wrapper = mount(NewProjectForm)

    for (const id of ['width-input', 'height-input', 'unit-select', 'new-project-frame-heading', 'size-conversion']) {
      expect(wrapper.find(`[data-testid="${id}"]`).exists()).toBe(false)
    }
    expect(wrapper.find('[data-testid="new-project-estimate-info"]').exists()).toBe(false)
  })

  it('emits submit with the chosen bead and technique, and no size: a new Project is a Canvas', async () => {
    const wrapper = mount(NewProjectForm)

    await chooseBeadInSection(wrapper, BEAD_CATALOG[1]!.id)
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([
      [{ name: '', technique: 'loom', beadId: BEAD_CATALOG[1]!.id, makerName: '' }],
    ])
  })

  it('shows the selected bead label as the name placeholder', async () => {
    const wrapper = mount(NewProjectForm)

    await chooseBeadInSection(wrapper, BEAD_CATALOG[1]!.id)

    expect(wrapper.find('[data-testid="name-input"]').attributes('placeholder')).toBe(
      beadLabel(BEAD_CATALOG[1]!, ru.formFactors),
    )
  })

  it('emits the trimmed custom name when one is typed', async () => {
    const wrapper = mount(NewProjectForm)

    await wrapper.find('[data-testid="name-input"]').setValue('  My Bracelet  ')
    await wrapper.find('form').trigger('submit')

    const events = wrapper.emitted('submit')
    expect(events![0]![0]).toMatchObject({ name: 'My Bracelet' })
  })

  it('lists Peyote, Brick stitch and Square stitch alongside Loom, and nothing else (tickets 0644, 0635)', async () => {
    const wrapper = mount(NewProjectForm)

    await wrapper.get('[data-testid="new-project-technique"] button[aria-haspopup]').trigger('click')
    const options = wrapper.findAll('[data-testid="new-project-technique"] [role="menuitemradio"]')
    expect(options.map((option) => option.attributes('data-value'))).toEqual(['loom', 'peyote', 'brick', 'square'])
  })

  it('emits the chosen technique when Peyote or Brick stitch is selected', async () => {
    const wrapper = mount(NewProjectForm)

    await choosePanelOption(wrapper, 'new-project-technique', 'peyote')
    await wrapper.find('form').trigger('submit')

    const events = wrapper.emitted('submit')
    expect(events![0]![0]).toMatchObject({ technique: 'peyote' })
  })

  it('offers Symmetric and Real, starts Symmetric and sends Real only when it is chosen (ticket 508)', async () => {
    const wrapper = mount(NewProjectForm)

    const options = wrapper.findAll('[data-testid="bead-shape"] [role="radio"]')
    expect(options.map((option) => option.attributes('data-value'))).toEqual(['symmetric', 'real'])
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')![0]![0]).not.toHaveProperty('beadShape')

    await wrapper.find('[data-testid="bead-shape"] [data-value="real"]').trigger('click')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')![1]![0]).toMatchObject({ beadShape: 'real' })
    expect(wrapper.emitted('draft')!.at(-1)![0]).toMatchObject({ beadShape: 'real' })
  })

  it("emits the trimmed maker's name when one is typed, keeping it apart from the device-wide one (ticket 182)", async () => {
    const wrapper = mount(NewProjectForm)

    await wrapper.find('[data-testid="maker-name-input"]').setValue('  Bead Master  ')
    await wrapper.find('form').trigger('submit')

    const events = wrapper.emitted('submit')
    expect(events![0]![0]).toMatchObject({ makerName: 'Bead Master' })
  })

  it("leaves the maker's name blank by default", () => {
    const wrapper = mount(NewProjectForm)

    expect((wrapper.find('[data-testid="maker-name-input"]').element as HTMLInputElement).value).toBe('')
  })
})

describe('NewProjectForm draft (ticket 58)', () => {
  it('reports its values straight away, so Convert image has a frame before anything is touched', () => {
    const wrapper = mount(NewProjectForm)

    expect(wrapper.emitted('draft')![0]![0]).toEqual({
      name: '',
      technique: 'loom',
      beadId: BEAD_CATALOG[0]!.id,
      makerName: '',
    })
  })

  it('reports every later change, so the frame follows the fields as they are edited', async () => {
    const wrapper = mount(NewProjectForm)

    await choosePanelOption(wrapper, 'new-project-technique', 'brick')
    await chooseBeadInSection(wrapper, BEAD_CATALOG[2]!.id)

    expect(wrapper.emitted('draft')!.at(-1)![0]).toEqual({
      name: '',
      technique: 'brick',
      techniqueSettings: { brickBlock: 1 },
      beadId: BEAD_CATALOG[2]!.id,
      makerName: '',
    })
  })
})

describe('NewProjectForm Brick block (ticket 477)', () => {
  const field = '[data-testid="new-project-brick-block"]'

  it('shows the stepper only for Brick stitch, with the hover text on it', async () => {
    const wrapper = mount(NewProjectForm)
    expect(wrapper.find(field).exists()).toBe(false)

    await choosePanelOption(wrapper, 'new-project-technique', 'brick')
    expect(wrapper.find(field).exists()).toBe(true)
    expect(wrapper.find('[data-testid="new-project-brick-block-value"]').text()).toBe('1')

    await choosePanelOption(wrapper, 'new-project-technique', 'peyote')
    expect(wrapper.find(field).exists()).toBe(false)
  })

  it('steps from 1 to 20, and sends the number with the draft and the submit', async () => {
    const wrapper = mount(NewProjectForm)
    await choosePanelOption(wrapper, 'new-project-technique', 'brick')
    expect(wrapper.find('[data-testid="new-project-brick-block-less"]').attributes('disabled')).toBeDefined()

    await wrapper.find('[data-testid="new-project-brick-block-more"]').trigger('pointerdown')
    await wrapper.find('[data-testid="new-project-brick-block-more"]').trigger('pointerup')
    expect(wrapper.emitted('draft')!.at(-1)![0]).toMatchObject({ technique: 'brick', techniqueSettings: { brickBlock: 2 } })

    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')![0]![0]).toMatchObject({ technique: 'brick', techniqueSettings: { brickBlock: 2 } })
  })

  it('keeps the number while another Technique is chosen, and sends none for it', async () => {
    const wrapper = mount(NewProjectForm)
    await choosePanelOption(wrapper, 'new-project-technique', 'brick')
    await wrapper.find('[data-testid="new-project-brick-block-more"]').trigger('pointerdown')
    await wrapper.find('[data-testid="new-project-brick-block-more"]').trigger('pointerup')

    await choosePanelOption(wrapper, 'new-project-technique', 'peyote')
    expect(wrapper.emitted('draft')!.at(-1)![0]).not.toHaveProperty('techniqueSettings')

    await choosePanelOption(wrapper, 'new-project-technique', 'brick')
    expect(wrapper.find('[data-testid="new-project-brick-block-value"]').text()).toBe('2')
  })
})

describe('NewProjectForm Convert image (ticket 58)', () => {
  it('advertises the limits as visible helper text and from the shared constants', async () => {
    const wrapper = await mountSizedForm()
    const expected = formatImageLimits(ru.convertImage.limitsHint)

    expect(expected).toContain('PNG')
    expect(expected).toContain(String(IMAGE_MAX_MEGABYTES))
    expect(expected).toContain(String(IMAGE_MAX_MEGAPIXELS))
    expect(wrapper.find('[data-testid="convert-image-limits"]').text()).toBe(expected)
  })

  it('offers the accepted formats to the file picker', async () => {
    const wrapper = await mountSizedForm()

    expect(wrapper.find('[data-testid="convert-image-input"]').attributes('accept')).toBe(imageInputAccept())
  })

  it('lets a picture be chosen without a size, and asks for the size in its own step (ticket 342, ADR 0026)', async () => {
    const decodeImage = vi.fn().mockResolvedValue(onePixel)
    const wrapper = await mountSizedForm({ decodeImage })

    expect(wrapper.find<HTMLInputElement>('[data-testid="convert-image-input"]').element.disabled).toBe(false)
    await chooseImage(wrapper, imageFile('art.png', 'image/png'))

    expect(wrapper.find('[data-testid="convert-size-dialog"]').exists()).toBe(true)
    expect(wrapper.emitted('convert-image')).toBeUndefined()
  })

  it('hands over the decoded picture for framing once its size is stated, the draft carrying that size first', async () => {
    const decodeImage = vi.fn().mockResolvedValue(onePixel)
    const wrapper = await mountSizedForm({ decodeImage })

    await chooseImage(wrapper, imageFile('art.png', 'image/png'))
    await stateSize(wrapper, '15', '30')

    expect(decodeImage).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('draft')!.at(-1)![0]).toMatchObject({ size: { width: 15, height: 30, unit: 'beads' } })
    expect(wrapper.emitted('convert-image')).toEqual([[onePixel]])
    expect(wrapper.find('[data-testid="convert-size-dialog"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="convert-image-error"]').exists()).toBe(false)
  })

  it('creates nothing and frames nothing when the size step is cancelled', async () => {
    const wrapper = await mountSizedForm({ decodeImage: vi.fn().mockResolvedValue(onePixel) })

    await chooseImage(wrapper, imageFile('art.png', 'image/png'))
    await wrapper.find('[data-testid="convert-size-cancel"]').trigger('click')

    expect(wrapper.find('[data-testid="convert-size-dialog"]').exists()).toBe(false)
    expect(wrapper.emitted('convert-image')).toBeUndefined()
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('does not let the size from Convert image leak into Create Project', async () => {
    const wrapper = await mountSizedForm({ decodeImage: vi.fn().mockResolvedValue(onePixel) })

    await chooseImage(wrapper, imageFile('art.png', 'image/png'))
    await stateSize(wrapper, '15', '30')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')![0]![0]).not.toHaveProperty('size')
  })

  it('turns HEIC away with its own message and never tries to decode it', async () => {
    const decodeImage = vi.fn().mockResolvedValue(onePixel)
    const wrapper = await mountSizedForm({ decodeImage })

    await chooseImage(wrapper, imageFile('IMG_0001.HEIC', ''))

    expect(decodeImage).not.toHaveBeenCalled()
    expect(wrapper.emitted('convert-image')).toBeUndefined()
    expect(wrapper.find('[data-testid="convert-image-error"]').text()).toBe(ru.convertImage.errors.heic)
  })

  it('turns SVG away with its own message', async () => {
    const wrapper = await mountSizedForm({ decodeImage: vi.fn() })

    await chooseImage(wrapper, imageFile('logo.svg', 'image/svg+xml'))

    expect(wrapper.find('[data-testid="convert-image-error"]').text()).toBe(ru.convertImage.errors.svg)
  })

  it('turns an unsupported format away, naming the ones that work', async () => {
    const wrapper = await mountSizedForm({ decodeImage: vi.fn() })

    await chooseImage(wrapper, imageFile('art.bmp', 'image/bmp'))

    expect(wrapper.find('[data-testid="convert-image-error"]').text()).toBe(
      formatImageLimits(ru.convertImage.errors.unsupportedFormat),
    )
    expect(wrapper.find('[data-testid="convert-image-error"]').text()).toContain('PNG')
  })

  it('turns an oversize file away, quoting the limit it enforces', async () => {
    const wrapper = await mountSizedForm({ decodeImage: vi.fn() })

    await chooseImage(wrapper, imageFile('huge.png', 'image/png', IMAGE_MAX_BYTES + 1))

    expect(wrapper.find('[data-testid="convert-image-error"]').text()).toBe(
      formatImageLimits(ru.convertImage.errors.tooLarge),
    )
    expect(wrapper.find('[data-testid="convert-image-error"]').text()).toContain(String(IMAGE_MAX_MEGABYTES))
  })

  it('reports an oversize resolution, which only the decode step can see', async () => {
    const decodeImage = vi.fn().mockRejectedValue(new ImageConversionError('tooManyPixels'))
    const wrapper = await mountSizedForm({ decodeImage })

    await chooseImage(wrapper, imageFile('huge.png', 'image/png'))

    expect(wrapper.emitted('convert-image')).toBeUndefined()
    expect(wrapper.find('[data-testid="convert-image-error"]').text()).toBe(
      formatImageLimits(ru.convertImage.errors.tooManyPixels),
    )
  })

  it('reports a corrupt file as a decode failure', async () => {
    const decodeImage = vi.fn().mockRejectedValue(new ImageConversionError('decodeFailed'))
    const wrapper = await mountSizedForm({ decodeImage })

    await chooseImage(wrapper, imageFile('broken.png', 'image/png'))

    expect(wrapper.find('[data-testid="convert-image-error"]').text()).toBe(
      ru.convertImage.errors.decodeFailed,
    )
  })

  it('reports an unexpected failure as a decode failure too, rather than saying nothing', async () => {
    const decodeImage = vi.fn().mockRejectedValue(new Error('something else went wrong'))
    const wrapper = await mountSizedForm({ decodeImage })

    await chooseImage(wrapper, imageFile('art.png', 'image/png'))

    expect(wrapper.find('[data-testid="convert-image-error"]').text()).toBe(
      ru.convertImage.errors.decodeFailed,
    )
  })

  it('clears a previous rejection once a picture goes through', async () => {
    const decodeImage = vi.fn().mockResolvedValue(onePixel)
    const wrapper = await mountSizedForm({ decodeImage })

    await chooseImage(wrapper, imageFile('logo.svg', 'image/svg+xml'))
    expect(wrapper.find('[data-testid="convert-image-error"]').exists()).toBe(true)

    await chooseImage(wrapper, imageFile('art.png', 'image/png'))

    expect(wrapper.find('[data-testid="convert-image-error"]').exists()).toBe(false)
  })
})
