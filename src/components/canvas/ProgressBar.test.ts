import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProgressBar from './ProgressBar.vue'

describe('ProgressBar (a page that goes by steps)', () => {
  it('is an empty bar with nothing in its slot (ticket 0748)', () => {
    const wrapper = mount(ProgressBar)

    expect(wrapper.find('[data-testid="progress-bar"]').element.children).toHaveLength(0)
  })

  it('is shielded from the page panning under a vertical touch drag', () => {
    const wrapper = mount(ProgressBar)

    expect(wrapper.find('[data-testid="progress-bar"]').classes()).toContain('no-page-pan')
  })

  it('is one Tab stop, ←/→ stepping along its controls and stopping at the ends (ticket 563, ADR 0075)', async () => {
    const wrapper = mount(ProgressBar, { slots: { default: '<button>one</button><button>two</button>' }, attachTo: document.body })
    const buttons = wrapper.findAll('button')
    expect(buttons.filter((button) => button.attributes('tabindex') === '0')).toHaveLength(1)

    ;(buttons[0]!.element as HTMLElement).focus()
    await buttons[0]!.trigger('keydown', { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(buttons[0]!.element)
    await buttons[0]!.trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(buttons[1]!.element)
    wrapper.unmount()
  })
})
