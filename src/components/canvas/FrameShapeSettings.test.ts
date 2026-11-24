import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FrameShapeSettings from './FrameShapeSettings.vue'
import { en } from '../../i18n/en'

function mountShape(props: Record<string, unknown> = {}) {
  return mount(FrameShapeSettings, { props: { frame: { shape: 'triangle' as const, settings: { rounds: 4 } }, ...props }, attachTo: document.body })
}

describe('FrameShapeSettings (tickets 0592, 0597, 1222)', () => {
  it('steps a size setting and says so', async () => {
    const wrapper = mountShape()
    expect(wrapper.get('[data-testid="frame-setting-rounds-value"]').text()).toBe('4')
    await wrapper.get('[data-testid="frame-setting-rounds-more"]').trigger('click')
    expect(wrapper.emitted('set-settings')).toEqual([[{ rounds: 5 }]])
  })

  it('holds the settings while locked, with the reason and Reset progress, which only asks (ticket 0848)', async () => {
    const wrapper = mountShape({ locked: true })
    expect(wrapper.get('[data-testid="frame-setting-rounds-more"]').attributes('aria-disabled')).toBe('true')
    expect(wrapper.get('[data-testid="frame-size-locked"]').text()).toBe(en.frame.sizeLockedLine)
    await wrapper.get('[data-testid="frame-size-locked-reset"]').trigger('click')
    expect(wrapper.emitted('reset-progress')).toHaveLength(1)
  })

  it('shows nothing for a Frame without a shape', () => {
    const wrapper = mountShape({ frame: { settings: {} } })
    expect(wrapper.find('[data-testid^="frame-setting-"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="frame-size-locked"]').exists()).toBe(false)
  })
})
