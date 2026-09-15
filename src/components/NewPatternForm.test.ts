import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import NewPatternForm from './NewPatternForm.vue'
import { BEAD_CATALOG } from '../domain/beads'
import { ru } from '../i18n/ru'

beforeEach(() => {
  localStorage.clear()
})

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
