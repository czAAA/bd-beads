import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AppDock from './AppDock.vue'
import { PALETTE } from '../../domain/palette'

describe('AppDock', () => {
  beforeEach(() => {
    localStorage.setItem('bd-beads:locale', 'en')
  })

  it('shows the active tool\'s own icon and name on the first button', () => {
    const wrapper = mount(AppDock, { props: { activeTool: 'fill', openSheet: null } })
    expect(wrapper.get('[data-testid="dock-tool"]').text()).toBe('Fill')
  })

  it('marks whichever sheet is open, and emits select-sheet for each of the five', async () => {
    const wrapper = mount(AppDock, { props: { activeTool: 'paint', openSheet: 'frame' } })
    expect(wrapper.get('[data-testid="dock-frame"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="dock-tool"]').attributes('aria-pressed')).toBe('false')

    for (const id of ['tool', 'color', 'edit', 'frame', 'project']) {
      await wrapper.get(`[data-testid="dock-${id}"]`).trigger('click')
    }
    expect(wrapper.emitted('select-sheet')).toEqual([['tool'], ['color'], ['edit'], ['frame'], ['project']])
  })

  it('has no Mirror sheet button left (ticket 174, pending its own redesign)', () => {
    const wrapper = mount(AppDock, { props: { activeTool: 'paint', openSheet: null } })

    expect(wrapper.find('[data-testid="dock-mirror"]').exists()).toBe(false)
  })

  it('shows the selected Palette color as the Colour button\'s swatch', () => {
    const wrapper = mount(AppDock, { props: { activeTool: 'paint', openSheet: null, selectedColorId: PALETTE[0]!.id } })
    expect((wrapper.get('.dock__swatch').element as HTMLElement).style.backgroundColor).not.toBe('')
  })

  it('draws the pencil for the Paint tool (ticket 249)', () => {
    const wrapper = mount(AppDock, { props: { activeTool: 'paint', openSheet: null } })
    expect(wrapper.get('[data-testid="dock-tool"] svg').attributes('data-icon')).toBe('paint')
  })
})
