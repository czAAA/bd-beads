import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PatternCanvas from './PatternCanvas.vue'
import { createPattern } from '../domain/pattern'
import { BEAD_CATALOG } from '../domain/beads'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

function smallPattern() {
  // 10x10 at 20px/cell = 200x200, well within the 480x480 viewport.
  return createPattern({
    technique: 'loom',
    beadId: cubeBead.id,
    size: { width: 15, height: 15, unit: 'mm' },
  })
}

function largePattern() {
  // 30x30 at 20px/cell = 600x600, bigger than the 480x480 viewport -> fits at 80%.
  return createPattern({
    technique: 'loom',
    beadId: cubeBead.id,
    size: { width: 45, height: 45, unit: 'mm' },
  })
}

describe('PatternCanvas', () => {
  it('opens a pattern that already fits the viewport at 100%', () => {
    const wrapper = mount(PatternCanvas, { props: { pattern: smallPattern() } })

    expect(wrapper.find('[data-testid="zoom-level"]').text()).toBe('100%')
  })

  it('opens a pattern larger than the viewport zoomed out to fit', () => {
    const wrapper = mount(PatternCanvas, { props: { pattern: largePattern() } })

    expect(wrapper.find('[data-testid="zoom-level"]').text()).toBe('80%')
  })

  it('zooms in and out on click, within a sane range', async () => {
    const wrapper = mount(PatternCanvas, { props: { pattern: smallPattern() } })

    await wrapper.find('[data-testid="zoom-in"]').trigger('click')
    expect(wrapper.find('[data-testid="zoom-level"]').text()).toBe('125%')

    await wrapper.find('[data-testid="zoom-out"]').trigger('click')
    await wrapper.find('[data-testid="zoom-out"]').trigger('click')
    expect(wrapper.find('[data-testid="zoom-level"]').text()).toBe('75%')
  })

  it('does not zoom in past the maximum', async () => {
    const wrapper = mount(PatternCanvas, { props: { pattern: smallPattern() } })

    for (let i = 0; i < 20; i++) {
      await wrapper.find('[data-testid="zoom-in"]').trigger('click')
    }

    expect(wrapper.find('[data-testid="zoom-level"]').text()).toBe('300%')
  })

  it('does not zoom out past the minimum', async () => {
    const wrapper = mount(PatternCanvas, { props: { pattern: smallPattern() } })

    for (let i = 0; i < 20; i++) {
      await wrapper.find('[data-testid="zoom-out"]').trigger('click')
    }

    expect(wrapper.find('[data-testid="zoom-level"]').text()).toBe('25%')
  })

  it('resets zoom back to the fit level for the current pattern', async () => {
    const wrapper = mount(PatternCanvas, { props: { pattern: largePattern() } })

    await wrapper.find('[data-testid="zoom-in"]').trigger('click')
    expect(wrapper.find('[data-testid="zoom-level"]').text()).not.toBe('80%')

    await wrapper.find('[data-testid="zoom-reset"]').trigger('click')
    expect(wrapper.find('[data-testid="zoom-level"]').text()).toBe('80%')
  })

  it('re-fits zoom when switching to a different pattern', async () => {
    const wrapper = mount(PatternCanvas, { props: { pattern: smallPattern() } })
    expect(wrapper.find('[data-testid="zoom-level"]').text()).toBe('100%')

    await wrapper.setProps({ pattern: largePattern() })
    expect(wrapper.find('[data-testid="zoom-level"]').text()).toBe('80%')
  })
})
