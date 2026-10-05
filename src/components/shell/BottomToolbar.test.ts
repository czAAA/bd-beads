import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BottomToolbar from './BottomToolbar.vue'
import { PALETTE } from '../../domain/palette'

function mountBar(props: Partial<InstanceType<typeof BottomToolbar>['$props']> = {}) {
  return mount(BottomToolbar, {
    attachTo: document.body,
    props: { activeTool: 'paint', canUndo: true, canRedo: false, ...props },
  })
}

describe('BottomToolbar', () => {
  beforeEach(() => {
    localStorage.setItem('bd-beads:locale', 'en')
  })

  it('marks the active tool and selects another on click', async () => {
    const wrapper = mountBar()
    expect(wrapper.get('[data-testid="bottom-toolbar-paint"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="bottom-toolbar-erase"]').attributes('aria-pressed')).toBe('false')

    await wrapper.get('[data-testid="bottom-toolbar-erase"]').trigger('click')
    expect(wrapper.emitted('select-tool')).toEqual([['erase']])
  })

  it('shows the Toolbox\'s own six tools with their hotkey corners, and starts Set Frame from the Frame tool', async () => {
    const wrapper = mountBar()
    const badges = wrapper.findAll('[data-testid^="bottom-toolbar-"] .tool-button__key').map((badge) => badge.text())
    expect(badges).toEqual(['1', '2', '3', '4', '5', '6'])

    await wrapper.get('[data-testid="bottom-toolbar-frame"]').trigger('click')
    expect(wrapper.emitted('start-frame')).toHaveLength(1)
  })

  it('marks the Frame tool active while the Frame is being set', () => {
    const wrapper = mountBar({ settingFrame: true })
    expect(wrapper.get('[data-testid="bottom-toolbar-frame"]').attributes('aria-pressed')).toBe('true')
  })

  it('undoes and redoes, disabled exactly when the props say so', async () => {
    const wrapper = mountBar({ canUndo: true, canRedo: false })
    expect(wrapper.get('[data-testid="bottom-toolbar-undo"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-testid="bottom-toolbar-redo"]').attributes('disabled')).toBeDefined()

    await wrapper.get('[data-testid="bottom-toolbar-undo"]').trigger('click')
    expect(wrapper.emitted('undo')).toHaveLength(1)
  })

  it('shows the selected Palette color as the swatch', () => {
    const wrapper = mountBar({ selectedColorId: PALETTE[0]!.id })
    expect((wrapper.get('.bottom-toolbar__swatch').element as HTMLElement).style.backgroundColor).not.toBe('')
  })

  it('opens a Palette popover from the colour button, picks a color, and closes', async () => {
    const wrapper = mountBar()
    expect(wrapper.find('[data-testid="palette-picker"]').exists()).toBe(false)

    await wrapper.get('[data-testid="bottom-toolbar-color"]').trigger('click')
    expect(wrapper.find('[data-testid="palette-picker"]').exists()).toBe(true)

    await wrapper.get('[data-testid="palette-swatch"]').trigger('click')
    expect(wrapper.emitted('select-color')![0]).toEqual([PALETTE[0]!.id])
    expect(wrapper.find('[data-testid="palette-picker"]').exists()).toBe(false)
  })

  it('closes the popover on Escape', async () => {
    const wrapper = mountBar()
    await wrapper.get('[data-testid="bottom-toolbar-color"]').trigger('click')
    expect(wrapper.find('[data-testid="palette-picker"]').exists()).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="palette-picker"]').exists()).toBe(false)
  })
})
