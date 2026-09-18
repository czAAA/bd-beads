import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ImageColorsPicker from './ImageColorsPicker.vue'
import { ru } from '../i18n/ru'

const colors = ['#ff0000', '#00ff00', '#0000ff']

describe('ImageColorsPicker', () => {
  it('renders one swatch per Image color', () => {
    const wrapper = mount(ImageColorsPicker, { props: { colors } })

    const swatches = wrapper.findAll('[data-testid="image-color-swatch"]')
    expect(swatches).toHaveLength(3)
    expect(swatches.map((swatch) => swatch.attributes('data-color-hex'))).toEqual(colors)
  })

  it('emits select with the clicked color hex', async () => {
    const wrapper = mount(ImageColorsPicker, { props: { colors } })

    await wrapper.find('[data-color-hex="#00ff00"]').trigger('click')

    expect(wrapper.emitted('select')).toEqual([['#00ff00']])
  })

  it('marks the color being painted with as pressed', () => {
    const wrapper = mount(ImageColorsPicker, { props: { colors, selectedColor: '#0000ff' } })

    expect(wrapper.find('[data-color-hex="#0000ff"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[data-color-hex="#ff0000"]').attributes('aria-pressed')).toBe('false')
  })

  it('names itself with the Image colors glossary term', () => {
    const wrapper = mount(ImageColorsPicker, { props: { colors } })

    expect(wrapper.find('[data-testid="image-colors-picker"]').attributes('aria-label')).toBe(
      ru.convertImage.imageColorsLabel,
    )
  })
})
