import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { newReferenceImage, type ReferenceImage } from '../../domain/referenceImage'
import { en } from '../../i18n/en'
import ReferenceImageSection from './ReferenceImageSection.vue'

beforeEach(() => {
  localStorage.setItem('openbeads:locale', 'en')
  localStorage.removeItem('openbeads:panel-sections-closed')
})

const image: ReferenceImage = newReferenceImage({ name: 'rose.webp', type: 'image/webp', width: 2048, height: 1536, bytes: 421888 }, { x: 0, y: 0, width: 100, height: 100 })
const pick = (wrapper: ReturnType<typeof mount>, file: File) => {
  const input = wrapper.get<HTMLInputElement>('[data-testid="reference-image-input"]')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  return input.trigger('change')
}

describe('ReferenceImageSection (ReferenceImage card, ticket 0790)', () => {
  it('with no picture offers Add reference image, whose picked file it hands on', async () => {
    const wrapper = mount(ReferenceImageSection)
    expect(wrapper.get('[data-testid="reference-image-add"]').text()).toBe(en.referenceImage.add)
    expect(wrapper.find('[data-testid="reference-image-opacity"]').exists()).toBe(false)
    const file = new File(['x'], 'rose.png', { type: 'image/png' })
    await pick(wrapper, file)
    expect(wrapper.emitted('pick')).toEqual([[file]])
  })

  it('tells the picture\'s limits behind its Info button', () => {
    const info = mount(ReferenceImageSection).get('[data-testid="reference-image-info"]')
    expect(info.attributes('aria-label')).toBe(en.referenceImage.name)
  })

  it('with a picture shows its row, then Opacity, Adjust on canvas, Replace image and Remove image', async () => {
    const wrapper = mount(ReferenceImageSection, { props: { image, thumbnail: 'blob:rose' } })
    expect(wrapper.get('[data-testid="reference-image-row"]').text()).toBe('rose.webp2048 × 1536 · 412 KB')
    expect(wrapper.get('[data-testid="reference-image-row"] img').attributes('src')).toBe('blob:rose')
    const order = wrapper.findAll('[data-testid]').map((element) => element.attributes('data-testid'))
    expect(order.filter((id) => ['reference-image-row', 'reference-image-opacity', 'reference-image-adjust', 'reference-image-replace', 'reference-image-remove'].includes(id!))).toEqual([
      'reference-image-row',
      'reference-image-opacity',
      'reference-image-adjust',
      'reference-image-replace',
      'reference-image-remove',
    ])
    expect(wrapper.findAll('[data-testid="reference-image-opacity"] [role="radio"]').map((choice) => choice.text())).toEqual(['25%', '50%', '75%', '100%'])
    expect(wrapper.get('[data-testid="reference-image-opacity"] [aria-checked="true"]').text()).toBe('50%')

    await wrapper.get('[data-testid="reference-image-opacity"] [data-value="75"]').trigger('click')
    await wrapper.get('[data-testid="reference-image-adjust"]').trigger('click')
    await wrapper.get('[data-testid="reference-image-remove"]').trigger('click')
    expect(wrapper.emitted('set-opacity')).toEqual([[75]])
    expect(wrapper.emitted('adjust')).toHaveLength(1)
    expect(wrapper.emitted('remove')).toHaveLength(1)
  })

  it('sums up the opacity and whether it is shown while folded', async () => {
    const wrapper = mount(ReferenceImageSection, { props: { image: { ...image, shown: false } } })
    await wrapper.get('.panel-section__header').trigger('click')
    expect(wrapper.get('.panel-section__summary').text()).toBe('50% · hidden')
  })

  it('says why a file was refused, and shows the picture being made ready', () => {
    expect(mount(ReferenceImageSection, { props: { refusal: 'tooLarge' } }).get('[data-testid="reference-image-refused"]').text()).toBe("This file can't be used: over 10 MB")
    const preparing = mount(ReferenceImageSection, { props: { preparing: true } })
    expect(preparing.find('[data-testid="reference-image-add"]').exists()).toBe(false)
    expect(preparing.find('[data-testid="reference-image-preparing"]').exists()).toBe(true)
  })
})
