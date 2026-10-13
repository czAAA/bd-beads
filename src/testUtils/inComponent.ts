import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'

/**
 * Runs a composable inside a mounted component, so the lifecycle hooks it registers (`onBeforeUnmount`, ...) have an
 * instance to attach to. `stop` unmounts, which runs them. A composable that registers none can use `effectScope()`.
 */
export function runInComponent<T>(run: () => T): { result: T; stop: () => void } {
  let result!: T
  const wrapper = mount(
    defineComponent({
      setup() {
        result = run()
        return () => null
      },
    }),
  )
  return { result, stop: () => wrapper.unmount() }
}
