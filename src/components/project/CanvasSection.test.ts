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
    const swatches = wrapper.findAll('.canvas-section__swatches [role="radio"]')
    expect(swatches.map((s) => s.attributes('aria-label'))).toEqual(['Studio, 1 of 5', 'Linen, 2 of 5', 'Sage, 3 of 5', 'Mist, 4 of 5', 'Blush, 5 of 5'])
    expect(swatches.map((s) => s.attributes('aria-checked'))).toEqual(['true', 'false', 'false', 'false', 'false'])
    expect(swatches.map((s) => s.attributes('tabindex'))).toEqual(['0', '-1', '-1', '-1', '-1'])
    expect(wrapper.get('[data-testid="canvas-color-name"]').text()).toContain('Studio')
    expect(wrapper.get('[data-testid="canvas-color-name"]').text()).toContain('#fafafa')
  })

  it('offers six in dark, and keeps the position when the theme changes', async () => {
    useCanvasBackground().setChoice(3)
    setTheme('dark')
    await flush()
    const swatches = render().findAll('.canvas-section__swatches [role="radio"]')
    expect(swatches).toHaveLength(6)
    expect(swatches[2].attributes('aria-label')).toBe('Midnight, 3 of 6')
    expect(swatches[2].attributes('aria-checked')).toBe('true')
  })

  it('applies a choice at once, stores the number, and moves with the arrows', async () => {
    const wrapper = render()
    await wrapper.get('[data-testid="canvas-color-linen"]').trigger('click')
    expect(localStorage.getItem(PREFERENCES.canvasBackground.key)).toBe('2')

    await wrapper.get('[data-testid="canvas-color-linen"]').trigger('keydown', { key: 'ArrowRight' })
    expect(localStorage.getItem(PREFERENCES.canvasBackground.key)).toBe('3')
    await wrapper.get('[data-testid="canvas-color-sage"]').trigger('keydown', { key: 'ArrowLeft' })
    await wrapper.get('[data-testid="canvas-color-linen"]').trigger('keydown', { key: 'ArrowLeft' })
    await wrapper.get('[data-testid="canvas-color-studio"]').trigger('keydown', { key: 'ArrowLeft' })
    expect(localStorage.getItem(PREFERENCES.canvasBackground.key)).toBe('5')
  })

  it('shows Studio for a stored 6 in light', () => {
    useCanvasBackground().setChoice(6)
    const wrapper = render()
    expect(wrapper.get('[data-testid="canvas-color-name"]').text()).toContain('Studio')
    expect(localStorage.getItem(PREFERENCES.canvasBackground.key)).toBe('6')
  })

  it('in high contrast says the canvas stays white', async () => {
    setTheme('contrast')
    await flush()
    const wrapper = render()

    expect(wrapper.get('[data-testid="canvas-stays-white"]').text()).toBe('The canvas stays white in high contrast.')
    expect(wrapper.find('[role="radiogroup"][aria-label="Canvas color"]').exists()).toBe(false)
  })
})
