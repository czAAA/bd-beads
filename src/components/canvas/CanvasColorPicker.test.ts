import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { PREFERENCES } from '../../services/devicePreferences'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import CanvasColorPicker from './CanvasColorPicker.vue'

function setTheme(theme: 'light' | 'dark' | 'contrast') {
  document.documentElement.dataset.theme = theme
}

const mounted: ReturnType<typeof mount>[] = []
function open() {
  const wrapper = mount(CanvasColorPicker, { attachTo: document.body })
  mounted.push(wrapper)
  return wrapper
}

beforeEach(() => {
  localStorage.setItem('bd-beads:locale', 'en')
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

describe('CanvasColorPicker', () => {
  it('opens a radio group of five light swatches named "{name}, {n} of {count}"', async () => {
    const wrapper = open()
    const button = wrapper.get('[data-testid="canvas-color-button"]')
    expect(button.attributes('aria-label')).toBe('Canvas color')
    expect(button.attributes('aria-haspopup')).toBe('dialog')
    expect(button.attributes('aria-expanded')).toBe('false')

    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('true')
    const swatches = wrapper.findAll('.canvas-color__swatches [role="radio"]')
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
    const wrapper = open()
    await wrapper.get('[data-testid="canvas-color-button"]').trigger('click')
    const swatches = wrapper.findAll('.canvas-color__swatches [role="radio"]')
    expect(swatches).toHaveLength(6)
    expect(swatches[2].attributes('aria-label')).toBe('Midnight, 3 of 6')
    expect(swatches[2].attributes('aria-checked')).toBe('true')
  })

  it('applies a choice at once, stores the number, and moves with the arrows', async () => {
    const wrapper = open()
    await wrapper.get('[data-testid="canvas-color-button"]').trigger('click')
    await wrapper.get('[data-testid="canvas-color-linen"]').trigger('click')
    expect(localStorage.getItem(PREFERENCES.canvasBackground.key)).toBe('2')

    await wrapper.get('[data-testid="canvas-color-linen"]').trigger('keydown', { key: 'ArrowRight' })
    expect(localStorage.getItem(PREFERENCES.canvasBackground.key)).toBe('3')
    await wrapper.get('[data-testid="canvas-color-sage"]').trigger('keydown', { key: 'ArrowLeft' })
    await wrapper.get('[data-testid="canvas-color-linen"]').trigger('keydown', { key: 'ArrowLeft' })
    await wrapper.get('[data-testid="canvas-color-studio"]').trigger('keydown', { key: 'ArrowLeft' })
    expect(localStorage.getItem(PREFERENCES.canvasBackground.key)).toBe('5')
  })

  it('shows Studio for a stored 6 in light', async () => {
    useCanvasBackground().setChoice(6)
    const wrapper = open()
    await wrapper.get('[data-testid="canvas-color-button"]').trigger('click')
    expect(wrapper.get('[data-testid="canvas-color-name"]').text()).toContain('Studio')
    expect(localStorage.getItem(PREFERENCES.canvasBackground.key)).toBe('6')
  })

  it('closes on Escape and on a press outside, giving focus back to the button only for Escape', async () => {
    const wrapper = open()
    const button = wrapper.get('[data-testid="canvas-color-button"]')
    await button.trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flush()
    expect(wrapper.find('[data-testid="canvas-color-picker"]').exists()).toBe(false)
    expect(document.activeElement).toBe(button.element)

    await button.trigger('click')
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await flush()
    expect(wrapper.find('[data-testid="canvas-color-picker"]').exists()).toBe(false)
  })

  it('chooses Squares at once, keeps the choice on the device and reads it back', async () => {
    localStorage.removeItem(PREFERENCES.positionMarks.key)
    useCanvasBackground().setPositionMarks('dots')
    const wrapper = open()
    await wrapper.get('[data-testid="canvas-color-button"]').trigger('click')
    await flush()
    const options = wrapper.get('[data-testid="position-marks"]').findAll('[role="radio"]')
    expect(options.map((option) => option.text())).toEqual(['Dots', 'Squares'])
    expect(options[0].attributes('aria-checked')).toBe('true')

    await options[1].trigger('click')

    expect(useCanvasBackground().positionMarks.value).toBe('squares')
    expect(wrapper.find('[data-testid="canvas-color-picker"]').exists()).toBe(true)
    expect(localStorage.getItem(PREFERENCES.positionMarks.key)).toBe('squares')
  })

  it('shows the button in high contrast, opening the Dots | Squares choice alone', async () => {
    setTheme('contrast')
    await flush()
    const wrapper = open()
    const button = wrapper.get('[data-testid="canvas-color-button"]')
    expect(wrapper.get('.canvas-color').attributes('style') ?? '').not.toContain('display: none')

    await button.trigger('click')
    await flush()

    expect(wrapper.find('[data-testid="position-marks"]').exists()).toBe(true)
    expect(wrapper.find('[role="radiogroup"][aria-label="Canvas color"]').exists()).toBe(false)
  })
})
