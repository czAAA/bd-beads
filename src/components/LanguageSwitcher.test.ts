import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LanguageSwitcher from './LanguageSwitcher.vue'

beforeEach(() => {
  localStorage.clear()
})

describe('LanguageSwitcher', () => {
  it('marks ru as active by default', () => {
    const wrapper = mount(LanguageSwitcher)

    expect(wrapper.find('[data-testid="language-ru"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[data-testid="language-en"]').attributes('aria-pressed')).toBe('false')
  })

  it('switches the active language and persists the choice', async () => {
    const wrapper = mount(LanguageSwitcher)

    await wrapper.find('[data-testid="language-en"]').trigger('click')

    expect(wrapper.find('[data-testid="language-en"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[data-testid="language-ru"]').attributes('aria-pressed')).toBe('false')
    expect(localStorage.getItem('bd-beads:locale')).toBe('en')
  })
})
