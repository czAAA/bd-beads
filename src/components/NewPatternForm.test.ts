import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import NewPatternForm from './NewPatternForm.vue'
import { BEAD_CATALOG } from '../domain/beads'

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
        technique: 'loom',
        beadId: BEAD_CATALOG[1]!.id,
        size: { width: 20, height: 30, unit: 'cm' },
      },
    ])
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
    expect(wrapper.find('[data-testid="technique-select"]').text()).toContain('Loom')
  })
})
