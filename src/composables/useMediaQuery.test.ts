import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { fakeMatchMedia } from '../testUtils/fakeMatchMedia'
import { useMediaQuery } from './useMediaQuery'

/** A minimal host: useMediaQuery is a composable, so it needs a live component instance for its lifecycle hook. */
function mountHost(query: string, win: ReturnType<typeof fakeMatchMedia>) {
  return mount(
    defineComponent({
      setup() {
        return { matches: useMediaQuery(query, win) }
      },
      render() {
        return h('div', String(this.matches))
      },
    }),
  )
}

describe('useMediaQuery', () => {
  it('reads the query\'s current answer, live', async () => {
    const device = fakeMatchMedia({ '(max-width: 1023px)': false })
    const wrapper = mountHost('(max-width: 1023px)', device)

    expect(wrapper.vm.matches).toBe(false)

    device.set('(max-width: 1023px)', true)
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.matches).toBe(true)

    device.set('(max-width: 1023px)', false)
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.matches).toBe(false)
  })

  it('stops listening once unmounted', () => {
    const device = fakeMatchMedia({ '(max-width: 1023px)': false })
    const wrapper = mountHost('(max-width: 1023px)', device)

    wrapper.unmount()
    // No listener left to react to this; matches would otherwise flip via the destroyed component's own ref.
    device.set('(max-width: 1023px)', true)
  })
})
