import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TemplateSetup from './TemplateSetup.vue'
import { templateById, type Template } from '../../domain/templates'
import { en } from '../../i18n/en'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

const mountSetup = (template: Template) => mount(TemplateSetup, { props: { template } })
const value = (wrapper: ReturnType<typeof mountSetup>, testId: string) => wrapper.get(`[data-testid="${testId}"]`).text()

describe('the Template setup', () => {
  it('shows a sample picture and says the Frame starts empty', () => {
    const wrapper = mountSetup(templateById('gerdan'))

    expect(wrapper.find('canvas.template-picture').exists()).toBe(true)
    expect(wrapper.get('[data-testid="template-sample-note"]').text()).toBe(en.templates.sampleNote)
  })

  it('names the Template in the Name field and starts at its default size and Technique', () => {
    const wrapper = mountSetup(templateById('gerdan'))

    expect(wrapper.get('[data-testid="template-name-input"]').attributes('placeholder')).toBe(en.templates.gerdan.name)
    expect(value(wrapper, 'template-width-value')).toBe('24')
    expect(value(wrapper, 'template-height-value')).toBe('80')
    expect(wrapper.get('[data-testid="template-technique"] [aria-checked="true"]').text()).toBe('Loom')
  })

  it('offers only the Techniques the Template can be woven in', () => {
    const wrapper = mountSetup(templateById('earrings'))

    expect(wrapper.findAll('[data-testid="template-technique"] [role="radio"]').map((option) => option.text())).toEqual(['Peyote', 'Loom', 'Brick stitch'])
  })

  it('hides the Technique choice when there is only one', () => {
    const wrapper = mountSetup({ ...templateById('gerdan'), techniques: ['loom'] })

    expect(wrapper.find('[data-testid="template-technique"]').exists()).toBe(false)
  })

  it('shows Brick block for brick stitch only', async () => {
    const wrapper = mountSetup(templateById('bag'))
    expect(wrapper.find('[data-testid="template-brick-block"]').exists()).toBe(false)

    await wrapper.get('[data-testid="template-technique"] [data-value="brick"]').trigger('click')
    expect(wrapper.find('[data-testid="template-brick-block"]').exists()).toBe(true)
  })

  it('steps a side and sets it from a preset chip', async () => {
    const wrapper = mountSetup(templateById('bracelet'))

    await wrapper.get('[data-testid="template-height-preset-110"]').trigger('click')
    expect(value(wrapper, 'template-height-value')).toBe('110')
    expect(wrapper.get('[data-testid="template-height-preset-110"]').attributes('aria-pressed')).toBe('true')

    await wrapper.get('[data-testid="template-width-increase"]').trigger('pointerdown')
    await wrapper.get('[data-testid="template-width-increase"]').trigger('pointerup')
    expect(value(wrapper, 'template-width-value')).toBe('13')
  })

  it('holds a locked side: no stepper to move it, no chips, and a note', () => {
    const wrapper = mountSetup(templateById('earrings'))

    expect(wrapper.get('[data-testid="template-width-fixed"]').text()).toBe(en.templates.fixedNote)
    expect(wrapper.find('[data-testid="template-width-preset-10"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="template-height-fixed"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="template-width-increase"]').attributes('aria-disabled') ?? wrapper.get('[data-testid="template-width-increase"]').attributes('disabled')).toBeDefined()
  })

  it('shows an Estimated size that follows the size and the unit, and shows the sizes in mm and cm on request', async () => {
    const wrapper = mountSetup(templateById('bracelet'))
    const before = value(wrapper, 'template-estimate')
    expect(before).toContain(en.size.estimateLabel)

    await wrapper.get('[data-testid="template-height-preset-110"]').trigger('click')
    expect(value(wrapper, 'template-estimate')).not.toBe(before)

    await wrapper.get('[data-testid="template-unit"] [data-value="mm"]').trigger('click')
    expect(wrapper.get('[data-testid="template-width"]').text()).toContain(en.form.unitMm)
    await wrapper.get('[data-testid="template-unit"] [data-value="cm"]').trigger('click')
    expect(wrapper.get('[data-testid="template-width"]').text()).toContain(en.form.unitCm)
  })

  it('submits a Project input with the Frame size and the chosen Technique, named by what was typed', async () => {
    const wrapper = mountSetup(templateById('earrings'))
    await wrapper.get('[data-testid="template-name-input"]').setValue('  Heron  ')
    await wrapper.get('[data-testid="template-technique"] [data-value="brick"]').trigger('click')
    await wrapper.get('[data-testid="template-height-preset-64"]').trigger('click')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')![0]![0]).toMatchObject({ name: 'Heron', technique: 'brick', size: { width: 10, height: 64, unit: 'beads' } })
  })

  it('names the Project after the Template when no name was typed', async () => {
    const wrapper = mountSetup(templateById('bag'))
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')![0]![0]).toMatchObject({ name: en.templates.bag.name, technique: 'loom', size: { width: 20, height: 40 } })
  })
})
