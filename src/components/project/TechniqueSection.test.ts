import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TechniqueSection from './TechniqueSection.vue'
import type { Technique } from '../../domain/weave'
import { en } from '../../i18n/en'
import { choosePanelOption } from '../../testUtils/choosePanelOption'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

/** Controlled, as the parents are: a handler for the Technique, so the section shows only what it is given. */
const mountSection = (technique: Technique, props: Record<string, unknown> = {}) =>
  mount(TechniqueSection, { props: { technique, settings: {}, testid: 'x', 'onUpdate:technique': () => {}, ...props } })

describe('TechniqueSection (tickets 568, 0626)', () => {
  it('shows a stepper for each setting the Technique describes: the Brick block for brick stitch', async () => {
    const wrapper = mountSection('loom')
    expect(wrapper.find('[data-testid="x-brick-block"]').exists()).toBe(false)

    await wrapper.setProps({ technique: 'brick' })
    expect(wrapper.find('[data-testid="x-brick-block"]').exists()).toBe(true)
    await wrapper.setProps({ technique: 'peyote' })
    expect(wrapper.find('[data-testid="x-brick-block"]').exists()).toBe(false)
  })

  it('shows each setting at its value, or its default where it has none', () => {
    expect(mountSection('brick', { settings: { brickBlock: 7 } }).get('[data-testid="x-brick-block-value"]').text()).toBe('7')
    expect(mountSection('brick').get('[data-testid="x-brick-block-value"]').text()).toBe('1')
  })

  it('reports each change, a setting by its id, and leaves what is shown to its parent', async () => {
    const wrapper = mountSection('brick')
    await choosePanelOption(wrapper, 'x-technique', 'peyote')
    expect(wrapper.emitted('update:technique')).toEqual([['peyote']])
    expect(wrapper.find('[data-testid="x-brick-block"]').exists()).toBe(true)
    await wrapper.get('[data-testid="x-brick-block-more"]').trigger('pointerdown')
    await wrapper.get('[data-testid="x-brick-block-more"]').trigger('pointerup')
    expect(wrapper.emitted('set-setting')).toEqual([['brickBlock', 2]])
    expect(wrapper.get('[data-testid="x-brick-block-value"]').text()).toBe('1')
  })

  it('turns every control off when disabled, a setting with the reason its words give', async () => {
    const wrapper = mountSection('brick', { disabled: true, techniqueDisabledBody: 'Rows are done.' })
    expect(wrapper.get('[data-testid="x-technique"] button').attributes('aria-disabled')).toBe('true')
    expect(wrapper.get('[data-testid="x-brick-block-more"]').attributes('aria-disabled')).toBe('true')
    expect(wrapper.text()).toContain(en.weaveSettings.brickBlock!.locked)
  })
})
