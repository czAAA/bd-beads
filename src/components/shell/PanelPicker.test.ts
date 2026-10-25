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

  it('opens on the chosen item with Down, and on the last with Up', async () => {
    wrapper = mountPicker()
    await button().trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items()[1]!.element)
    await items()[1]!.trigger('keydown', { key: 'Escape' })
    await button().trigger('keydown', { key: 'ArrowUp' })
    expect(document.activeElement).toBe(items()[2]!.element)
  })

  it('moves with the arrows, wrapping, and with Home and End', async () => {
    wrapper = mountPicker()
    await button().trigger('keydown', { key: 'ArrowDown' })
    await items()[1]!.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items()[2]!.element)
    await items()[2]!.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items()[0]!.element)
    await items()[0]!.trigger('keydown', { key: 'End' })
    expect(document.activeElement).toBe(items()[2]!.element)
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
