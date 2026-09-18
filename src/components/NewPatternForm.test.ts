import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import NewPatternForm from './NewPatternForm.vue'
import { BEAD_CATALOG } from '../domain/beads'
import {
  IMAGE_MAX_BYTES,
  IMAGE_MAX_MEGABYTES,
  IMAGE_MAX_MEGAPIXELS,
  formatImageLimits,
  imageInputAccept,
  type PixelData,
} from '../domain/imageConversion'
import { ImageConversionError } from '../domain/imageDecode'
import { ru } from '../i18n/ru'

beforeEach(() => {
  localStorage.clear()
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

/** A form with a size already stated, since Convert image needs one before there is a frame to fit a picture into. */
async function mountSizedForm(props: Record<string, unknown> = {}) {
  const wrapper = mount(NewPatternForm, { props })
  await wrapper.find('[data-testid="width-input"]').setValue('15')
  await wrapper.find('[data-testid="height-input"]').setValue('30')
  return wrapper
}

describe('NewPatternForm', () => {
  it('lists every bead in the catalog as an option', () => {
    const wrapper = mount(NewPatternForm)

    const options = wrapper.findAll('[data-testid="bead-select"] option')
    expect(options).toHaveLength(BEAD_CATALOG.length)
    expect(options[0]!.text()).toContain('TOHO')
  })

  it('emits submit with the chosen bead, technique, and size on valid input', async () => {
    const wrapper = mount(NewPatternForm)

    await wrapper.find('[data-testid="bead-select"]').setValue(BEAD_CATALOG[1]!.id)
    await wrapper.find('[data-testid="width-input"]').setValue('20')
    await wrapper.find('[data-testid="height-input"]').setValue('30')
    await wrapper.find('[data-testid="unit-select"]').setValue('cm')
    await wrapper.find('form').trigger('submit')

    const events = wrapper.emitted('submit')
    expect(events).toHaveLength(1)
    expect(events![0]).toEqual([
      {
        name: '',
        technique: 'loom',
        beadId: BEAD_CATALOG[1]!.id,
        size: { width: 20, height: 30, unit: 'cm' },
      },
    ])
  })

  it('shows the selected bead label as the name placeholder', async () => {
    const wrapper = mount(NewPatternForm)

    await wrapper.find('[data-testid="bead-select"]').setValue(BEAD_CATALOG[1]!.id)

    expect(wrapper.find('[data-testid="name-input"]').attributes('placeholder')).toBe(
      `${BEAD_CATALOG[1]!.brand} ${BEAD_CATALOG[1]!.name} ${BEAD_CATALOG[1]!.size}`,
    )
  })

  it('emits the trimmed custom name when one is typed', async () => {
    const wrapper = mount(NewPatternForm)

    await wrapper.find('[data-testid="name-input"]').setValue('  My Bracelet  ')
    await wrapper.find('[data-testid="width-input"]').setValue('20')
    await wrapper.find('[data-testid="height-input"]').setValue('30')
    await wrapper.find('form').trigger('submit')

    const events = wrapper.emitted('submit')
    expect(events![0]![0]).toMatchObject({ name: 'My Bracelet' })
  })

  it('does not emit submit while width or height is zero', async () => {
    const wrapper = mount(NewPatternForm)

    await wrapper.find('[data-testid="width-input"]').setValue('0')
    await wrapper.find('[data-testid="height-input"]').setValue('10')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('defaults the unit to mm and technique to loom', () => {
    const wrapper = mount(NewPatternForm)

    expect(wrapper.find<HTMLSelectElement>('[data-testid="unit-select"]').element.value).toBe('mm')
    expect(wrapper.find('[data-testid="technique-select"]').text()).toContain(ru.form.techniqueLoom)
  })

  it('lists Peyote and Brick stitch alongside Loom', () => {
    const wrapper = mount(NewPatternForm)

    const options = wrapper.findAll<HTMLOptionElement>('[data-testid="technique-select"] option')
    expect(options.map((option) => option.element.value)).toEqual(['loom', 'peyote', 'brick'])
  })

  it('emits the chosen technique when Peyote or Brick stitch is selected', async () => {
    const wrapper = mount(NewPatternForm)

    await wrapper.find('[data-testid="technique-select"]').setValue('peyote')
    await wrapper.find('[data-testid="width-input"]').setValue('20')
    await wrapper.find('[data-testid="height-input"]').setValue('30')
    await wrapper.find('form').trigger('submit')

    const events = wrapper.emitted('submit')
    expect(events![0]![0]).toMatchObject({ technique: 'peyote' })
  })
})

describe('NewPatternForm draft (ticket 58)', () => {
  it('reports its values straight away, so Convert image has a frame before anything is touched', () => {
    const wrapper = mount(NewPatternForm)

    expect(wrapper.emitted('draft')![0]![0]).toEqual({
      name: '',
      technique: 'loom',
      beadId: BEAD_CATALOG[0]!.id,
      size: { width: 0, height: 0, unit: 'mm' },
    })
  })

  it('reports every later change, so the frame follows the fields as they are edited', async () => {
    const wrapper = mount(NewPatternForm)

    await wrapper.find('[data-testid="width-input"]').setValue('15')
    await wrapper.find('[data-testid="height-input"]').setValue('30')
    await wrapper.find('[data-testid="technique-select"]').setValue('brick')
    await wrapper.find('[data-testid="bead-select"]').setValue(BEAD_CATALOG[2]!.id)
    await wrapper.find('[data-testid="unit-select"]').setValue('cm')

    const drafts = wrapper.emitted('draft')!
    expect(drafts.at(-1)![0]).toEqual({
      name: '',
      technique: 'brick',
      beadId: BEAD_CATALOG[2]!.id,
      size: { width: 15, height: 30, unit: 'cm' },
    })
  })
})

describe('NewPatternForm Convert image (ticket 58)', () => {
  it('advertises the limits as visible helper text and as the input own title, from the shared constants', async () => {
    const wrapper = await mountSizedForm()
    const expected = formatImageLimits(ru.convertImage.limitsHint)

    expect(expected).toContain('PNG')
    expect(expected).toContain(String(IMAGE_MAX_MEGABYTES))
    expect(expected).toContain(String(IMAGE_MAX_MEGAPIXELS))
    expect(wrapper.find('[data-testid="convert-image-limits"]').text()).toBe(expected)
    expect(wrapper.find('[data-testid="convert-image-input"]').attributes('title')).toBe(expected)
  })

  it('still carries the limits in a title while the input is disabled, where a tooltip would not show', () => {
    const wrapper = mount(NewPatternForm)

    expect(wrapper.find<HTMLInputElement>('[data-testid="convert-image-input"]').element.disabled).toBe(true)
    expect(wrapper.find('[data-testid="convert-image-field"]').attributes('title')).toBe(
      formatImageLimits(ru.convertImage.limitsHint),
    )
  })

  it('offers the accepted formats to the file picker', async () => {
    const wrapper = await mountSizedForm()

    expect(wrapper.find('[data-testid="convert-image-input"]').attributes('accept')).toBe(imageInputAccept())
  })

  it('waits for a size before a picture can be chosen, since the size is what the frame is', async () => {
    const wrapper = mount(NewPatternForm)

    expect(
      wrapper.find<HTMLInputElement>('[data-testid="convert-image-input"]').element.disabled,
    ).toBe(true)

    await wrapper.find('[data-testid="width-input"]').setValue('15')
    await wrapper.find('[data-testid="height-input"]').setValue('30')

    expect(
      wrapper.find<HTMLInputElement>('[data-testid="convert-image-input"]').element.disabled,
    ).toBe(false)
  })

  it('hands over a decoded picture for framing', async () => {
    const decodeImage = vi.fn().mockResolvedValue(onePixel)
    const wrapper = await mountSizedForm({ decodeImage })

    await chooseImage(wrapper, imageFile('art.png', 'image/png'))

    expect(decodeImage).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('convert-image')).toEqual([[onePixel]])
    expect(wrapper.find('[data-testid="convert-image-error"]').exists()).toBe(false)
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
