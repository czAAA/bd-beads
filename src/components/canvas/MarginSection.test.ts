import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { PREFERENCES } from '../../services/devicePreferences'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import MarginSection from './MarginSection.vue'

function setTheme(theme: 'light' | 'dark' | 'contrast') {
  document.documentElement.dataset.theme = theme
}

const mounted: ReturnType<typeof mount>[] = []
function render() {
  const wrapper = mount(MarginSection, { attachTo: document.body })
  mounted.push(wrapper)
  return wrapper
}

async function flush() {
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve))
}

const radios = (wrapper: ReturnType<typeof render>) => wrapper.findAll('[role="radio"]')

beforeEach(() => {
  localStorage.setItem('openbeads:locale', 'en')
  for (const name of ['canvasBackground', 'canvasCustomColor', 'marginColor', 'marginCustomColor', 'marginTitleBlock', 'panelSectionsClosed'] as const) localStorage.removeItem(PREFERENCES[name].key)
  setTheme('light')
  useCanvasBackground().setChoice(1)
  useCanvasBackground().margin.setChoice('auto')
})

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
})

describe('MarginSection (tickets 0656, 0657, MarginSheet card)', () => {
  it('offers Auto, then the theme\'s five Canvas colors, then Custom color, with Auto chosen and the Canvas color dotted', () => {
    const wrapper = render()
    expect(wrapper.get('[role="radiogroup"]').attributes('aria-label')).toBe('Margin color')
    expect(radios(wrapper).map((r) => r.attributes('aria-label'))).toEqual([
      'Auto, one step off the Canvas color',
      'Studio, the Canvas color',
      'Linen, 2 of 5',
      'Stone, 3 of 5',
      'Fog, 4 of 5',
      'Pebble, 5 of 5',
    ])
    expect(radios(wrapper).map((r) => r.attributes('aria-checked'))).toEqual(['true', 'false', 'false', 'false', 'false', 'false'])
    expect(wrapper.find('[data-testid="custom-color-button"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="background-color-studio"]').find('[data-testid="background-color-dot"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="background-color-name"]').text()).toBe('Auto #eeeeee')
    expect(wrapper.get('[data-testid="margin-line"]').text()).toBe('The margin is 4 beads on every side. Nothing can be placed in it, and exports never show it.')
  })

  it('follows the Canvas color with Auto, on the swatch and on the sheet', async () => {
    const wrapper = render()
    useCanvasBackground().setChoice(2)
    await flush()
    expect(wrapper.get('[data-testid="background-color-name"]').text()).toBe('Auto #ebe7e0')
    expect(radios(wrapper)[2].attributes('aria-label')).toBe('Linen, the Canvas color')
    expect(useCanvasBackground().projectTheme.value.margin.fill).toBe('#ebe7e0')
  })

  it('stores the position of a Canvas color picked, and keeps it when the theme changes', async () => {
    const wrapper = render()
    await wrapper.get('[data-testid="background-color-stone"]').trigger('click')
    expect(localStorage.getItem(PREFERENCES.marginColor.key)).toBe('3')
    expect(useCanvasBackground().projectTheme.value.margin.fill).toBe('#e6e3de')

    setTheme('dark')
    await flush()
    expect(radios(wrapper)[3].attributes('aria-checked')).toBe('true')
    expect(useCanvasBackground().projectTheme.value.margin.fill).toBe('#12161c')
  })

  it('stores a Custom color taken, and goes back to Auto', async () => {
    const wrapper = render()
    await wrapper.get('[data-testid="custom-color-button"]').trigger('click')
    const field = wrapper.get<HTMLInputElement>('[data-testid="custom-color-hex"]')
    await field.setValue('#7a2e8c')
    await field.trigger('keydown', { key: 'Enter' })
    expect(localStorage.getItem(PREFERENCES.marginColor.key)).toBe('custom')
    expect(localStorage.getItem(PREFERENCES.marginCustomColor.key)).toBe('#7a2e8c')
    expect(useCanvasBackground().projectTheme.value.margin.fill).toBe('#7a2e8c')

    await wrapper.get('[data-testid="background-color-auto"]').trigger('click')
    expect(localStorage.getItem(PREFERENCES.marginColor.key)).toBe('auto')
  })

  it('shows Auto while Custom is stored with no Custom color taken yet', () => {
    localStorage.setItem(PREFERENCES.marginColor.key, 'custom')
    useCanvasBackground().margin.setChoice('custom')
    const wrapper = render()
    expect(radios(wrapper)[0].attributes('aria-checked')).toBe('true')
    expect(useCanvasBackground().projectTheme.value.margin.fill).toBe('#eeeeee')
  })

  it('sums itself up as "Auto" or the color\'s name while folded', async () => {
    const wrapper = render()
    await wrapper.get('[data-testid="background-color-linen"]').trigger('click')
    await wrapper.get('button[aria-expanded="true"]').trigger('click')
    expect(wrapper.text()).toContain('Linen')

    useCanvasBackground().margin.setChoice('auto')
    await flush()
    expect(wrapper.text()).toContain('Auto')
  })

  it('shows the title block on the sheet until its Switch is turned off, remembered on the device (ticket 0657)', async () => {
    const wrapper = render()
    const toggle = wrapper.get('[data-testid="margin-title-block-switch"]')
    expect(toggle.attributes('aria-label')).toBe('Name and size on the margin')
    expect(toggle.attributes('aria-checked')).toBe('true')
    await toggle.trigger('click')
    expect(useCanvasBackground().margin.titleBlock.value).toBe(false)
    expect(localStorage.getItem(PREFERENCES.marginTitleBlock.key)).toBe('off')
    await toggle.trigger('click')
    expect(useCanvasBackground().margin.titleBlock.value).toBe(true)
  })

  it('in high contrast offers no colors, the sheet being white', async () => {
    setTheme('contrast')
    await flush()
    const wrapper = render()
    expect(wrapper.find('[role="radiogroup"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="margin-line"]').exists()).toBe(true)
  })
})
