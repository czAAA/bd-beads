import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LanguageSwitcher from './LanguageSwitcher.vue'

beforeEach(() => {
  localStorage.clear()
})

describe('LanguageSwitcher', () => {
  it('is one button reading EN / RU, with Russian current by default', () => {
    const wrapper = mount(LanguageSwitcher)

    expect(wrapper.findAll('button')).toHaveLength(1)
    expect(wrapper.text().replace(/\s/g, '')).toBe('EN/RU')
    expect(wrapper.find('[data-testid="language-ru"]').attributes('aria-current')).toBe('true')
    expect(wrapper.find('[data-testid="language-en"]').attributes('aria-current')).toBeUndefined()
  })

  it('switches to the other language when pressed, and remembers it', async () => {
    const wrapper = mount(LanguageSwitcher)

    await wrapper.find('button').trigger('click')
    expect(wrapper.find('[data-testid="language-en"]').attributes('aria-current')).toBe('true')
    expect(localStorage.getItem('bd-beads:locale')).toBe('en')

    await wrapper.find('button').trigger('click')
    expect(localStorage.getItem('bd-beads:locale')).toBe('ru')
  })

  it('sets the language pressed, when one code is pressed on its own', async () => {
    const wrapper = mount(LanguageSwitcher)

    await wrapper.find('[data-testid="language-en"]').trigger('click')
    await wrapper.find('[data-testid="language-en"]').trigger('click')

    expect(localStorage.getItem('bd-beads:locale')).toBe('en')
  })

  it('names what pressing it does', () => {
    const wrapper = mount(LanguageSwitcher)
    expect(wrapper.find('button').attributes('aria-label')).toContain('английский')
  })
})
