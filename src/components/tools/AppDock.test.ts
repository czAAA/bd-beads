import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AppDock from './AppDock.vue'
import { PALETTE } from '../../domain/palette'

const TOOL_IDS = ['paint', 'fill', 'select', 'piece', 'erase', 'hand']

describe('AppDock', () => {
  beforeEach(() => {
    localStorage.setItem('bd-beads:locale', 'en')
  })

  it('holds the six tool tiles, the colour button and nothing else without an input mode (ticket 431)', () => {
    const wrapper = mount(AppDock, { props: { activeTool: 'paint', openSheet: null } })
    expect(wrapper.findAll('button').map((button) => button.attributes('data-testid'))).toEqual([...TOOL_IDS.map((id) => `dock-tool-${id}`), 'dock-color'])
    expect(wrapper.findAll('.dock__divider')).toHaveLength(1)
  })

  it('has no Project, Menu or Tool sheet slot: Menu and Project are in the Canvas strip', () => {
    const wrapper = mount(AppDock, { props: { activeTool: 'paint', openSheet: null } })
    for (const id of ['dock-tool', 'dock-project', 'dock-menu', 'dock-frame']) {
      expect(wrapper.find(`[data-testid="${id}"]`).exists()).toBe(false)
    }
  })

  it('shows each tool\'s icon, name and hotkey, lights the active one, and emits the tool picked', async () => {
    const wrapper = mount(AppDock, { props: { activeTool: 'fill', openSheet: null } })
    const fill = wrapper.get('[data-testid="dock-tool-fill"]')
    expect(fill.attributes('aria-label')).toBe('Fill')
    expect(fill.get('.icon-btn__key').text()).toBe('2')
    expect(fill.attributes('aria-keyshortcuts')).toBe('2')
    expect(fill.attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="dock-tool-paint"]').attributes('aria-pressed')).toBe('false')
    expect(wrapper.get('[data-testid="dock-tool-paint"] svg').attributes('data-icon')).toBe('paint')

    for (const id of TOOL_IDS) await wrapper.get(`[data-testid="dock-tool-${id}"]`).trigger('click')
    expect(wrapper.emitted('select-tool')).toEqual(TOOL_IDS.map((id) => [id]))
  })

  it('has no key on the colour button, marks it while its sheet is open, and emits select-sheet for it', async () => {
    const wrapper = mount(AppDock, { props: { activeTool: 'paint', openSheet: 'color' } })
    const color = wrapper.get('[data-testid="dock-color"]')
    expect(color.find('.icon-btn__key').exists()).toBe(false)
    expect(color.attributes('aria-pressed')).toBe('true')

    await color.trigger('click')
    expect(wrapper.emitted('select-sheet')).toEqual([['color']])
  })

  it('has no input mode button without an input mode, and a last one after a second divider with it (ticket 325)', async () => {
    expect(mount(AppDock, { props: { activeTool: 'paint', openSheet: null } }).find('[data-testid="dock-input-mode"]').exists()).toBe(false)

    const wrapper = mount(AppDock, { props: { activeTool: 'paint', openSheet: null, inputMode: 'pen' } })
    const buttons = wrapper.findAll('button')
    const last = buttons[buttons.length - 1]!
    expect(last.attributes('data-testid')).toBe('dock-input-mode')
    expect(last.attributes('aria-label')).toBe('Pen mode')
    expect(last.attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('.dock__divider')).toHaveLength(2)
    expect(wrapper.element.children[wrapper.element.children.length - 2]!.classList).toContain('dock__divider')

    await last.trigger('click')
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
})
