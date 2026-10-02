import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import LoadingState from './LoadingState.vue'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('LoadingState (ticket 158)', () => {
  it('shows nothing for a wait under the loading delay, then the beads and what is happening', async () => {
    const wrapper = mount(LoadingState, { props: { text: 'Making the PDF · Fox' } })
    expect(wrapper.find('[data-testid="loading"]').exists()).toBe(false)

    await vi.advanceTimersByTimeAsync(299)
    expect(wrapper.find('[data-testid="loading"]').exists()).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    const loading = wrapper.find('[data-testid="loading"]')
    expect(loading.attributes('role')).toBe('status')
    expect(loading.text()).toBe('Making the PDF · Fox')
    expect(loading.findAll('.loading__bead')).toHaveLength(3)
  })

  it('shows the progress track instead when the share done is known', async () => {
    const wrapper = mount(LoadingState, { props: { text: 'Converting the picture · 62%', share: 0.62 } })
    await vi.advanceTimersByTimeAsync(300)

    expect(wrapper.findAll('.loading__bead')).toHaveLength(0)
    expect(wrapper.find('.loading__fill').attributes('style')).toContain('width: 62%')
  })

  it('never appears for a wait that ends first', async () => {
    const wrapper = mount(LoadingState, { props: { text: 'Reading the picture' } })
    await vi.advanceTimersByTimeAsync(100)
    wrapper.unmount()

    await vi.advanceTimersByTimeAsync(1000)
    expect(document.body.textContent).not.toContain('Reading the picture')
  })
})
