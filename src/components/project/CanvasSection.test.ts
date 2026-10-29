import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { PREFERENCES } from '../../services/devicePreferences'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import CanvasSection from './CanvasSection.vue'

function setTheme(theme: 'light' | 'dark' | 'contrast') {
  document.documentElement.dataset.theme = theme
}

const mounted: ReturnType<typeof mount>[] = []
function render() {
  const wrapper = mount(CanvasSection, { attachTo: document.body })
  mounted.push(wrapper)
  return wrapper
}

beforeEach(() => {
  localStorage.setItem('openbeads:locale', 'en')
  localStorage.removeItem(PREFERENCES.canvasBackground.key)
  localStorage.removeItem(PREFERENCES.canvasCustomColor.key)
  setTheme('light')
  useCanvasBackground().setChoice(1)
})

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
})

async function flush() {
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve))
}

describe('CanvasSection', () => {
  it('is a radio group of five light swatches named "{name}, {n} of {count}", with the chosen one named under them', () => {
    const wrapper = render()
    const swatches = wrapper.findAll('[role="radio"]')
    expect(swatches.map((s) => s.attributes('aria-label'))).toEqual(['Studio, 1 of 5', 'Linen, 2 of 5', 'Stone, 3 of 5', 'Fog, 4 of 5', 'Pebble, 5 of 5'])
    expect(swatches.map((s) => s.attributes('aria-checked'))).toEqual(['true', 'false', 'false', 'false', 'false'])
    expect(wrapper.get('[data-testid="background-color-name"]').text()).toBe('Studio #fafafa')
  })

  it('offers five in dark, and keeps the position when the theme changes', async () => {
    useCanvasBackground().setChoice(3)
    setTheme('dark')
    await flush()
    const swatches = render().findAll('[role="radio"]')
    expect(swatches).toHaveLength(5)
    expect(swatches[2].attributes('aria-label')).toBe('Midnight, 3 of 5')
    expect(swatches[2].attributes('aria-checked')).toBe('true')
  })

  it('stores the number of the swatch picked', async () => {
    const wrapper = render()
    await wrapper.get('[data-testid="background-color-stone"]').trigger('click')
    expect(localStorage.getItem(PREFERENCES.canvasBackground.key)).toBe('3')
  })

  it('stores a Custom color taken (ticket 0653), shows it in dark too, and keeps it once a swatch is picked', async () => {
    const wrapper = render()
    await wrapper.get('[data-testid="custom-color-button"]').trigger('click')
    const field = wrapper.get<HTMLInputElement>('[data-testid="custom-color-hex"]')
    await field.setValue('#7a2e8c')
    await field.trigger('keydown', { key: 'Enter' })
    expect(localStorage.getItem(PREFERENCES.canvasBackground.key)).toBe('custom')
    expect(localStorage.getItem(PREFERENCES.canvasCustomColor.key)).toBe('#7a2e8c')
    expect(useCanvasBackground().background.value?.color).toBe('#7a2e8c')

    setTheme('dark')
    await flush()
    expect(wrapper.get('[data-testid="custom-color-button"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="background-color-name"]').text()).toBe('Custom color #7a2e8c')

    await wrapper.get('[data-testid="background-color-ink"]').trigger('click')
    expect(localStorage.getItem(PREFERENCES.canvasBackground.key)).toBe('2')
    expect(localStorage.getItem(PREFERENCES.canvasCustomColor.key)).toBe('#7a2e8c')
  })

  it('in high contrast says the canvas stays white', async () => {
    setTheme('contrast')
    await flush()
    const wrapper = render()

    expect(wrapper.get('[data-testid="canvas-stays-white"]').text()).toBe('The canvas stays white in high contrast.')
    expect(wrapper.find('[role="radiogroup"][aria-label="Canvas color"]').exists()).toBe(false)
  })
})
