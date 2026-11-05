import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { en } from '../../i18n/en'
import ReferenceAdjustBar from './ReferenceAdjustBar.vue'

beforeEach(() => {
  localStorage.setItem('openbeads:locale', 'en')
})

describe('ReferenceAdjustBar (ReferenceImage card, tickets 0790, 0799)', () => {
  it('replaces the picture with a file picked from its Replace image button', async () => {
    const wrapper = mount(ReferenceAdjustBar)
    expect(wrapper.get('[data-testid="reference-adjust-replace"]').text()).toBe(en.referenceImage.replace)
    const input = wrapper.get<HTMLInputElement>('[data-testid="reference-adjust-replace-input"]')
    const file = new File(['x'], 'rose.png', { type: 'image/png' })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    expect(wrapper.emitted('replace')).toEqual([[file]])
  })
})
