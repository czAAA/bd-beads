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

  it('outside a sheet a pick just emits', async () => {
    const wrapper = mount(ToolTiles, { props: { activeTool: 'paint' } })

    await wrapper.get('[data-testid="sheet-tool-erase"]').trigger('click')

    expect(wrapper.emitted('select')).toEqual([['erase']])
  })

  it('lists Paint, Fill, Select, Piece, Select all, Erase, Hand in that order (ticket 414)', () => {
    const wrapper = mount(ToolTiles, { props: { activeTool: 'paint' } })

    expect(wrapper.findAll('button').map((tile) => tile.attributes('data-testid'))).toEqual([
      'sheet-tool-paint',
      'sheet-tool-fill',
      'sheet-tool-select',
      'sheet-tool-piece',
      'sheet-tool-select-all',
      'sheet-tool-erase',
      'sheet-tool-hand',
    ])
  })

  it('Select all acts at once: it emits select-all, never a tool, and is never marked selected', async () => {
    const wrapper = mount(ToolTiles, { props: { activeTool: 'select' } })
    const tile = wrapper.get('[data-testid="sheet-tool-select-all"]')

    await tile.trigger('click')

    expect(wrapper.emitted('select-all')).toHaveLength(1)
    expect(wrapper.emitted('select')).toBeUndefined()
    expect(tile.attributes('aria-pressed')).toBeUndefined()
    expect(wrapper.get('[data-testid="sheet-tool-select"]').attributes('aria-pressed')).toBe('true')
  })
})
