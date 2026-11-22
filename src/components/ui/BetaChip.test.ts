import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import BetaChip from './BetaChip.vue'
import { provideBetaFeedback } from '../../composables/ui/betaFeedback'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

afterEach(() => {
  document.body.innerHTML = ''
  vi.useRealTimers()
})

/** A chip inside a button, under a shell that hands its Feedback sheet down. */
function inButton(send?: (subject: string) => void, feature: 'convertImage' | 'customFrames' = 'convertImage') {
  const pressed = vi.fn()
  const Host = defineComponent({
    setup() {
      if (send) provideBetaFeedback(send)
      return () => h('button', { type: 'button', onClick: pressed }, ['Convert image', h(BetaChip, { feature, name: 'Convert image' })])
    },
  })
  return { wrapper: mount(Host, { attachTo: document.body }), pressed }
}

const popover = (wrapper: ReturnType<typeof inButton>['wrapper']) => ({ isVisible: () => wrapper.find('[data-testid="beta-popover"]').exists() })

describe('BetaChip', () => {
  it('says Beta and keeps its popover closed', () => {
    const { wrapper } = inButton()
    expect(wrapper.get('[data-testid="beta-chip"]').text()).toBe('Beta')
    expect(popover(wrapper).isVisible()).toBe(false)
  })

  it('opens on a mouse hover and closes a moment after the pointer leaves', async () => {
    vi.useFakeTimers()
    const { wrapper } = inButton()
    await wrapper.get('.beta-chip').trigger('pointerenter', { pointerType: 'mouse' })
    expect(popover(wrapper).isVisible()).toBe(true)
    await wrapper.get('.beta-chip').trigger('pointerleave')
    expect(popover(wrapper).isVisible()).toBe(true)
    vi.advanceTimersByTime(300)
    await wrapper.vm.$nextTick()
    expect(popover(wrapper).isVisible()).toBe(false)
  })

  it('opens on keyboard focus and closes when focus leaves it', async () => {
    const { wrapper } = inButton()
    await wrapper.get('[data-testid="beta-chip"]').trigger('focusin')
    expect(popover(wrapper).isVisible()).toBe(true)
    await wrapper.get('.beta-chip').trigger('focusout', { relatedTarget: document.body })
    expect(popover(wrapper).isVisible()).toBe(false)
  })

  it('opens on a tap and closes on the next, without pressing the button around it', async () => {
    const { wrapper, pressed } = inButton()
    await wrapper.get('[data-testid="beta-chip"]').trigger('click')
    expect(popover(wrapper).isVisible()).toBe(true)
    await wrapper.get('[data-testid="beta-chip"]').trigger('click')
    expect(popover(wrapper).isVisible()).toBe(false)
    expect(pressed).not.toHaveBeenCalled()
  })

  it('keeps the popover a hover or focus opened when the click that follows it comes', async () => {
    const { wrapper } = inButton()
    await wrapper.get('[data-testid="beta-chip"]').trigger('focusin')
    await wrapper.get('[data-testid="beta-chip"]').trigger('click')
    expect(popover(wrapper).isVisible()).toBe(true)
  })

  it('closes on Escape', async () => {
    const { wrapper } = inButton()
    await wrapper.get('[data-testid="beta-chip"]').trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(popover(wrapper).isVisible()).toBe(false)
  })

  it('Send feedback asks for the Feedback sheet with the feature and "(beta)", and closes', async () => {
    const send = vi.fn()
    const { wrapper, pressed } = inButton(send)
    await wrapper.get('[data-testid="beta-chip"]').trigger('click')
    await wrapper.get('[data-testid="beta-send-feedback"]').trigger('click')
    expect(send).toHaveBeenCalledWith('Convert image (beta)')
    expect(popover(wrapper).isVisible()).toBe(false)
    expect(pressed).not.toHaveBeenCalled()
  })

  it('offers no Send feedback where no sheet is handed down', async () => {
    const { wrapper } = inButton()
    await wrapper.get('[data-testid="beta-chip"]').trigger('click')
    expect(wrapper.find('[data-testid="beta-send-feedback"]').exists()).toBe(false)
  })
})
