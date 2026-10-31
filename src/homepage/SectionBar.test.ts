import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SectionBar from './SectionBar.vue'

const NAMES = ["What's inside", 'Made by one family', 'Three ways to use it']

function bar(section = 0) {
  return mount(SectionBar, { props: { section, names: NAMES } })
}
const flaring = (wrapper: ReturnType<typeof bar>) =>
  wrapper.get('[data-testid="section-spark"]').classes().filter((name) => name.includes('flaring'))

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('SectionBar', () => {
  it('is the editor’s Progress bar: the counter, the section’s name, the track a third per section, Back and Next', () => {
    const wrapper = bar(1)
    expect(wrapper.find('[data-testid="section-bar"]').classes()).toContain('progress-bar')
    expect(wrapper.get('[data-testid="section-counter"]').text()).toBe('2/3')
    expect(wrapper.get('[data-testid="section-name"]').text()).toBe('Made by one family')
    const track = wrapper.get('[data-testid="section-track"]')
    expect(track.attributes()).toMatchObject({ role: 'progressbar', 'aria-label': 'Sections', 'aria-valuenow': '2', 'aria-valuemax': '3' })
    expect(track.attributes('aria-valuetext')).toBe('2/3 · Made by one family')
    expect(track.get('.progress-track__fill').attributes('style')).toContain(`translateX(${(2 / 3 - 1) * 100}%)`)
    expect(wrapper.get('[data-testid="section-back"]').text()).toBe('Back')
    expect(wrapper.get('[data-testid="section-back"]').classes()).toContain('app-button--box')
    expect(wrapper.get('[data-testid="section-next"]').text()).toBe('Next')
    expect(wrapper.get('[data-testid="section-next"]').classes()).toContain('app-button--primary')
  })

  it('asks for the section before and after, Back disabled on the first and Next on the last', async () => {
    const first = bar(0)
    expect(first.get('[data-testid="section-back"]').attributes('aria-disabled')).toBe('true')
    await first.get('[data-testid="section-next"]').trigger('click')
    expect(first.emitted('go')).toEqual([[1]])

    const last = bar(2)
    expect(last.get('[data-testid="section-next"]').attributes('aria-disabled')).toBe('true')
    await last.get('[data-testid="section-back"]').trigger('click')
    expect(last.emitted('go')).toEqual([[1]])
  })

  it('flares the spark on each step forward, restarting it, and not on a step back', async () => {
    const wrapper = bar(0)
    expect(flaring(wrapper)).toEqual([])
    await wrapper.setProps({ section: 1 })
    expect(flaring(wrapper)).toEqual(['progress-track__spark--flaring'])
    await wrapper.setProps({ section: 0 })
    expect(flaring(wrapper)).toEqual(['progress-track__spark--flaring'])
    await wrapper.setProps({ section: 1 })
    expect(flaring(wrapper)).toEqual(['progress-track__spark--flaring-alt'])
  })

  it('plays Pattern done’s burst at the track’s end on reaching the last section, then takes it away', async () => {
    const wrapper = bar(1)
    expect(wrapper.find('[data-testid="pattern-done"]').exists()).toBe(false)
    await wrapper.setProps({ section: 2 })
    expect(wrapper.get('[data-testid="section-track"] [data-testid="section-burst"] [data-testid="pattern-done"]').attributes('aria-hidden')).toBe('true')
    vi.advanceTimersByTime(2000)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="pattern-done"]').exists()).toBe(false)

    await wrapper.setProps({ section: 1 })
    expect(wrapper.find('[data-testid="pattern-done"]').exists()).toBe(false)
  })
})
