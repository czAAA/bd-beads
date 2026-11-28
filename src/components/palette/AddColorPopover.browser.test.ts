import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, onUnmounted } from 'vue'
import { mountAt, unmountAll } from '../../testUtils/browserFit'
import AddColorPopover from './AddColorPopover.vue'

afterEach(unmountAll)

// With no Bead chooser the Bead colors tab is empty, the shortest it can be against Custom color.
// The anchor stands at the right, so the popover has room beside it and isn't stacked.
const Host = defineComponent(() => {
  const anchor = document.createElement('div')
  anchor.style.cssText = 'position: fixed; right: 0; bottom: 0; width: 100px; height: 100px'
  document.body.append(anchor)
  onUnmounted(() => anchor.remove())
  return () => h(AddColorPopover, { anchor })
})

describe('AddColorPopover height', () => {
  it('is as tall under either tab, so the tabs stay where they were pressed', async () => {
    const { root } = await mountAt(Host, {}, { locale: 'en', width: 1280 })
    const height = () => root.querySelector<HTMLElement>('.add-color__panels')!.getBoundingClientRect().height
    const before = height()

    root.querySelector<HTMLElement>('[data-testid="add-color-tabs"] [data-value="custom"]')!.click()
    await nextTick()

    expect(before).toBeGreaterThan(0)
    expect(height()).toBe(before)
  })
})
