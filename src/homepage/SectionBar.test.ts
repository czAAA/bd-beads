import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SectionBar from './SectionBar.vue'

const SECTIONS = [
  { id: 'inside', heading: "What's inside" },
  { id: 'coffee', heading: 'Made by one family' },
  { id: 'plans', heading: 'Three ways to use it' },
]

function bar(section = 0, sections = SECTIONS) {
  return mount(SectionBar, { props: { section, sections } })
}
const flaring = (wrapper: ReturnType<typeof bar>) =>
  wrapper.get('[data-testid="section-spark"]').classes().filter((name) => name.includes('flaring'))
const fill = (wrapper: ReturnType<typeof bar>) => wrapper.get('[data-testid="section-track"] .progress-track__fill').attributes('style')
const steps = (wrapper: ReturnType<typeof bar>) => wrapper.findAll('[data-testid="section-step"]')
const where = (wrapper: ReturnType<typeof bar>) => steps(wrapper).map((step) => step.attributes('style'))

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('SectionBar', () => {
  it('is the editor’s Progress bar: the counter, the track with a step per section, Back and Next, no name beside the counter', () => {
    const wrapper = bar(1)
    expect(wrapper.find('[data-testid="section-bar"]').classes()).toContain('progress-bar')
    expect(wrapper.get('[data-testid="section-counter"]').text()).toBe('2/3')
    expect(wrapper.find('[data-testid="section-name"]').exists()).toBe(false)
    const track = wrapper.get('[data-testid="section-track"]')
    expect(track.attributes()).toMatchObject({ role: 'progressbar', 'aria-label': 'Sections', 'aria-valuenow': '2', 'aria-valuemax': '3' })
    expect(track.attributes('aria-valuetext')).toBe('2/3 · Made by one family')
    expect(steps(wrapper).map((step) => step.text())).toEqual(["What's inside", 'Made by one family', 'Three ways to use it'])
    expect(wrapper.get('[data-testid="section-back"]').text()).toBe('Back')
    expect(wrapper.get('[data-testid="section-back"]').classes()).toContain('app-button--box')
    expect(wrapper.get('[data-testid="section-next"]').text()).toBe('Next')
    expect(wrapper.get('[data-testid="section-next"]').classes()).toContain('app-button--primary')
  })

  it('fills the track from empty on the first section to full on the last, reaching each step as it arrives', () => {
    expect(fill(bar(0))).toContain('translateX(-100%)')
    expect(fill(bar(1))).toContain('translateX(-50%)')
    expect(fill(bar(2))).toContain('translateX(0%)')
  })

  it('sets the steps the first at the track’s start, the last at its end, the rest evenly between', () => {
    expect(where(bar(0))).toEqual(['left: 0%;', 'left: 50%;', 'left: 100%;'])
    const five = bar(0, [...SECTIONS, { id: 'a', heading: 'A' }, { id: 'b', heading: 'B' }])
    expect(where(five)).toEqual(['left: 0%;', 'left: 25%;', 'left: 50%;', 'left: 75%;', 'left: 100%;'])
    expect(five.get('[data-testid="section-counter"]').text()).toBe('1/5')
    const two = bar(1, SECTIONS.slice(0, 2))
    expect(where(two)).toEqual(['left: 0%;', 'left: 100%;'])
    expect(fill(two)).toContain('translateX(0%)')
    expect(two.get('[data-testid="section-track"]').attributes('aria-valuemax')).toBe('2')
  })

  it('takes its steps’ order from the sections, a reordered list reordering them', () => {
    const wrapper = bar(0, [SECTIONS[2]!, SECTIONS[0]!, SECTIONS[1]!])
    expect(steps(wrapper).map((step) => step.text())).toEqual(['Three ways to use it', "What's inside", 'Made by one family'])
    expect(wrapper.get('[data-testid="section-track"]').attributes('aria-valuetext')).toBe('1/3 · Three ways to use it')
  })

  it('marks the steps passed, current and ahead, the current one a ring lit once the fill has started', async () => {
    const wrapper = bar(0)
    const state = () => steps(wrapper).map((step) => step.classes().filter((name) => /--(passed|current)$|is-lit/.test(name)).join(' '))
    expect(state()).toEqual(['step-dot--current', '', ''])
    await wrapper.setProps({ section: 1 })
    expect(state()).toEqual(['step-dot--passed', 'step-dot--current is-lit', ''])
    expect(steps(wrapper).map((step) => step.attributes('aria-current'))).toEqual([undefined, 'step', undefined])
  })

  it('names each step Go to its section, and a click on one asks for that section', async () => {
    const wrapper = bar(0)
    expect(steps(wrapper).map((step) => step.attributes('aria-label'))).toEqual([
      "Go to What's inside",
      'Go to Made by one family',
      'Go to Three ways to use it',
    ])
    await steps(wrapper)[2]!.trigger('click')
    expect(wrapper.emitted('go')).toEqual([[2]])
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

  it('flares the ring and the spark’s tail on each step forward, a jump of several once, and not on a step back', async () => {
    const wrapper = bar(0)
    const ring = () => wrapper.get('.step-dot--current').classes().filter((name) => name.startsWith('is-flaring'))
    expect(flaring(wrapper)).toEqual([])
    expect(ring()).toEqual([])
    await wrapper.setProps({ section: 2 })
    expect(flaring(wrapper)).toEqual(['progress-track__spark--flaring'])
    expect(ring()).toEqual(['is-flaring'])
    await wrapper.setProps({ section: 0 })
    expect(flaring(wrapper)).toEqual(['progress-track__spark--flaring'])
    await wrapper.setProps({ section: 1 })
    expect(flaring(wrapper)).toEqual(['progress-track__spark--flaring-alt'])
    expect(ring()).toEqual(['is-flaring-alt'])
  })

  it('draws the spark’s tail but not its dot: the current ring is the spark', () => {
    expect(bar(1).get('[data-testid="section-spark"]').classes()).toContain('progress-track__spark--ringed')
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
