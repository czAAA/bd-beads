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
  await wrapper.find('[data-testid="unit-select"]').setValue('mm')
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
    await wrapper.find('[data-testid="width-input"]').setValue('10')
    await wrapper.find('[data-testid="height-input"]').setValue('15')
    await wrapper.find('[data-testid="unit-select"]').setValue('cm')
    await wrapper.find('form').trigger('submit')

    const events = wrapper.emitted('submit')
    expect(events).toHaveLength(1)
    expect(events![0]).toEqual([
      {
        name: '',
        technique: 'loom',
        beadId: BEAD_CATALOG[1]!.id,
        size: { width: 10, height: 15, unit: 'cm' },
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

    expect(wrapper.find<HTMLSelectElement>('[data-testid="unit-select"]').element.value).toBe('beads')
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
      size: { width: 0, height: 0, unit: 'beads' },
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

describe('NewPatternForm slow-framing warning (ticket 61)', () => {
  const warningTestId = '[data-testid="convert-image-slow-framing-warning"]'

  /**
   * The real threshold (12,000 cells) now sits above the 10,000-cell cap (ADR 0017), so no size the form accepts can
   * reach it; these tests lower it to something reachable instead, to keep covering the lookup itself.
   */
  const reachable = { loom: 5000, peyote: 5000, brick: 5000 }

  /** A form sized so the default TOHO Cube 1.5mm bead yields exactly 100 columns by `rows` rows. */
  async function mountFormWithRows(rows: number, extraProps: Record<string, unknown> = {}) {
    const wrapper = mount(NewPatternForm, { props: { slowFramingCellThresholds: reachable, ...extraProps } })
    await wrapper.find('[data-testid="unit-select"]').setValue('mm')
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

    await wrapper.find('[data-testid="unit-select"]').setValue('beads')
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

    await wrapper.find('[data-testid="technique-select"]').setValue('peyote')
    expect(wrapper.find(warningTestId).exists()).toBe(false) // peyote's threshold is 100,000

    await wrapper.find('[data-testid="technique-select"]').setValue('brick')
    expect(wrapper.find(warningTestId).exists()).toBe(false) // brick's threshold is 100,000

    await wrapper.find('[data-testid="technique-select"]').setValue('loom')
    expect(wrapper.find(warningTestId).exists()).toBe(true)
  })
})

describe('NewPatternForm size in beads (ticket 100)', () => {
  const messageTestId = '[data-testid="size-cap-message"]'
  const createButton = (wrapper: ReturnType<typeof mount>) => wrapper.find<HTMLButtonElement>('button[type="submit"]')
  const convertInput = (wrapper: ReturnType<typeof mount>) =>
    wrapper.find<HTMLInputElement>('[data-testid="convert-image-input"]')

  async function state(
    wrapper: ReturnType<typeof mount>,
    { unit, width, height, bead, technique }: { unit?: string; width: string; height: string; bead?: string; technique?: string },
  ) {
    if (bead) await wrapper.find('[data-testid="bead-select"]').setValue(bead)
    if (technique) await wrapper.find('[data-testid="technique-select"]').setValue(technique)
    if (unit) await wrapper.find('[data-testid="unit-select"]').setValue(unit)
    await wrapper.find('[data-testid="width-input"]').setValue(width)
    await wrapper.find('[data-testid="height-input"]').setValue(height)
  }

  it('offers beads first, then mm and cm, with the beads label in the interface language', () => {
    const wrapper = mount(NewPatternForm)

    const options = wrapper.findAll<HTMLOptionElement>('[data-testid="unit-select"] option')
    expect(options.map((option) => option.element.value)).toEqual(['beads', 'mm', 'cm'])
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

  it('accepts exactly 10,000 cells and refuses 10,001, in beads', async () => {
    const wrapper = mount(NewPatternForm)

    await state(wrapper, { width: '100', height: '100' })
    expect(createButton(wrapper).element.disabled).toBe(false)
    expect(wrapper.find(messageTestId).exists()).toBe(false)

    await state(wrapper, { width: '10001', height: '1' })
    expect(createButton(wrapper).element.disabled).toBe(true)
    expect(wrapper.find(messageTestId).exists()).toBe(true)

    await state(wrapper, { width: '10000', height: '1' })
    expect(createButton(wrapper).element.disabled).toBe(false)
  })

  it('limits the product, not either side: 500 x 10 is fine and 200 x 200 is not', async () => {
    const wrapper = mount(NewPatternForm)

    await state(wrapper, { width: '500', height: '10' })
    expect(createButton(wrapper).element.disabled).toBe(false)

    await state(wrapper, { width: '200', height: '200' })
    expect(createButton(wrapper).element.disabled).toBe(true)
  })

  it('says how many beads it is against the limit, in beads', async () => {
    const wrapper = mount(NewPatternForm)
    await wrapper.find('[data-testid="unit-select"]').setValue('beads')

    await state(wrapper, { width: '200', height: '200' })

    expect(wrapper.find(messageTestId).text()).toBe(
      ru.sizeCap.beads.replace('{count}', (40000).toLocaleString('ru')).replace('{limit}', (10000).toLocaleString('ru')),
    )
    expect(wrapper.find(messageTestId).attributes('role')).toBe('alert')
  })

  it('names the Bead and how tall the Pattern can be at this width, in cm', async () => {
    const wrapper = mount(NewPatternForm)
    const round = BEAD_CATALOG[1]!

    // 300 cm / 1.65mm = 182 columns, 100 cm / 2.2mm = 45 rows: 8,190 cells... so make it taller: 200 cm = 91 rows
    await state(wrapper, { unit: 'cm', bead: round.id, width: '30', height: '20' })
    expect(wrapper.find(messageTestId).exists()).toBe(true)

    const text = wrapper.find(messageTestId).text()
    expect(text).toContain('TOHO Round 11/0')
    expect(text).toContain(ru.form.unitCm)
    expect(text).not.toBe('')
    // 30cm = 182 columns, so up to floor(10,000 / 182) = 54 rows of 2.2mm = 118.8mm = 11.8cm.
    expect(text).toContain('11.8')
  })

  it('speaks in mm when the size is in mm', async () => {
    const wrapper = mount(NewPatternForm)

    await state(wrapper, { unit: 'mm', bead: BEAD_CATALOG[0]!.id, width: '300', height: '300' })

    expect(wrapper.find(messageTestId).text()).toContain(ru.form.unitMm)
    expect(wrapper.find(messageTestId).text()).not.toContain(ru.form.unitCm)
  })

  it('accepts the suggested maximum when it is typed back in', async () => {
    const wrapper = mount(NewPatternForm)
    await state(wrapper, { unit: 'cm', bead: BEAD_CATALOG[1]!.id, width: '30', height: '20' })
    const suggested = /(\d+\.?\d*)\s*см|(\d+\.?\d*)\s*cm/.exec(wrapper.find(messageTestId).text())!
    expect(suggested).not.toBeNull()

    await wrapper.find('[data-testid="height-input"]').setValue(suggested[1] ?? suggested[2]!)

    expect(wrapper.find(messageTestId).exists()).toBe(false)
    expect(createButton(wrapper).element.disabled).toBe(false)
  })

  it('judges mm/cm on the grid it converts to for the chosen Bead: the same size passes for one and not another', async () => {
    const wrapper = mount(NewPatternForm)
    const [cube, round, delica] = BEAD_CATALOG.map((bead) => bead.id)

    // 150mm x 150mm: Cube 100 x 100 = 10,000 (passes); Delica 94 x 115 = 10,810 (refused); Round 91 x 68 = 6,188.
    await state(wrapper, { unit: 'mm', bead: cube!, width: '150', height: '150' })
    expect(createButton(wrapper).element.disabled).toBe(false)

    await wrapper.find('[data-testid="bead-select"]').setValue(delica!)
    expect(createButton(wrapper).element.disabled).toBe(true)
    expect(wrapper.find(messageTestId).text()).toContain('Miyuki Delica 11/0')

    await wrapper.find('[data-testid="bead-select"]').setValue(round!)
    expect(createButton(wrapper).element.disabled).toBe(false)
    expect(wrapper.find(messageTestId).exists()).toBe(false)
  })

  it('re-checks when the unit, width or height changes', async () => {
    const wrapper = mount(NewPatternForm)
    await state(wrapper, { unit: 'mm', bead: BEAD_CATALOG[0]!.id, width: '150', height: '150' })
    expect(createButton(wrapper).element.disabled).toBe(false)

    await wrapper.find('[data-testid="width-input"]').setValue('152') // 101 columns
    expect(createButton(wrapper).element.disabled).toBe(true)

    await wrapper.find('[data-testid="unit-select"]').setValue('cm') // 152cm x 150cm: far over
    expect(createButton(wrapper).element.disabled).toBe(true)

    await wrapper.find('[data-testid="unit-select"]').setValue('beads') // 152 x 150 beads: still over
    expect(createButton(wrapper).element.disabled).toBe(true)

    await wrapper.find('[data-testid="width-input"]').setValue('50')
    await wrapper.find('[data-testid="height-input"]').setValue('50')
    expect(createButton(wrapper).element.disabled).toBe(false)
  })

  it('re-checks when the Technique changes, though the cap is the same for every Technique', async () => {
    const wrapper = mount(NewPatternForm)
    await state(wrapper, { width: '101', height: '100', technique: 'peyote' })
    expect(createButton(wrapper).element.disabled).toBe(true)

    await wrapper.find('[data-testid="technique-select"]').setValue('brick')
    expect(createButton(wrapper).element.disabled).toBe(true)
  })

  it('disables Convert image as well, so a refused size has no frame to fit a picture into', async () => {
    const wrapper = mount(NewPatternForm)
    await state(wrapper, { width: '100', height: '100' })
    expect(convertInput(wrapper).element.disabled).toBe(false)

    await state(wrapper, { width: '100', height: '101' })

    expect(convertInput(wrapper).element.disabled).toBe(true)
  })

  it('does not submit a refused size even when the form is submitted directly', async () => {
    const wrapper = mount(NewPatternForm)
    await state(wrapper, { width: '200', height: '200' })

    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('words its refusal in English too', async () => {
    const { en } = await import('../i18n/en')
    localStorage.setItem('bd-beads:locale', 'en')
    const wrapper = mount(NewPatternForm)

    await state(wrapper, { width: '200', height: '200' })

    expect(wrapper.find(messageTestId).text()).toBe("That's 40,000 beads; the limit is 10,000.")
    expect(en.form.unitBeads).toBe('beads')
    expect(wrapper.find('[data-testid="unit-select"] option').text()).toBe('beads')
  })
})
