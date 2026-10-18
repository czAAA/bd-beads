import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CustomColorPanel from './CustomColorPanel.vue'

function mountPanel(color?: string) {
  return mount(CustomColorPanel, { props: { color }, attachTo: document.body })
}

const hexField = (wrapper: ReturnType<typeof mountPanel>) => wrapper.get<HTMLInputElement>('[data-testid="custom-color-hex"]')
const wheel = (wrapper: ReturnType<typeof mountPanel>) => wrapper.get('[data-testid="custom-color-wheel"]')
const slider = (wrapper: ReturnType<typeof mountPanel>) => wrapper.get('[data-testid="custom-color-brightness"]')
const pressOutside = () => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))

afterEach(() => {
  document.body.innerHTML = ''
})

describe('CustomColorPanel, the Custom color picker (ticket 449)', () => {
  it('opens on the color it is given, else a mid red', () => {
    expect(hexField(mountPanel('#123456')).element.value).toBe('#123456')
    expect(hexField(mountPanel()).element.value).toBe('#e03c3c')
  })

  it('previews only: typing a valid hex moves the preview, wheel and slider, and takes nothing', async () => {
    const wrapper = mountPanel('#123456')
    await hexField(wrapper).setValue('00ff00')

    expect(wrapper.get('[data-testid="custom-color-preview"]').attributes('style')).toContain('rgb(0, 255, 0)')
    expect(wheel(wrapper).attributes('aria-valuetext')).toBe('hue 120°, saturation 100%')
    expect(slider(wrapper).attributes('aria-valuenow')).toBe('100')
    expect(wrapper.emitted()).not.toHaveProperty('take')
  })

  it('takes #rgb, with or without #, in any case', async () => {
    const wrapper = mountPanel('#123456')
    await hexField(wrapper).setValue('ABC')
    await hexField(wrapper).trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('take')).toEqual([['#aabbcc']])
  })

  it('shows the invalid state for a bad entry and snaps back to the current color on blur', async () => {
    const wrapper = mountPanel('#123456')
    await hexField(wrapper).setValue('#12')
    await hexField(wrapper).setValue('#12x')

    expect(hexField(wrapper).attributes('aria-invalid')).toBe('true')
    expect(wrapper.find('[data-testid="custom-color-hex-note"]').exists()).toBe(true)

    await hexField(wrapper).trigger('blur')

    expect(hexField(wrapper).element.value).toBe('#123456')
    expect(hexField(wrapper).attributes('aria-invalid')).toBeUndefined()
    expect(wrapper.find('[data-testid="custom-color-hex-note"]').exists()).toBe(false)
  })

  it('moves hue and saturation by the arrows on the wheel, ten times as far with Shift', async () => {
    const wrapper = mountPanel('#ff0000')
    await wheel(wrapper).trigger('keydown', { key: 'ArrowRight' })
    expect(wheel(wrapper).attributes('aria-valuetext')).toBe('hue 1°, saturation 100%')
    await wheel(wrapper).trigger('keydown', { key: 'ArrowLeft', shiftKey: true })
    expect(wheel(wrapper).attributes('aria-valuetext')).toBe('hue 351°, saturation 100%')
    await wheel(wrapper).trigger('keydown', { key: 'ArrowDown', shiftKey: true })
    expect(wheel(wrapper).attributes('aria-valuetext')).toBe('hue 351°, saturation 90%')
  })

  it('moves brightness by the arrows on the slider', async () => {
    const wrapper = mountPanel('#ff0000')
    await slider(wrapper).trigger('keydown', { key: 'ArrowLeft', shiftKey: true })
    expect(slider(wrapper).attributes('aria-valuenow')).toBe('90')
    await slider(wrapper).trigger('keydown', { key: 'ArrowRight' })
    expect(slider(wrapper).attributes('aria-valuenow')).toBe('91')
  })

  it('reads the wheel by the angle and the distance of the press', async () => {
    const wrapper = mountPanel('#ffffff')
    wheel(wrapper).element.getBoundingClientRect = () => new DOMRect(0, 0, 200, 200)

    await wheel(wrapper).trigger('pointerdown', { clientX: 200, clientY: 100, pointerId: 1 })

    expect(wheel(wrapper).attributes('aria-valuetext')).toBe('hue 90°, saturation 100%')
  })

  it('takes the color once when left by a press outside, however many steps it moved', async () => {
    const wrapper = mountPanel('#123456')
    for (const hex of ['#111111', '#222222', '#333333']) await hexField(wrapper).setValue(hex)
    pressOutside()

    expect(wrapper.emitted('take')).toEqual([['#333333']])
  })

  it('takes nothing when opened and left untouched', () => {
    const wrapper = mountPanel('#123456')
    pressOutside()

    expect(wrapper.emitted()).not.toHaveProperty('take')
    expect(wrapper.emitted('leave')).toHaveLength(1)
  })

  it('takes the color on Escape once touched', async () => {
    const wrapper = mountPanel('#123456')
    await hexField(wrapper).setValue('#654321')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))

    expect(wrapper.emitted('take')).toEqual([['#654321']])
  })

  it('cancels on Escape when untouched', () => {
    const wrapper = mountPanel('#123456')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))

    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted()).not.toHaveProperty('take')
  })

  it('lets a press on a Palette swatch through and takes nothing', async () => {
    const wrapper = mountPanel('#123456')
    await hexField(wrapper).setValue('#654321')
    const swatch = document.createElement('button')
    swatch.dataset.testid = 'palette-swatch'
    document.body.append(swatch)
    const press = new PointerEvent('pointerdown', { bubbles: true, cancelable: true })
    swatch.dispatchEvent(press)
    swatch.remove()

    expect(press.defaultPrevented).toBe(false)
    expect(wrapper.emitted()).not.toHaveProperty('take')
  })

  it('takes the color on Enter from the wheel and the slider too', async () => {
    const wrapper = mountPanel('#ff0000')
    await wheel(wrapper).trigger('keydown', { key: 'ArrowDown' })
    await slider(wrapper).trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('take')).toHaveLength(1)
  })
})
