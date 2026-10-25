import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PanelPicker from './PanelPicker.vue'

const options = [
  { value: 'left', label: 'Left' },
  { value: 'top', label: 'Top' },
  { value: 'right', label: 'Right' },
]

function mountPicker(value = 'top') {
  return mount(PanelPicker, { props: { label: 'Tools position', options, modelValue: value, 'onUpdate:modelValue': (next: string) => void wrapper.setProps({ modelValue: next }) }, attachTo: document.body })
}
let wrapper: ReturnType<typeof mountPicker>
const button = () => wrapper.get('button[aria-haspopup]')
const items = () => wrapper.findAll('[role="menuitemradio"]')

describe('PanelPicker (ticket 0553)', () => {
  it('is named "{label}: {value}" and starts closed', () => {
    wrapper = mountPicker()
    expect(button().attributes('aria-label')).toBe('Tools position: Top')
    expect(button().attributes('aria-expanded')).toBe('false')
    expect(items()).toHaveLength(0)
  })

  it('opens a menu of radio items with the chosen one checked', async () => {
    wrapper = mountPicker()
    await button().trigger('click')
    expect(items().map((item) => [item.text(), item.attributes('aria-checked')])).toEqual([['Left', 'false'], ['Top', 'true'], ['Right', 'false']])
  })

  it('applies a choice at once and closes', async () => {
    wrapper = mountPicker()
    await button().trigger('click')
    await items()[2]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['right']])
    expect(button().attributes('aria-label')).toBe('Tools position: Right')
    expect(items()).toHaveLength(0)
  })

  it('leaves ↓ and ↑ to the panel: they do not open the list', async () => {
    wrapper = mountPicker()
    await button().trigger('keydown', { key: 'ArrowDown' })
    await button().trigger('keydown', { key: 'ArrowUp' })
    expect(items()).toHaveLength(0)
  })

  it('opens on the chosen item', async () => {
    wrapper = mountPicker()
    await button().trigger('click')
    expect(document.activeElement).toBe(items()[1]!.element)
  })

  it('moves with the arrows, wrapping, and with Home and End', async () => {
    wrapper = mountPicker()
    await button().trigger('click')
    await items()[1]!.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items()[2]!.element)
    await items()[2]!.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items()[0]!.element)
    await items()[0]!.trigger('keydown', { key: 'End' })
    expect(document.activeElement).toBe(items()[2]!.element)
  })

  it('opens with → and closes with ←, handing focus back to its button (ticket 563)', async () => {
    wrapper = mountPicker()
    await button().trigger('keydown', { key: 'ArrowLeft' })
    expect(items()).toHaveLength(0)
    await button().trigger('keydown', { key: 'ArrowRight' })
    expect(items()).toHaveLength(3)
    await items()[1]!.trigger('keydown', { key: 'ArrowLeft' })
    expect(items()).toHaveLength(0)
    expect(document.activeElement).toBe(button().element)
  })

  it('closes on Tab and carries on from its button (ticket 563)', async () => {
    wrapper = mountPicker()
    await button().trigger('click')
    await items()[1]!.trigger('keydown', { key: 'Tab' })
    expect(items()).toHaveLength(0)
    expect(document.activeElement).toBe(button().element)
  })

  it('closes on Escape alone, handing focus back to its button', async () => {
    wrapper = mountPicker()
    await button().trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(items()).toHaveLength(0)
    expect(document.activeElement).toBe(button().element)
  })
})

describe('PanelPicker bare and disabled (ticket 554)', () => {
  const options = [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }]

  it('drops the visible label but keeps the name', () => {
    const wrapper = mount(PanelPicker, { props: { label: 'Brand', modelValue: 'a', options, bare: true } })
    expect(wrapper.find('.panel-picker__label').exists()).toBe(false)
    expect(wrapper.get('button').attributes('aria-label')).toBe('Brand: Alpha')
  })

  it('does not open when disabled', async () => {
    const wrapper = mount(PanelPicker, { props: { label: 'Brand', modelValue: 'a', options, disabled: true } })
    await wrapper.get('button').trigger('click')
    await wrapper.get('button').trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.get('button').attributes('aria-disabled')).toBe('true')
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  })
})
