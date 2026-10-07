import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ImageColorsButton from './ImageColorsButton.vue'
import { en } from '../../i18n/en'

beforeEach(() => localStorage.setItem('bd-beads:locale', 'en'))
afterEach(() => {
  document.body.innerHTML = ''
})

const colors = ['#ff0000', '#00ff00', '#0000ff']
const popover = (wrapper: ReturnType<typeof mount>) => wrapper.find('[role="dialog"]')
const shown = (wrapper: ReturnType<typeof mount>) => popover(wrapper).exists()

describe('ImageColorsButton (ticket 151)', () => {
  it('opens the popover of Image colors under it, focus on the chosen color', async () => {
    const wrapper = mount(ImageColorsButton, { props: { colors, selectedColor: '#00ff00' }, attachTo: document.body })
    const button = wrapper.find('[data-testid="image-colors-button"]')
    expect(shown(wrapper)).toBe(false)
    expect(button.attributes('aria-expanded')).toBe('false')

    await button.trigger('click')

    expect(shown(wrapper)).toBe(true)
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(document.activeElement?.getAttribute('data-color-hex')).toBe('#00ff00')
  })

  it('paints with a color and closes', async () => {
    const wrapper = mount(ImageColorsButton, { props: { colors }, attachTo: document.body })
    await wrapper.find('[data-testid="image-colors-button"]').trigger('click')

    await wrapper.find('[data-color-hex="#0000ff"]').trigger('click')

    expect(wrapper.emitted('select')).toEqual([['#0000ff']])
    expect(shown(wrapper)).toBe(false)
  })

  it('closes on Escape, focus back on the button, and on a press outside', async () => {
    const wrapper = mount(ImageColorsButton, { props: { colors }, attachTo: document.body })
    const button = wrapper.find('[data-testid="image-colors-button"]')
    await button.trigger('click')

    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(shown(wrapper)).toBe(false)
    expect(document.activeElement).toBe(button.element)

    await button.trigger('click')
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(shown(wrapper)).toBe(false)
  })

  it('is faint with no Image colors, opens nothing, and says why', async () => {
    const wrapper = mount(ImageColorsButton, { props: { colors: [] }, attachTo: document.body })
    const button = wrapper.find('[data-testid="image-colors-button"]')

    expect(button.attributes('aria-disabled')).toBe('true')
    await button.trigger('click')
    expect(shown(wrapper)).toBe(false)
    expect(wrapper.find('.app-tooltip__body').text()).toBe(en.tooltips.imageColorsDisabled)
  })
})
