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
  await wrapper.find('[data-testid="unit-select"] [data-value="mm"]').trigger('click')
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

  it('focuses and selects the Name input as soon as the form opens (ticket 181)', () => {
    const wrapper = mount(NewPatternForm, { attachTo: document.body })
    const input = wrapper.find('[data-testid="name-input"]').element as HTMLInputElement

    expect(document.activeElement).toBe(input)
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(input.value.length)

    wrapper.unmount()
  })

  it('emits submit with the chosen bead, technique, and size on valid input', async () => {
    const wrapper = mount(NewPatternForm)

    await wrapper.find('[data-testid="bead-select"]').setValue(BEAD_CATALOG[1]!.id)
    await wrapper.find('[data-testid="width-input"]').setValue('10')
    await wrapper.find('[data-testid="height-input"]').setValue('15')
    await wrapper.find('[data-testid="unit-select"] [data-value="cm"]').trigger('click')
    await wrapper.find('form').trigger('submit')

    const events = wrapper.emitted('submit')
    expect(events).toHaveLength(1)
    expect(events![0]).toEqual([
      {
        name: '',
        technique: 'loom',
        beadId: BEAD_CATALOG[1]!.id,
        size: { width: 10, height: 15, unit: 'cm' },
        makerName: '',
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

  it('defaults the unit to beads and technique to loom', () => {
    const wrapper = mount(NewPatternForm)

    expect(wrapper.find('[data-testid="unit-select"] [aria-checked="true"]').attributes('data-value')).toBe('beads')
    expect(wrapper.find('[data-testid="technique-select"] [aria-checked="true"]').text()).toBe(ru.form.techniqueLoom)
  })

  it('lists Peyote and Brick stitch alongside Loom', () => {
    const wrapper = mount(NewPatternForm)

    const options = wrapper.findAll('[data-testid="technique-select"] [role="radio"]')
    expect(options.map((option) => option.attributes('data-value'))).toEqual(['loom', 'peyote', 'brick'])
  })

  it('emits the chosen technique when Peyote or Brick stitch is selected', async () => {
    const wrapper = mount(NewPatternForm)

    await wrapper.find('[data-testid="technique-select"] [data-value="peyote"]').trigger('click')
    await wrapper.find('[data-testid="width-input"]').setValue('20')
    await wrapper.find('[data-testid="height-input"]').setValue('30')
    await wrapper.find('form').trigger('submit')

    const events = wrapper.emitted('submit')
    expect(events![0]![0]).toMatchObject({ technique: 'peyote' })
  })

  it('sets Width and Height entirely by clicking their stepper buttons (ticket 181)', async () => {
    const wrapper = mount(NewPatternForm)

    await wrapper.find('[data-testid="width-input-increase"]').trigger('click')
    await wrapper.find('[data-testid="width-input-increase"]').trigger('click')
    await wrapper.find('[data-testid="width-input-decrease"]').trigger('click')
    await wrapper.find('[data-testid="height-input-increase"]').trigger('click')
    await wrapper.find('form').trigger('submit')

    const events = wrapper.emitted('submit')
    expect(events![0]![0]).toMatchObject({ size: { width: 1, height: 1, unit: 'beads' } })
  })

  it("turns Width's decrease button away at its minimum of 1 bead", async () => {
    const wrapper = mount(NewPatternForm)

    // Empty reads as 0: a step down would land below the 1-bead minimum, so decrease starts turned away.
    expect(wrapper.find('[data-testid="width-input-decrease"]').attributes('disabled')).toBeDefined()

    await wrapper.find('[data-testid="width-input-increase"]').trigger('click')
    expect(wrapper.find('[data-testid="width-input-decrease"]').attributes('disabled')).toBeDefined()

    await wrapper.find('[data-testid="width-input-increase"]').trigger('click')
    expect(wrapper.find('[data-testid="width-input-decrease"]').attributes('disabled')).toBeUndefined()
  })

  it("emits the trimmed maker's name when one is typed, keeping it apart from the device-wide one (ticket 182)", async () => {
    const wrapper = mount(NewPatternForm)

    await wrapper.find('[data-testid="maker-name-input"]').setValue('  Bead Master  ')
    await wrapper.find('[data-testid="width-input"]').setValue('20')
    await wrapper.find('[data-testid="height-input"]').setValue('30')
    await wrapper.find('form').trigger('submit')

    const events = wrapper.emitted('submit')
    expect(events![0]![0]).toMatchObject({ makerName: 'Bead Master' })
  })

  it("leaves the maker's name blank by default", () => {
    const wrapper = mount(NewPatternForm)

    expect((wrapper.find('[data-testid="maker-name-input"]').element as HTMLInputElement).value).toBe('')
  })
})

describe('NewPatternForm draft (ticket 58)', () => {
  it('reports its values straight away, so Convert image has a frame before anything is touched', () => {
    const wrapper = mount(NewPatternForm)

    expect(wrapper.emitted('draft')![0]![0]).toEqual({
      name: '',
      technique: 'loom',
      beadId: BEAD_CATALOG[0]!.id,
      size: { width: 0, height: 0, unit: 'beads' },
      makerName: '',
    })
  })

  it('reports every later change, so the frame follows the fields as they are edited', async () => {
    const wrapper = mount(NewPatternForm)

    await wrapper.find('[data-testid="width-input"]').setValue('15')
    await wrapper.find('[data-testid="height-input"]').setValue('30')
    await wrapper.find('[data-testid="technique-select"] [data-value="brick"]').trigger('click')
    await wrapper.find('[data-testid="bead-select"]').setValue(BEAD_CATALOG[2]!.id)
    await wrapper.find('[data-testid="unit-select"] [data-value="cm"]').trigger('click')

    const drafts = wrapper.emitted('draft')!
    expect(drafts.at(-1)![0]).toEqual({
      name: '',
      technique: 'brick',
      beadId: BEAD_CATALOG[2]!.id,
      size: { width: 15, height: 30, unit: 'cm' },
      makerName: '',
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

describe('NewPatternForm slow-framing warning (ticket 61)', () => {
  const warningTestId = '[data-testid="convert-image-slow-framing-warning"]'

  /**
   * The real threshold is 12,000 cells; these tests lower it so the sizes they build stay small, and cover the lookup
   * itself.
   */
  const reachable = { loom: 5000, peyote: 5000, brick: 5000 }

  /** A form sized so the default TOHO Cube 1.5mm bead yields exactly 100 columns by `rows` rows. */
  async function mountFormWithRows(rows: number, extraProps: Record<string, unknown> = {}) {
    const wrapper = mount(NewPatternForm, { props: { slowFramingCellThresholds: reachable, ...extraProps } })
    await wrapper.find('[data-testid="unit-select"] [data-value="mm"]').trigger('click')
    await wrapper.find('[data-testid="width-input"]').setValue('150') // 100 columns at 1.5mm
    await wrapper.find('[data-testid="height-input"]').setValue(String(rows * 1.5))
    return wrapper
  }

  it('hides the hint just under the threshold', async () => {
    const wrapper = await mountFormWithRows(49) // 100 x 49 = 4,900 cells
    expect(wrapper.find(warningTestId).exists()).toBe(false)
  })

  it('shows the hint right at the threshold', async () => {
    const wrapper = await mountFormWithRows(50) // 100 x 50 = 5,000 cells
    expect(wrapper.find(warningTestId).exists()).toBe(true)
  })

  it('shows the hint just over the threshold', async () => {
    const wrapper = await mountFormWithRows(51) // 100 x 51 = 5,100 cells
    expect(wrapper.find(warningTestId).exists()).toBe(true)
  })

  it('reads the same grid whichever unit the size is stated in', async () => {
    const wrapper = await mountFormWithRows(50)
    expect(wrapper.find(warningTestId).exists()).toBe(true)

    await wrapper.find('[data-testid="unit-select"] [data-value="beads"]').trigger('click')
    await wrapper.find('[data-testid="width-input"]').setValue('100')
    await wrapper.find('[data-testid="height-input"]').setValue('49')
    expect(wrapper.find(warningTestId).exists()).toBe(false)

    await wrapper.find('[data-testid="height-input"]').setValue('50')
    expect(wrapper.find(warningTestId).exists()).toBe(true)
  })

  it('names the current Technique in the hint, without styling it as an error', async () => {
    const wrapper = await mountFormWithRows(50)
    const hint = wrapper.find(warningTestId)

    expect(hint.text()).toContain(ru.form.techniqueLoom)
    expect(hint.classes()).not.toContain('new-pattern-form__error')
  })

  it('never disables the file input or blocks conversion', async () => {
    const wrapper = await mountFormWithRows(50)
    expect(wrapper.find('[data-testid="convert-image-input"]').attributes('disabled')).toBeUndefined()
  })

  it('updates live as width, height or bead change, with no resubmit needed', async () => {
    const wrapper = await mountFormWithRows(20) // well under threshold
    expect(wrapper.find(warningTestId).exists()).toBe(false)

    await wrapper.find('[data-testid="height-input"]').setValue('90') // 100 x 60 = 6,000
    expect(wrapper.find(warningTestId).exists()).toBe(true)
  })

  it('switching Technique alone flips the hint on/off at an unchanged physical size and Bead', async () => {
    const thresholds = { loom: 100, peyote: 100000, brick: 100000 }
    const wrapper = await mountFormWithRows(6, { slowFramingCellThresholds: thresholds }) // 100 x 6 = 600 cells

    expect(wrapper.find(warningTestId).exists()).toBe(true) // loom's threshold is 100

    await wrapper.find('[data-testid="technique-select"] [data-value="peyote"]').trigger('click')
    expect(wrapper.find(warningTestId).exists()).toBe(false) // peyote's threshold is 100,000

    await wrapper.find('[data-testid="technique-select"] [data-value="brick"]').trigger('click')
    expect(wrapper.find(warningTestId).exists()).toBe(false) // brick's threshold is 100,000

    await wrapper.find('[data-testid="technique-select"] [data-value="loom"]').trigger('click')
    expect(wrapper.find(warningTestId).exists()).toBe(true)
  })
})

describe('NewPatternForm size in beads (ticket 100)', () => {
  /** What the form once said against a size that was too big: it says nothing now (ADR 0019). */
  const messageTestId = '[data-testid="size-cap-message"]'
  const createButton = (wrapper: ReturnType<typeof mount>) => wrapper.find<HTMLButtonElement>('button[type="submit"]')
  const convertInput = (wrapper: ReturnType<typeof mount>) =>
    wrapper.find<HTMLInputElement>('[data-testid="convert-image-input"]')

  async function state(
    wrapper: ReturnType<typeof mount>,
    { unit, width, height, bead, technique }: { unit?: string; width: string; height: string; bead?: string; technique?: string },
  ) {
    if (bead) await wrapper.find('[data-testid="bead-select"]').setValue(bead)
    if (technique) await wrapper.find(`[data-testid="technique-select"] [data-value="${technique}"]`).trigger('click')
    if (unit) await wrapper.find(`[data-testid="unit-select"] [data-value="${unit}"]`).trigger('click')
    await wrapper.find('[data-testid="width-input"]').setValue(width)
    await wrapper.find('[data-testid="height-input"]').setValue(height)
  }

  it('offers beads first, then mm and cm, with the beads label in the interface language', () => {
    const wrapper = mount(NewPatternForm)

    const options = wrapper.findAll('[data-testid="unit-select"] [role="radio"]')
    expect(options.map((option) => option.attributes('data-value'))).toEqual(['beads', 'mm', 'cm'])
    expect(options[0]!.text()).toBe(ru.form.unitBeads)
  })

  it('submits a size in beads as it is, for the Pattern to take as its columns and rows', async () => {
    const wrapper = mount(NewPatternForm)

    await state(wrapper, { width: '24', height: '40' })
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')![0]![0]).toMatchObject({ size: { width: 24, height: 40, unit: 'beads' } })
  })

  it.each([['2.5', '10'], ['10', '0.5'], ['0', '10'], ['-3', '10']])(
    'wants whole numbers of at least 1 in beads: %s x %s is not creatable',
    async (width, height) => {
      const wrapper = mount(NewPatternForm)

      await state(wrapper, { width, height })
      await wrapper.find('form').trigger('submit')

      expect(createButton(wrapper).element.disabled).toBe(true)
      expect(wrapper.emitted('submit')).toBeUndefined()
    },
  )

  it('asks for whole beads in the input itself', () => {
    const wrapper = mount(NewPatternForm)

    const width = wrapper.find('[data-testid="width-input"]')
    expect(width.attributes('min')).toBe('1')
    expect(width.attributes('step')).toBe('1')
  })

  it('still takes decimals in mm and cm', async () => {
    const wrapper = mount(NewPatternForm)

    await state(wrapper, { unit: 'cm', width: '2.5', height: '4.5' })

    expect(wrapper.find('[data-testid="width-input"]').attributes('step')).toBe('any')
    expect(createButton(wrapper).element.disabled).toBe(false)
  })

  describe('has no limit on size (ADR 0019)', () => {
    it.each([
      ['10,001 cells', '10001', '1'],
      ['500 × 10', '500', '10'],
      ['200 × 200', '200', '200'],
      ['70 × 250, a bracelet', '70', '250'],
      ['250 × 250', '250', '250'],
    ])('accepts %s in beads: Create is on, Convert image is on, and nothing is said against it', async (_label, width, height) => {
      const wrapper = mount(NewPatternForm)

      await state(wrapper, { width, height })

      expect(createButton(wrapper).element.disabled).toBe(false)
      expect(convertInput(wrapper).element.disabled).toBe(false)
      expect(wrapper.find(messageTestId).exists()).toBe(false)
    })

    it('submits a size that used to be too big, as it is', async () => {
      const wrapper = mount(NewPatternForm)

      await state(wrapper, { width: '250', height: '250' })
      await wrapper.find('form').trigger('submit')

      expect(wrapper.emitted('submit')![0]![0]).toMatchObject({ size: { width: 250, height: 250, unit: 'beads' } })
    })

    it('accepts a big size in mm and cm as well, whichever Bead and Technique', async () => {
      const wrapper = mount(NewPatternForm)

      for (const bead of BEAD_CATALOG) {
        for (const technique of ['loom', 'peyote', 'brick']) {
          await state(wrapper, { unit: 'cm', bead: bead.id, technique, width: '60', height: '60' })
          expect(createButton(wrapper).element.disabled).toBe(false)
          expect(wrapper.find(messageTestId).exists()).toBe(false)
        }
      }
    })

    it('still wants a size that means something: whole beads, and at least 1', async () => {
      const wrapper = mount(NewPatternForm)

      await state(wrapper, { width: '250.5', height: '250' })

      expect(createButton(wrapper).element.disabled).toBe(true)
    })
  })

  it('words the unit in English too', async () => {
    const { en } = await import('../i18n/en')
    localStorage.setItem('bd-beads:locale', 'en')
    const wrapper = mount(NewPatternForm)

    expect(en.form.unitBeads).toBe('beads')
    expect(wrapper.find('[data-testid="unit-select"] [role="radio"]').text()).toBe('beads')
  })
})

describe('NewPatternForm on the design system (ticket 149)', () => {
  beforeEach(() => localStorage.setItem('bd-beads:locale', 'en'))

  it('says what to enter at a size field once it has been left empty, and not before', async () => {
    const { en } = await import('../i18n/en')
    const wrapper = mount(NewPatternForm)
    expect(wrapper.find('[data-testid="height-error"]').exists()).toBe(false)

    await wrapper.find('[data-testid="height-input"]').trigger('blur')

    expect(wrapper.find('[data-testid="height-error"]').text()).toBe(en.form.enterHeight)
    expect(wrapper.find('[data-testid="height-input"]').attributes('aria-invalid')).toBe('true')
    await wrapper.find('[data-testid="height-input"]').setValue('30')
    expect(wrapper.find('[data-testid="height-error"]').exists()).toBe(false)
  })

  it('asks for a whole number of beads, and not in mm', async () => {
    const { en } = await import('../i18n/en')
    const wrapper = mount(NewPatternForm)

    await wrapper.find('[data-testid="width-input"]').setValue('2.5')
    await wrapper.find('[data-testid="width-input"]').trigger('blur')
    expect(wrapper.find('[data-testid="width-error"]').text()).toBe(en.form.enterWholeBeads)

    await wrapper.find('[data-testid="unit-select"] [data-value="mm"]').trigger('click')
    expect(wrapper.find('[data-testid="width-error"]').exists()).toBe(false)
  })

  it('shows the size in the other unit beside Unit', async () => {
    const wrapper = mount(NewPatternForm)
    await wrapper.find('[data-testid="bead-select"]').setValue('toho-cube-1.5mm')
    await wrapper.find('[data-testid="width-input"]').setValue('40')
    await wrapper.find('[data-testid="height-input"]').setValue('30')

    const estimateText = () => wrapper.find('[data-testid="new-pattern-estimate-text"]').text()
    expect(estimateText()).toMatch(/^≈.*(cm|mm)/)

    await wrapper.find('[data-testid="unit-select"] [data-value="mm"]').trigger('click')
    expect(estimateText()).toBe('≈ 27×20 beads')
  })

  it('explains the estimate in a tooltip on hover and keyboard focus (ticket 170)', async () => {
    const { en } = await import('../i18n/en')
    const wrapper = mount(NewPatternForm)
    await wrapper.find('[data-testid="bead-select"]').setValue('toho-cube-1.5mm')
    await wrapper.find('[data-testid="width-input"]').setValue('40')
    await wrapper.find('[data-testid="height-input"]').setValue('30')

    const info = wrapper.find('[data-testid="new-pattern-estimate-info"]')
    const tooltip = wrapper.find('[data-testid="new-pattern-estimate-tooltip"]')
    const shown = () => (tooltip.element as HTMLElement).style.display !== 'none'

    expect(shown()).toBe(false)
    await info.trigger('mouseenter')
    expect(shown()).toBe(true)
    expect(tooltip.text()).toBe(en.size.estimateWarning)
    await info.trigger('mouseleave')
    expect(shown()).toBe(false)
    await info.trigger('focus')
    expect(shown()).toBe(true)
    await info.trigger('keydown', { key: 'Escape' })
    expect(shown()).toBe(false)
  })

  it("shows the Unit picker's conversion row with both axes' bead-to-real-world conversion (ticket 179)", async () => {
    const wrapper = mount(NewPatternForm)
    await wrapper.find('[data-testid="bead-select"]').setValue('toho-cube-1.5mm')
    await wrapper.find('[data-testid="width-input"]').setValue('40')
    await wrapper.find('[data-testid="height-input"]').setValue('30')

    expect(wrapper.find('[data-testid="size-conversion"]').text()).toContain('40×1.5 × 30×1.5 ≈ 6.0 × 4.5 cm')
  })

  it("updates the conversion row live as width, height, unit or Bead changes", async () => {
    const wrapper = mount(NewPatternForm)
    await wrapper.find('[data-testid="width-input"]').setValue('10')
    await wrapper.find('[data-testid="height-input"]').setValue('20')
    expect(wrapper.find('[data-testid="size-conversion"]').text()).toContain('10×1.5 × 20×1.5')

    await wrapper.find('[data-testid="width-input"]').setValue('12')
    expect(wrapper.find('[data-testid="size-conversion"]').text()).toContain('12×1.5 × 20×1.5')

    await wrapper.find('[data-testid="bead-select"]').setValue('miyuki-delica-11-0')
    expect(wrapper.find('[data-testid="size-conversion"]').text()).toContain('12×1.6 × 20×1.3')

    await wrapper.find('[data-testid="unit-select"] [data-value="mm"]').trigger('click')
    await wrapper.find('[data-testid="width-input"]').setValue('15')
    await wrapper.find('[data-testid="height-input"]').setValue('30')
    // At 1.6/1.3mm pitch, 15mm/30mm rounds to 9 columns and 23 rows.
    expect(wrapper.find('[data-testid="size-conversion"]').text()).toContain('9×1.6 × 23×1.3')
  })

  it('explains the conversion row is a mathematical estimate, in a tooltip on the info trigger', async () => {
    const { en } = await import('../i18n/en')
    const wrapper = mount(NewPatternForm)
    await wrapper.find('[data-testid="width-input"]').setValue('10')
    await wrapper.find('[data-testid="height-input"]').setValue('20')

    const info = wrapper.find('[data-testid="size-conversion-info"]')
    expect(info.attributes('aria-label')).toBe(en.form.sizeConversionInfoButton)

    await info.trigger('focusin')
    expect(wrapper.find('[data-testid="tooltip"]').text()).toBe(en.form.sizeConversionInfo)
  })

  it('shows no conversion row before a size is stated', () => {
    const wrapper = mount(NewPatternForm)

    expect(wrapper.find('[data-testid="size-conversion"]').exists()).toBe(false)
  })

  it('says Convert image waits for a size, and takes a dropped picture once there is one', async () => {
    const { en } = await import('../i18n/en')
    const decodeImage = vi.fn().mockResolvedValue(onePixel)
    const wrapper = mount(NewPatternForm, { props: { decodeImage } })
    expect(wrapper.find('[data-testid="convert-image-field"]').text()).toContain(en.form.enterSizeFirst)

    await wrapper.find('[data-testid="width-input"]').setValue('10')
    await wrapper.find('[data-testid="height-input"]').setValue('10')
    const drop = new Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(drop, 'dataTransfer', { value: { files: [imageFile('fox.png', 'image/png')] } })
    wrapper.find('[data-testid="convert-image-field"] label').element.dispatchEvent(drop)
    await flushPromises()

    expect(decodeImage).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('convert-image')).toEqual([[onePixel]])
  })
})
