import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { en } from '../i18n/en'
import CoffeeScreen from './CoffeeScreen.vue'

let mounted: VueWrapper | undefined
function screen(props: { phone?: boolean; shown?: boolean } = {}) {
  mounted = mount(CoffeeScreen, { props, attachTo: document.body })
  return mounted
}

beforeEach(() => localStorage.clear())
afterEach(() => mounted?.unmount())

describe('CoffeeScreen (tickets 0823, 0880)', () => {
  it("has the band with its row of chips, then What's new", () => {
    const wrapper = screen()
    const order = [...wrapper.get('[data-testid="homepage-coffee"]').element.children].map((el) => el.getAttribute('data-testid'))
    expect(order).toEqual(['homepage-coffee-band', 'homepage-whats-new'])
    expect(wrapper.find('[data-testid="homepage-coffee-band"] [data-testid="homepage-chips"]').exists()).toBe(true)
  })

  // What a chip and What's new do is in CoffeeChips.test.ts and WhatsNewFold.test.ts; the screen closes them again.
  const opened = (wrapper: VueWrapper) =>
    [...wrapper.findAll('[aria-expanded="true"]')].map((button) => button.attributes('data-testid') ?? button.element.closest('li')!.getAttribute('data-chip'))

  it("closes a chip and What's new once it is turned away, so they start closed each time it is shown", async () => {
    const wrapper = screen({ shown: true })
    await wrapper.get('[data-testid="homepage-chip-device"] button').trigger('click')
    await wrapper.get('[data-testid="homepage-whats-new-toggle"]').trigger('click')
    expect(opened(wrapper)).toEqual(['device', 'homepage-whats-new-toggle'])
    await wrapper.setProps({ shown: false })
    await wrapper.setProps({ shown: true })
    expect(opened(wrapper)).toEqual([])
  })
})

describe('CoffeeScreen on a phone (tickets 0827, 0880)', () => {
  it("lists the promises but Keyboard shortcuts under the band, then Open source and Say hello with their actions, then What's new", async () => {
    const wrapper = screen({ phone: true })
    expect(wrapper.find('[data-testid="homepage-chips"]').exists()).toBe(false)
    const list = wrapper.get('[data-testid="homepage-promises"]')
    expect(list.classes()).toContain('grouped-list')
    const rows = list.findAll('[data-testid^="homepage-promise-"]')
    expect(rows.map((row) => row.attributes('data-testid'))).toEqual(
      ['device', 'offline', 'noAds', 'pencil', 'free', 'openSource', 'sayHello'].map((id) => `homepage-promise-${id}`),
    )
    expect(rows[1].text()).toBe(`${en.homepage.promises.offline.name}. ${en.homepage.promises.offline.text}`)
    expect(rows[5].get('[data-testid="homepage-coffee-source"]').attributes('href')).toBe('https://github.com/czAAA/bd-beads')
    await rows[6].get('[data-testid="homepage-send-feedback"]').trigger('click')
    expect(wrapper.emitted('feedback')).toHaveLength(1)
    const order = [...wrapper.get('[data-testid="homepage-coffee"]').element.children].map((el) => el.getAttribute('data-testid'))
    expect(order).toEqual(['homepage-coffee-band', 'homepage-promises', 'homepage-whats-new'])
  })
})
