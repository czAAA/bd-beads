import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import NewProjectForm from './NewProjectForm.vue'
import { BEAD_CATALOG } from '../../domain/beads'
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
  localStorage.setItem('bd-beads:locale', 'ru') // these tests read the Russian dictionary
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
  it('lists every bead in the catalog as an option', () => {
    const wrapper = mount(NewProjectForm)

    const options = wrapper.findAll('[data-testid="bead-select"] option')
    expect(options).toHaveLength(BEAD_CATALOG.length)
    expect(options[0]!.text()).toContain('TOHO')
  })

  it('focuses and selects the Name input as soon as the form opens (ticket 181)', () => {
    const wrapper = mount(NewProjectForm, { attachTo: document.body })
    const input = wrapper.find('[data-testid="name-input"]').element as HTMLInputElement

    expect(document.activeElement).toBe(input)
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(input.value.length)

    wrapper.unmount()
  })

  it('has no Frame, Unit, Width or Height fields: the size is set afterwards in the Frame section (ticket 342)', () => {
    const wrapper = mount(NewProjectForm)

    for (const id of ['width-input', 'height-input', 'unit-select', 'new-project-frame-heading', 'size-conversion']) {
      expect(wrapper.find(`[data-testid="${id}"]`).exists()).toBe(false)
    }
    expect(wrapper.find('[data-testid="new-project-estimate-info"]').exists()).toBe(false)
  })

  it('emits submit with the chosen bead and technique, and no size: a new Project is an open canvas', async () => {
    const wrapper = mount(NewProjectForm)

    await wrapper.find('[data-testid="bead-select"]').setValue(BEAD_CATALOG[1]!.id)
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([
      [{ name: '', technique: 'loom', beadId: BEAD_CATALOG[1]!.id, makerName: '' }],
    ])
  })

  it('shows the selected bead label as the name placeholder', async () => {
    const wrapper = mount(NewProjectForm)

    await wrapper.find('[data-testid="bead-select"]').setValue(BEAD_CATALOG[1]!.id)

    expect(wrapper.find('[data-testid="name-input"]').attributes('placeholder')).toBe(
      `${BEAD_CATALOG[1]!.brand} ${BEAD_CATALOG[1]!.name} ${BEAD_CATALOG[1]!.size}`,
    )
  })

  it('emits the trimmed custom name when one is typed', async () => {
    const wrapper = mount(NewProjectForm)

    await wrapper.find('[data-testid="name-input"]').setValue('  My Bracelet  ')
    await wrapper.find('form').trigger('submit')

    const events = wrapper.emitted('submit')
    expect(events![0]![0]).toMatchObject({ name: 'My Bracelet' })
  })

  it('lists Peyote and Brick stitch alongside Loom', () => {
    const wrapper = mount(NewProjectForm)

    const options = wrapper.findAll('[data-testid="technique-select"] [role="radio"]')
    expect(options.map((option) => option.attributes('data-value'))).toEqual(['loom', 'peyote', 'brick'])
  })

  it('emits the chosen technique when Peyote or Brick stitch is selected', async () => {
    const wrapper = mount(NewProjectForm)

    await wrapper.find('[data-testid="technique-select"] [data-value="peyote"]').trigger('click')
    await wrapper.find('form').trigger('submit')

    const events = wrapper.emitted('submit')
    expect(events![0]![0]).toMatchObject({ technique: 'peyote' })
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

    await wrapper.find('[data-testid="technique-select"] [data-value="brick"]').trigger('click')
    await wrapper.find('[data-testid="bead-select"]').setValue(BEAD_CATALOG[2]!.id)

    expect(wrapper.emitted('draft')!.at(-1)![0]).toEqual({
      name: '',
      technique: 'brick',
      beadId: BEAD_CATALOG[2]!.id,
      makerName: '',
    })
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
