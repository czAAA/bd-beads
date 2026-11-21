import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { en } from '../i18n/en'
import CoffeePromises from './CoffeePromises.vue'

let mounted: VueWrapper | undefined
function promises() {
  mounted = mount(CoffeePromises, { attachTo: document.body })
  return mounted
}
afterEach(() => mounted?.unmount())

describe('The promises under the band (tickets 0880, 0948)', () => {
  it('show the seven promises by name in two rows, nothing to press, each with its line for screen readers (ticket 1175)', () => {
    const wrapper = promises()
    const ids = (selector: string) => wrapper.get(selector).findAll('li').map((item) => item.attributes('data-testid')!.replace('homepage-coffee-promise-', ''))
    expect(ids('[data-testid="homepage-coffee-promises-what"]')).toEqual(['device', 'offline', 'noAds', 'free'])
    expect(ids('[data-testid="homepage-coffee-promises-how"]')).toEqual(['tablets', 'mouse', 'shortcuts'])
    const items = wrapper.get('[data-testid="homepage-coffee-promises"]').findAll('li')
    expect(items[1].text()).toBe(`${en.homepage.promises.offline.name}. ${en.homepage.promises.offline.text}`)
    expect(wrapper.get('[data-testid="homepage-coffee-promises"]').find('button, a, [tabindex]').exists()).toBe(false)
  })

  it('then Open source and Say hello by name, each with its control in view', () => {
    const wrapper = promises()
    const acts = wrapper.get('[data-testid="homepage-coffee-acts"]').findAll('li')
    expect(acts.map((act) => act.get('.coffee-promise__name').text())).toEqual([en.homepage.openSource.name, en.homepage.sayHello.name])
    expect(acts[0].text()).toContain(`${en.homepage.openSource.name}. ${en.homepage.openSource.text}`)
    expect(acts[1].text()).toContain(`${en.homepage.sayHello.name}. A bug, an idea`)
  })

  it('link to the source from Open source, in a new tab', () => {
    const link = promises().get('[data-testid="homepage-coffee-act-openSource"] [data-testid="homepage-coffee-source"]')
    expect(link.element.tagName).toBe('A')
    expect(link.text()).toBe('View the source')
    expect(link.attributes('href')).toBe('https://github.com/czAAA/bd-beads')
    expect(link.attributes('target')).toBe('_blank')
  })

  it("ask for the Feedback sheet from Say hello's Send feedback", async () => {
    const wrapper = promises()
    const button = wrapper.get('[data-testid="homepage-coffee-act-sayHello"] [data-testid="homepage-send-feedback"]')
    expect(button.text()).toBe(en.panels.menu.sendFeedback)
    await button.trigger('click')
    expect(wrapper.emitted('feedback')).toHaveLength(1)
  })
})
