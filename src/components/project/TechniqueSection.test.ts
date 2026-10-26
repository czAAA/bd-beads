import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TechniqueSection from './TechniqueSection.vue'
import type { Technique } from '../../domain/weave'
import { choosePanelOption } from '../../testUtils/choosePanelOption'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

/** Controlled, as the parents are: a handler per model, so the section shows only what it is given. */
const mountSection = (technique: Technique, props: Record<string, unknown> = {}) =>
  mount(TechniqueSection, {
    props: { technique, brickBlock: 1, netSize: 3, testid: 'x', 'onUpdate:technique': () => {}, 'onUpdate:brickBlock': () => {}, 'onUpdate:netSize': () => {}, ...props },
  })

describe('TechniqueSection (ticket 568)', () => {
  it('shows the Brick block only for brick stitch and the Net size only for Netting', async () => {
    const wrapper = mountSection('loom')
    expect(wrapper.find('[data-testid="x-brick-block"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="x-net-size"]').exists()).toBe(false)

    await wrapper.setProps({ technique: 'brick' })
    expect(wrapper.find('[data-testid="x-brick-block"]').exists()).toBe(true)
    await wrapper.setProps({ technique: 'netting' })
    expect(wrapper.find('[data-testid="x-net-size"]').exists()).toBe(true)
  })

  it('reports each change and leaves what is shown to its parent', async () => {
    const wrapper = mountSection('brick')
    await choosePanelOption(wrapper, 'x-technique', 'peyote')
    expect(wrapper.emitted('update:technique')).toEqual([['peyote']])
    expect(wrapper.find('[data-testid="x-brick-block"]').exists()).toBe(true)
    await wrapper.get('[data-testid="x-brick-block-more"]').trigger('pointerdown')
    await wrapper.get('[data-testid="x-brick-block-more"]').trigger('pointerup')
    expect(wrapper.emitted('update:brickBlock')).toEqual([[2]])
    expect(wrapper.get('[data-testid="x-brick-block-value"]').text()).toBe('1')
  })

  it('turns every control off with its reason when disabled', () => {
    const wrapper = mountSection('brick', { disabled: true, techniqueDisabledBody: 'Rows are done.', brickBlockDisabledBody: 'Rows are done.' })
    expect(wrapper.get('[data-testid="x-technique"] button').attributes('aria-disabled')).toBe('true')
    expect(wrapper.get('[data-testid="x-brick-block-less"]').attributes('disabled')).toBeDefined()
  })
})
