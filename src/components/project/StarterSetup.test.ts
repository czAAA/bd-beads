import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StarterSetup from './StarterSetup.vue'
import { starterById, type Starter } from '../../domain/starters'
import { en } from '../../i18n/en'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

const mountSetup = (starter: Starter) => mount(StarterSetup, { props: { starter } })
const value = (wrapper: ReturnType<typeof mountSetup>, testId: string) => wrapper.get(`[data-testid="${testId}"]`).text()

describe('the Starter setup', () => {
  it('shows a sample picture and says the Frame starts empty', () => {
    const wrapper = mountSetup(starterById('gerdan'))

    expect(wrapper.find('canvas.starter-picture').exists()).toBe(true)
    expect(wrapper.get('[data-testid="starter-sample-note"]').text()).toBe(en.starters.sampleNote)
  })

  it('names the Starter in the Name field and starts at its default size and Technique', () => {
    const wrapper = mountSetup(starterById('gerdan'))

    expect(wrapper.get('[data-testid="starter-name-input"]').attributes('placeholder')).toBe(en.starters.gerdan.name)
    expect(value(wrapper, 'starter-width-value')).toBe('24')
    expect(value(wrapper, 'starter-height-value')).toBe('80')
    expect(wrapper.get('[data-testid="starter-technique"] [aria-checked="true"]').text()).toBe('Loom')
  })

  it('offers only the Techniques the Starter can be woven in', () => {
    const wrapper = mountSetup(starterById('earrings'))

    expect(wrapper.findAll('[data-testid="starter-technique"] [role="radio"]').map((option) => option.text())).toEqual(['Peyote', 'Loom', 'Brick stitch'])
  })

  it('hides the Technique choice when there is only one', () => {
    const wrapper = mountSetup({ ...starterById('gerdan'), techniques: ['loom'] })

    expect(wrapper.find('[data-testid="starter-technique"]').exists()).toBe(false)
  })

  it('shows Brick block for brick stitch only', async () => {
    const wrapper = mountSetup(starterById('bag'))
    expect(wrapper.find('[data-testid="starter-brick-block"]').exists()).toBe(false)

    await wrapper.get('[data-testid="starter-technique"] [data-value="brick"]').trigger('click')
    expect(wrapper.find('[data-testid="starter-brick-block"]').exists()).toBe(true)
  })

  it('steps a side and sets it from a preset chip', async () => {
    const wrapper = mountSetup(starterById('bracelet'))

    await wrapper.get('[data-testid="starter-height-preset-110"]').trigger('click')
    expect(value(wrapper, 'starter-height-value')).toBe('110')
    expect(wrapper.get('[data-testid="starter-height-preset-110"]').attributes('aria-pressed')).toBe('true')

    await wrapper.get('[data-testid="starter-width-increase"]').trigger('pointerdown')
    await wrapper.get('[data-testid="starter-width-increase"]').trigger('pointerup')
    expect(value(wrapper, 'starter-width-value')).toBe('13')
  })

  it('holds a locked side: no stepper to move it, no chips, and a note', () => {
    const wrapper = mountSetup(starterById('earrings'))

    expect(wrapper.get('[data-testid="starter-width-fixed"]').text()).toBe(en.starters.fixedNote)
    expect(wrapper.find('[data-testid="starter-width-preset-10"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="starter-height-fixed"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="starter-width-increase"]').attributes('aria-disabled') ?? wrapper.get('[data-testid="starter-width-increase"]').attributes('disabled')).toBeDefined()
  })

  it('shows an Estimated size that follows the size and the unit, and shows the sizes in mm and cm on request', async () => {
    const wrapper = mountSetup(starterById('bracelet'))
    const before = value(wrapper, 'starter-estimate')
    expect(before).toContain(en.size.estimateLabel)

    await wrapper.get('[data-testid="starter-height-preset-110"]').trigger('click')
    expect(value(wrapper, 'starter-estimate')).not.toBe(before)

    await wrapper.get('[data-testid="starter-unit"] [data-value="mm"]').trigger('click')
    expect(wrapper.get('[data-testid="starter-width"]').text()).toContain(en.form.unitMm)
    await wrapper.get('[data-testid="starter-unit"] [data-value="cm"]').trigger('click')
    expect(wrapper.get('[data-testid="starter-width"]').text()).toContain(en.form.unitCm)
  })

  it('submits a Project input with the Frame size and the chosen Technique, named by what was typed', async () => {
    const wrapper = mountSetup(starterById('earrings'))
    await wrapper.get('[data-testid="starter-name-input"]').setValue('  Heron  ')
    await wrapper.get('[data-testid="starter-technique"] [data-value="brick"]').trigger('click')
    await wrapper.get('[data-testid="starter-height-preset-64"]').trigger('click')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')![0]![0]).toMatchObject({ name: 'Heron', technique: 'brick', size: { width: 10, height: 64, unit: 'beads' } })
  })

  it('names the Project after the Starter when no name was typed', async () => {
    const wrapper = mountSetup(starterById('bag'))
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')![0]![0]).toMatchObject({ name: en.starters.bag.name, technique: 'loom', size: { width: 20, height: 40 } })
  })
})
