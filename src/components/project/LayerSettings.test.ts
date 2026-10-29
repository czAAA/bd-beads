import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { findBead } from '../../domain/beads'
import { en } from '../../i18n/en'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import LayerSettings from './LayerSettings.vue'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
  document.documentElement.dataset.theme = 'light'
  useCanvasBackground().remember(1)
})

const delica = findBead('miyuki/delica/11-0')!
const base = { layer: 'frame' as const, technique: 'brick' as const, techniqueSettings: { brickBlock: 3 }, bead: delica, beadShape: 'symmetric' as const, background: 1, testid: 'x' }
const mountSettings = (props: Record<string, unknown> = {}) => mount(LayerSettings, { props: { ...base, ...props }, attachTo: document.body })

describe('LayerSettings (ADR 0079, ticket 0670)', () => {
  it('sets the Technique and its settings, then the Bead and its shape, then the Background, each headed', () => {
    const wrapper = mountSettings()
    const order = ['x-technique', 'x-brick-block', 'bead-shape', 'bead-brand', 'frame-background-picker']
    const html = wrapper.html()
    const positions = order.map((id) => html.indexOf(`data-testid="${id}"`))
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(wrapper.findAll('[role="group"][aria-labelledby]').map((group) => document.getElementById(group.attributes('aria-labelledby')!)?.textContent)).toEqual(
      expect.arrayContaining([en.panels.project.bead, en.layerSettings.background]),
    )
    expect(wrapper.get('[data-testid="x-brick-block-value"]').text()).toBe('3')
  })

  it('asks for each change and shows only what it is given', async () => {
    const wrapper = mountSettings()
    await wrapper.get('[data-testid="x-technique"] button').trigger('click')
    await wrapper.get('[data-testid="x-technique"] [data-value="peyote"]').trigger('click')
    await wrapper.get('[data-testid="x-brick-block-more"]').trigger('click')
    await wrapper.get('[data-testid="bead-shape"] [data-value="real"]').trigger('click')
    await wrapper.get('[data-testid="bead-size"] button').trigger('click')
    await wrapper.get('[data-testid="bead-size"] [data-value="miyuki/delica/15-0"]').trigger('click')
    await wrapper.get('[data-testid="background-color-linen"]').trigger('click')
    expect(wrapper.emitted('set-technique')).toEqual([['peyote']])
    expect(wrapper.emitted('set-setting')).toEqual([['brickBlock', 4]])
    expect(wrapper.emitted('set-bead-shape')).toEqual([['real']])
    expect(wrapper.emitted('pick-bead')).toEqual([['miyuki/delica/15-0']])
    expect(wrapper.emitted('set-background')).toEqual([[2]])
    expect(wrapper.get('[data-testid="x-technique"] button').attributes('aria-label')).toBe('Technique: Brick stitch')
  })

  it('offers only the Techniques given', async () => {
    const wrapper = mountSettings({ technique: 'peyote', techniques: ['peyote'] })
    await wrapper.get('[data-testid="x-technique"] button').trigger('click')
    expect(wrapper.findAll('[data-testid="x-technique"] [role="menuitemradio"]').map((item) => item.attributes('data-value'))).toEqual(['peyote'])
  })

  it('holds the Technique, its settings and a shape\'s settings while locked, with the reason, never the Bead, its shape or the Background', () => {
    const wrapper = mountSettings({ locked: true, frame: { shape: 'triangle', settings: { rounds: 4 } } })
    expect(wrapper.get('[data-testid="x-technique"] button').attributes('aria-disabled')).toBe('true')
    expect(wrapper.get('[data-testid="frame-setting-rounds-more"]').attributes('aria-disabled')).toBe('true')
    expect(wrapper.get('[data-testid="frame-size-locked"]').text()).toBe(en.frame.sizeLockedLine)
    expect(wrapper.get('[data-testid="bead-size"] button').attributes('aria-disabled')).toBeUndefined()
    expect(wrapper.get('[data-testid="bead-shape"] [data-value="real"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('[data-testid="frame-background-picker"] [aria-disabled="true"]').exists()).toBe(false)
  })

  it('shows no shape settings for a layer without a Frame shape', () => {
    expect(mountSettings({ frame: { settings: {} } }).find('[data-testid^="frame-setting-"]').exists()).toBe(false)
    expect(mountSettings().find('[data-testid="frame-size-locked"]').exists()).toBe(false)
  })
})
