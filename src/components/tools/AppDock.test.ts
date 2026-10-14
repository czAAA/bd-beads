import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AppDock from './AppDock.vue'
import { PALETTE } from '../../domain/palette'

describe('AppDock', () => {
  beforeEach(() => {
    localStorage.setItem('bd-beads:locale', 'en')
  })

  it('shows the active tool\'s own icon, name and hotkey on the first button', () => {
    const wrapper = mount(AppDock, { props: { activeTool: 'fill', openSheet: null } })
    const button = wrapper.get('[data-testid="dock-tool"]')
    expect(button.attributes('aria-label')).toBe('Fill')
    expect(button.get('.icon-btn__key').text()).toBe('2')
    expect(button.attributes('aria-keyshortcuts')).toBe('2')
  })

  it('has no Frame button (the Frame is edited on the canvas, ticket 417) and shows no key on the group buttons', () => {
    const wrapper = mount(AppDock, { props: { activeTool: 'paint', openSheet: null } })
    expect(wrapper.find('[data-testid="dock-frame"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="dock-color"] .icon-btn__key').exists()).toBe(false)
    expect(wrapper.find('[data-testid="dock-menu"] .icon-btn__key').exists()).toBe(false)
    expect(wrapper.find('[data-testid="dock-project"] .icon-btn__key').exists()).toBe(false)
  })

  it('marks whichever sheet is open, and emits select-sheet for each of the four', async () => {
    const wrapper = mount(AppDock, { props: { activeTool: 'paint', openSheet: 'project' } })
    expect(wrapper.get('[data-testid="dock-project"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="dock-tool"]').attributes('aria-pressed')).toBe('false')

    for (const id of ['tool', 'color', 'project', 'menu']) {
      await wrapper.get(`[data-testid="dock-${id}"]`).trigger('click')
    }
    expect(wrapper.emitted('select-sheet')).toEqual([['tool'], ['color'], ['project'], ['menu']])
  })

  it('has no input mode button without an input mode, and a first one with it (ticket 325)', async () => {
    expect(mount(AppDock, { props: { activeTool: 'paint', openSheet: null } }).find('[data-testid="dock-input-mode"]').exists()).toBe(false)

    const wrapper = mount(AppDock, { props: { activeTool: 'paint', openSheet: null, inputMode: 'pen' } })
    const buttons = wrapper.findAll('button')
    expect(buttons[0]!.attributes('data-testid')).toBe('dock-input-mode')
    expect(buttons[0]!.attributes('aria-label')).toBe('Pen mode')
    expect(buttons[0]!.attributes('aria-pressed')).toBe('true')

    await buttons[0]!.trigger('click')
    expect(wrapper.emitted('toggle-input-mode')).toHaveLength(1)
    expect(wrapper.emitted('select-sheet')).toBeUndefined()

    await wrapper.setProps({ inputMode: 'mouse' })
    expect(wrapper.get('[data-testid="dock-input-mode"]').attributes('aria-label')).toBe('Mouse mode')
    expect(wrapper.get('[data-testid="dock-input-mode"]').attributes('aria-pressed')).toBe('false')
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
