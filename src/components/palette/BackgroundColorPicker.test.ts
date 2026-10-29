import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import BackgroundColorPicker from './BackgroundColorPicker.vue'

const SWATCHES = [
  { id: 'studio', color: '#fafafa', name: 'Studio', label: 'Studio, 1 of 3' },
  { id: 'linen', color: '#f7f3ec', name: 'Linen', label: 'Linen, 2 of 3' },
  { id: 'stone', color: '#e6e3de', name: 'Stone', label: 'Stone, 3 of 3' },
]

const mounted: ReturnType<typeof mount>[] = []
function render(props: Partial<InstanceType<typeof BackgroundColorPicker>['$props']> = {}) {
  const wrapper = mount(BackgroundColorPicker, { props: { swatches: SWATCHES, label: 'Canvas color', selectedId: 'studio', ...props }, attachTo: document.body })
  mounted.push(wrapper)
  return wrapper
}

const radios = (wrapper: ReturnType<typeof render>) => wrapper.findAll('[role="radio"]')
const customButton = (wrapper: ReturnType<typeof render>) => wrapper.get('[data-testid="custom-color-button"]')
/** A press outside and the click it ends in, which the overlay swallows. */
function pressOutside() {
  document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
  document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
}

beforeEach(() => {
  localStorage.setItem('openbeads:locale', 'en')
})

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
})

describe('BackgroundColorPicker (ticket 0653)', () => {
  it('is a radio group of the swatches it is given, then the Palette\'s Custom color tile, with the chosen one named and its hex', () => {
    const wrapper = render({ selectedId: 'linen' })
    expect(wrapper.get('[role="radiogroup"]').attributes('aria-label')).toBe('Canvas color')
    expect(radios(wrapper).map((r) => r.attributes('aria-label'))).toEqual(['Studio, 1 of 3', 'Linen, 2 of 3', 'Stone, 3 of 3'])
    expect(radios(wrapper).map((r) => r.attributes('aria-checked'))).toEqual(['false', 'true', 'false'])
    expect(radios(wrapper).map((r) => r.attributes('tabindex'))).toEqual(['-1', '0', '-1'])
    expect(customButton(wrapper).attributes('aria-label')).toBe('Custom color')
    expect(customButton(wrapper).attributes('aria-pressed')).toBe('false')
    expect(wrapper.get('[data-testid="background-color-name"]').text()).toBe('Linen #f7f3ec')
  })

  it('emits the swatch picked, and moves with the arrows, wrapping round', async () => {
    const wrapper = render()
    await wrapper.get('[data-testid="background-color-stone"]').trigger('click')
    await wrapper.get('[data-testid="background-color-studio"]').trigger('keydown', { key: 'ArrowLeft' })
    await wrapper.get('[data-testid="background-color-studio"]').trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.emitted('select')).toEqual([['stone'], ['stone'], ['linen']])
  })

  it('rings the Custom tile and names the Custom color while it is the background, and Tab still reaches the swatches', () => {
    const wrapper = render({ selectedId: undefined, customColor: '#7a2e8c' })
    expect(customButton(wrapper).attributes('aria-pressed')).toBe('true')
    expect(radios(wrapper).map((r) => r.attributes('aria-checked'))).toEqual(['false', 'false', 'false'])
    expect(radios(wrapper).map((r) => r.attributes('tabindex'))).toEqual(['0', '-1', '-1'])
    expect(wrapper.get('[data-testid="background-color-name"]').text()).toBe('Custom color #7a2e8c')
  })

  it('opens the Custom color picker on the Custom color, else the chosen swatch, and emits what it takes', async () => {
    const wrapper = render({ customColor: '#7a2e8c' })
    await customButton(wrapper).trigger('click')
    expect(customButton(wrapper).attributes('aria-expanded')).toBe('true')
    expect(wrapper.get<HTMLInputElement>('[data-testid="custom-color-hex"]').element.value).toBe('#7a2e8c')

    const field = wrapper.get<HTMLInputElement>('[data-testid="custom-color-hex"]')
    await field.setValue('#14213d')
    await field.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('select-custom')).toEqual([['#14213d']])
    expect(wrapper.find('[data-testid="custom-color-panel"]').exists()).toBe(false)

    const fresh = render({ selectedId: 'linen' })
    await customButton(fresh).trigger('click')
    expect(fresh.get<HTMLInputElement>('[data-testid="custom-color-hex"]').element.value).toBe('#f7f3ec')
  })

  it('takes the color on a press outside, and on a second press of the tile', async () => {
    const wrapper = render()
    await customButton(wrapper).trigger('click')
    await wrapper.get('[data-testid="custom-color-hex"]').setValue('#14213d')
    pressOutside()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('select-custom')).toEqual([['#14213d']])

    await customButton(wrapper).trigger('click')
    await wrapper.get('[data-testid="custom-color-hex"]').setValue('#fde68a')
    await customButton(wrapper).trigger('click')
    expect(wrapper.emitted('select-custom')).toEqual([['#14213d'], ['#fde68a']])
    expect(wrapper.find('[data-testid="custom-color-panel"]').exists()).toBe(false)
  })

  it('goes back to the Custom tile on Escape when nothing was changed', async () => {
    const wrapper = render()
    await customButton(wrapper).trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await flushPromises()

    expect(wrapper.find('[data-testid="custom-color-panel"]').exists()).toBe(false)
    expect(document.activeElement).toBe(customButton(wrapper).element)
    expect(wrapper.emitted()).not.toHaveProperty('select-custom')
  })

  it('lets a press on a swatch through while the picker is open: that swatch is picked and nothing is taken', async () => {
    const wrapper = render()
    await customButton(wrapper).trigger('click')
    await wrapper.get('[data-testid="custom-color-hex"]').setValue('#14213d')
    const swatch = wrapper.get('[data-testid="background-color-stone"]').element
    const press = new PointerEvent('pointerdown', { bubbles: true, cancelable: true })
    swatch.dispatchEvent(press)
    await wrapper.get('[data-testid="background-color-stone"]').trigger('click')

    expect(press.defaultPrevented).toBe(false)
    expect(wrapper.emitted('select')).toEqual([['stone']])
    expect(wrapper.emitted()).not.toHaveProperty('select-custom')
    expect(wrapper.find('[data-testid="custom-color-panel"]').exists()).toBe(false)
  })
})
