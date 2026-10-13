import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BottomSheet from '../shell/BottomSheet.vue'
import PalettePicker from '../palette/PalettePicker.vue'
import ToolTiles from './ToolTiles.vue'

describe('pick controls and the sheet around them (ticket 397)', () => {
  it('a tool tile emits its tool and closes the sheet it sits in', async () => {
    const sheet = mount({
      components: { BottomSheet, ToolTiles },
      template: '<BottomSheet title="Tools" @close="$emit(\'closed\')"><ToolTiles active-tool="paint" @select="$emit(\'picked\', $event)" /></BottomSheet>',
    }, { attachTo: document.body })

    await sheet.get('[data-testid="sheet-tool-fill"]').trigger('click')

    expect(sheet.emitted('picked')).toEqual([['fill']])
    expect(sheet.emitted('closed')).toHaveLength(1)
    sheet.unmount()
  })

  it('a Palette swatch emits its color and closes the sheet', async () => {
    const sheet = mount({
      components: { BottomSheet, PalettePicker },
      template: '<BottomSheet title="Colors" @close="$emit(\'closed\')"><PalettePicker @select="$emit(\'picked\', $event)" /></BottomSheet>',
    }, { attachTo: document.body })

    await sheet.get('[data-color-id="blue"]').trigger('click')

    expect(sheet.emitted('picked')).toEqual([['blue']])
    expect(sheet.emitted('closed')).toHaveLength(1)
    sheet.unmount()
  })

  it('outside a sheet (the Toolbox) a pick just emits', async () => {
    const wrapper = mount(ToolTiles, { props: { activeTool: 'paint' } })

    await wrapper.get('[data-testid="sheet-tool-erase"]').trigger('click')

    expect(wrapper.emitted('select')).toEqual([['erase']])
  })
})

describe('ToolTiles in the Toolbox (ticket 384: the Toolbox and the phone Tool sheet share these tiles)', () => {
  it('uses a caller-chosen testid prefix in place of the sheet default', () => {
    const wrapper = mount(ToolTiles, { props: { activeTool: 'paint', testidPrefix: 'tool' } })
    expect(wrapper.find('[data-testid="tool-paint"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="sheet-tool-paint"]').exists()).toBe(false)
  })

  it('lights no tile while the Frame is being set (ticket 258)', () => {
    const wrapper = mount(ToolTiles, { props: { activeTool: 'paint', settingFrame: true, testidPrefix: 'tool' } })
    expect(wrapper.get('[data-testid="tool-paint"]').attributes('aria-pressed')).toBe('false')
  })

  it('sets tabindex from a given roving-focus function, or leaves it to the browser when none is given', () => {
    const withRoving = mount(ToolTiles, {
      props: { activeTool: 'paint', testidPrefix: 'tool', tabIndexFor: (selected: boolean) => (selected ? 0 : -1) },
    })
    expect(withRoving.get('[data-testid="tool-paint"]').attributes('tabindex')).toBe('0')
    expect(withRoving.get('[data-testid="tool-fill"]').attributes('tabindex')).toBe('-1')

    const withoutRoving = mount(ToolTiles, { props: { activeTool: 'paint', testidPrefix: 'tool' } })
    expect(withoutRoving.get('[data-testid="tool-fill"]').attributes('tabindex')).toBeUndefined()
  })
})
