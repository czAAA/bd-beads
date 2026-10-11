import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ConvertImageSizeDialog from './ConvertImageSizeDialog.vue'
import { findBead } from '../../domain/beads'
import { en } from '../../i18n/en'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
})

const cube = findBead('toho-cube-1.5mm')!

function open(props: Record<string, unknown> = {}) {
  return mount(ConvertImageSizeDialog, {
    props: { bead: cube, technique: 'loom', slowFramingCellThresholds: { loom: 5000, peyote: 5000, brick: 5000 }, ...props },
  })
}

async function fill(wrapper: ReturnType<typeof open>, width: string, height: string) {
  await wrapper.find('[data-testid="width-input"]').setValue(width)
  await wrapper.find('[data-testid="height-input"]').setValue(height)
}

const unit = (wrapper: ReturnType<typeof open>, value: string) =>
  wrapper.find(`[data-testid="convert-size-unit"] [data-value="${value}"]`).trigger('click')

describe('ConvertImageSizeDialog (ticket 342)', () => {
  it('states the size in beads by default and confirms it as typed', async () => {
    const wrapper = open()

    await fill(wrapper, '40', '30')
    await wrapper.find('[data-testid="convert-size-continue"]').trigger('click')

    expect(wrapper.emitted('confirm')).toEqual([[{ width: 40, height: 30, unit: 'beads' }]])
  })

  it('waits for both sizes, saying which is missing once a field has been left', async () => {
    const wrapper = open()

    expect(wrapper.find('[data-testid="convert-size-continue"]').attributes('aria-disabled')).toBe('true')
    await wrapper.find('[data-testid="width-input"]').setValue('10')
    await wrapper.find('[data-testid="height-input"]').trigger('blur')

    expect(wrapper.find('[data-testid="height-error"]').text()).toBe(en.form.enterHeight)
  })

  it('keeps only digits in beads, so a size is always whole beads', async () => {
    const wrapper = open()

    await fill(wrapper, '10', '2.5')

    expect((wrapper.find('[data-testid="height-input"]').element as HTMLInputElement).value).toBe('25')
  })

  it('takes mm, showing the bead count it rounds up to as the other unit', async () => {
    const wrapper = open()
    await unit(wrapper, 'mm')

    await fill(wrapper, '15.1', '30')

    // 15.1 / 1.5 is 10.07 beads: always up to the next whole bead.
    expect(wrapper.find('[data-testid="convert-size-estimate"]').text()).toBe('≈ 11×20 beads')
    await wrapper.find('[data-testid="convert-size-continue"]').trigger('click')
    expect(wrapper.emitted('confirm')).toEqual([[{ width: 15.1, height: 30, unit: 'mm' }]])
  })

  it('shows mm as the estimate while the unit is beads', async () => {
    const wrapper = open()

    await fill(wrapper, '10', '20')

    expect(wrapper.find('[data-testid="convert-size-estimate"]').text()).toBe('≈ 1.5 × 3.0 cm')
  })

  it('shares the unit with the Frame section through the device preference', async () => {
    const wrapper = open()
    await unit(wrapper, 'mm')

    expect(localStorage.getItem('bd-beads:size-unit')).toBe('mm')
  })

  it('warns that framing may be slow at a big size, naming the Technique', async () => {
    const wrapper = open()

    await fill(wrapper, '100', '49')
    expect(wrapper.find('[data-testid="convert-image-slow-framing-warning"]').exists()).toBe(false)

    await fill(wrapper, '100', '50')
    expect(wrapper.find('[data-testid="convert-image-slow-framing-warning"]').text()).toContain(en.form.techniqueLoom)
  })

  it('cancels with the Cancel button', async () => {
    const wrapper = open()

    await wrapper.find('[data-testid="convert-size-cancel"]').trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })
})
