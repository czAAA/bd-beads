import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import PhoneBar from './PhoneBar.vue'

const SECTIONS = [
  { id: 'inside', heading: "What's inside" },
  { id: 'coffee', heading: 'Made by one family' },
  { id: 'plans', heading: 'Three ways to use it' },
]

function bar(section = 0) {
  return mount(PhoneBar, { props: { section, sections: SECTIONS }, slots: { default: () => h('button', { 'data-testid': 'way-in' }, 'Make your first Project') } })
}
const reached = (wrapper: ReturnType<typeof bar>) =>
  wrapper.findAll('[data-testid="phone-bar-segment"]').map((segment) => segment.classes().includes('phone-bar__segment--reached'))

beforeEach(() => localStorage.clear())

describe('PhoneBar (ticket 0827)', () => {
  it("names the section shown, its segments reached so far and its place, then ↑, the way in and ↓", () => {
    const wrapper = bar(1)
    expect(wrapper.get('[data-testid="phone-bar-name"]').text()).toBe('Made by one family')
    expect(reached(wrapper)).toEqual([true, true, false])
    expect(wrapper.get('[data-testid="phone-bar-counter"]').text()).toBe('2/3')
    expect(wrapper.get('[data-testid="phone-bar-track"]').attributes()).toMatchObject({
      role: 'progressbar',
      'aria-label': 'Sections',
      'aria-valuenow': '2',
      'aria-valuemax': '3',
      'aria-valuetext': '2/3 · Made by one family',
    })
    const moves = wrapper.get('.phone-bar__moves').findAll('button')
    expect(moves.map((move) => move.attributes('aria-label') ?? move.text())).toEqual(['Back', 'Make your first Project', 'Next'])
    expect(wrapper.get('[data-testid="phone-bar-back"] [data-icon]').attributes('data-icon')).toBe('arrow-up')
    expect(wrapper.get('[data-testid="phone-bar-next"] [data-icon]').attributes('data-icon')).toBe('arrow-down')
  })

  it('turns back and on with ↑ and ↓', async () => {
    const wrapper = bar(1)
    await wrapper.get('[data-testid="phone-bar-back"]').trigger('click')
    await wrapper.get('[data-testid="phone-bar-next"]').trigger('click')
    expect(wrapper.emitted('go')).toEqual([[0], [2]])
  })

  it('has ↑ disabled on the first section and ↓ on the last', async () => {
    const first = bar(0)
    expect(first.get('[data-testid="phone-bar-back"]').attributes('aria-disabled')).toBe('true')
    expect(first.get('[data-testid="phone-bar-next"]').attributes('aria-disabled')).toBeUndefined()
    await first.get('[data-testid="phone-bar-back"]').trigger('click')
    expect(first.emitted('go')).toBeUndefined()
    const last = bar(2)
    expect(last.get('[data-testid="phone-bar-next"]').attributes('aria-disabled')).toBe('true')
    expect(reached(last)).toEqual([true, true, true])
    await last.get('[data-testid="phone-bar-next"]').trigger('click')
    expect(last.emitted('go')).toBeUndefined()
  })
})
