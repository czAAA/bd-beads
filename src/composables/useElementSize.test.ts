import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { FakeResizeObserver } from '../testUtils/fakeResizeObserver'
import { useElementSize } from './useElementSize'

/** A minimal host component: useElementSize is a composable, so it needs a live component instance (lifecycle
 *  hooks) to run inside, same as it will in PatternCanvas's parent. */
function mountHost(showTarget = true) {
  return mount(
    defineComponent({
      setup() {
        const target = ref<HTMLElement | null>(null)
        const { width, height } = useElementSize(target)
        return { target, width, height, showTarget: ref(showTarget) }
      },
      render() {
        return h('div', [this.showTarget ? h('div', { ref: 'target' }) : null])
      },
    }),
  )
}

describe('useElementSize', () => {
  beforeEach(() => {
    FakeResizeObserver.reset()
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports zero before the observer has reported a size', () => {
    const wrapper = mountHost()

    expect(wrapper.vm.width).toBe(0)
    expect(wrapper.vm.height).toBe(0)
  })

  it('reports the size the observer reports, and updates on a later resize', async () => {
    const wrapper = mountHost()
    await nextTick()

    const observer = FakeResizeObserver.instances[0]!
    observer.trigger(640, 320)
    await nextTick()
    expect(wrapper.vm.width).toBe(640)
    expect(wrapper.vm.height).toBe(320)

    observer.trigger(800, 400)
    await nextTick()
    expect(wrapper.vm.width).toBe(800)
    expect(wrapper.vm.height).toBe(400)
  })

  it('falls back to 0x0 when ResizeObserver is not available in the environment', async () => {
    vi.stubGlobal('ResizeObserver', undefined)
    const wrapper = mountHost()
    await nextTick()

    expect(wrapper.vm.width).toBe(0)
    expect(wrapper.vm.height).toBe(0)
  })
})
