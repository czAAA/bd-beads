import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { en } from '../i18n/en'
import CoffeeChips from './CoffeeChips.vue'

let mounted: VueWrapper | undefined
/** Something on the page outside the row. */
let outside: HTMLButtonElement
function row() {
  mounted = mount(CoffeeChips, { attachTo: document.body })
  return mounted
}

beforeEach(() => {
  localStorage.clear()
  outside = document.body.appendChild(document.createElement('button'))
})
afterEach(() => {
  mounted?.unmount()
  outside.remove()
})

const CHIPS = ['device', 'offline', 'noAds', 'pencil', 'free', 'shortcuts', 'openSource', 'sayHello']

describe('The chips under the band (ticket 0880)', () => {
  const chip = (wrapper: VueWrapper, id: string) => wrapper.get(`[data-testid="homepage-chip-${id}"]`)
  const toggle = (wrapper: VueWrapper, id: string) => chip(wrapper, id).get('button')
  const openOnes = (wrapper: VueWrapper) => CHIPS.filter((id) => toggle(wrapper, id).attributes('aria-expanded') === 'true')
  const hover = (wrapper: VueWrapper, id: string, type: 'pointerenter' | 'pointerleave') =>
    chip(wrapper, id).element.dispatchEvent(new PointerEvent(type, { pointerType: 'mouse' }))

  it('are the six promises, then Open source and Say hello, each an icon whose name and line a screen reader hears', () => {
    const wrapper = row()
    const items = wrapper.get('[data-testid="homepage-chips"]').findAll('li')
    expect(items.map((item) => item.attributes('data-testid'))).toEqual(CHIPS.map((id) => `homepage-chip-${id}`))
    expect(toggle(wrapper, 'offline').text()).toBe(`${en.homepage.promises.offline.name}. ${en.homepage.promises.offline.text}`)
    expect(toggle(wrapper, 'openSource').text()).toBe(`${en.homepage.openSource.name}. ${en.homepage.openSource.text}`)
    expect(toggle(wrapper, 'sayHello').text()).toContain(`${en.homepage.sayHello.name}. A bug, an idea`)
    expect(toggle(wrapper, 'offline').find('svg').exists()).toBe(true)
    expect(openOnes(wrapper)).toEqual([])
  })

  it('open on a mouse hover and close when it leaves; a touch passing over opens nothing', async () => {
    const wrapper = row()
    hover(wrapper, 'offline', 'pointerenter')
    await nextTick()
    expect(openOnes(wrapper)).toEqual(['offline'])
    hover(wrapper, 'offline', 'pointerleave')
    await nextTick()
    expect(openOnes(wrapper)).toEqual([])
    chip(wrapper, 'free').element.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'touch' }))
    await nextTick()
    expect(openOnes(wrapper)).toEqual([])
  })

  it('toggle on a click, one at a time, a clicked one staying open when the pointer leaves', async () => {
    const wrapper = row()
    await toggle(wrapper, 'noAds').trigger('click')
    expect(openOnes(wrapper)).toEqual(['noAds'])
    hover(wrapper, 'noAds', 'pointerleave')
    await nextTick()
    expect(openOnes(wrapper)).toEqual(['noAds'])
    await toggle(wrapper, 'pencil').trigger('click')
    expect(openOnes(wrapper)).toEqual(['pencil'])
    await toggle(wrapper, 'pencil').trigger('click')
    expect(openOnes(wrapper)).toEqual([])
  })

  it('keep a hovered one open when it is clicked, and close it on the second click', async () => {
    const wrapper = row()
    hover(wrapper, 'free', 'pointerenter')
    await toggle(wrapper, 'free').trigger('click')
    expect(openOnes(wrapper)).toEqual(['free'])
    await toggle(wrapper, 'free').trigger('click')
    expect(openOnes(wrapper)).toEqual([])
  })

  it('close a clicked one on a press outside the row, not on one inside it', async () => {
    const wrapper = row()
    await toggle(wrapper, 'device').trigger('click')
    wrapper.get('[data-testid="homepage-chips"]').element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await nextTick()
    expect(openOnes(wrapper)).toEqual(['device'])
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await nextTick()
    expect(openOnes(wrapper)).toEqual([])
  })

  it('open on focus, close on Escape, and close when the focus leaves', async () => {
    const wrapper = row()
    await toggle(wrapper, 'shortcuts').trigger('focus')
    expect(openOnes(wrapper)).toEqual(['shortcuts'])
    toggle(wrapper, 'shortcuts').element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(openOnes(wrapper)).toEqual([])
    await toggle(wrapper, 'offline').trigger('focus')
    await toggle(wrapper, 'offline').trigger('focusout', { relatedTarget: outside })
    expect(openOnes(wrapper)).toEqual([])
  })

  it('keep their action out of reach while closed', async () => {
    const wrapper = row()
    const action = () => chip(wrapper, 'openSource').get('.coffee-chip__more')
    expect(action().attributes('inert')).toBeDefined()
    await toggle(wrapper, 'openSource').trigger('click')
    expect(action().attributes('inert')).toBeUndefined()
  })

  it('link to the source from Open source, in a new tab', () => {
    const link = chip(row(), 'openSource').get('[data-testid="homepage-coffee-source"]')
    expect(link.element.tagName).toBe('A')
    expect(link.text()).toBe('View the source')
    expect(link.attributes('href')).toBe('https://github.com/czAAA/bd-beads')
    expect(link.attributes('target')).toBe('_blank')
  })

  it("ask for the Feedback sheet from Say hello's Send feedback, and not toggle it", async () => {
    const wrapper = row()
    await toggle(wrapper, 'sayHello').trigger('click')
    const button = chip(wrapper, 'sayHello').get('[data-testid="homepage-send-feedback"]')
    expect(button.text()).toBe(en.panels.menu.sendFeedback)
    await button.trigger('click')
    expect(wrapper.emitted('feedback')).toHaveLength(1)
    expect(openOnes(wrapper)).toEqual(['sayHello'])
  })

})
