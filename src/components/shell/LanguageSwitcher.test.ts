import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LanguageSwitcher from './LanguageSwitcher.vue'

beforeEach(() => {
  localStorage.clear()
})

describe('LanguageSwitcher', () => {
  it('is one button listing every language, with English current by default', () => {
    const wrapper = mount(LanguageSwitcher)

    expect(wrapper.findAll('button')).toHaveLength(1)
    expect(wrapper.text().replace(/\s/g, '')).toBe('EN/RU/ZH/ES/PL')
    expect(wrapper.find('[data-testid="language-en"]').attributes('aria-current')).toBe('true')
    expect(wrapper.find('[data-testid="language-ru"]').attributes('aria-current')).toBeUndefined()
  })

  it('moves to the next language when pressed, round to the first, and remembers it', async () => {
    const wrapper = mount(LanguageSwitcher)

    for (const expected of ['ru', 'zh', 'es', 'pl', 'en']) {
      await wrapper.find('button').trigger('click')
      expect(localStorage.getItem('bd-beads:locale')).toBe(expected)
    }
  })

  it('sets the language pressed, when one code is pressed on its own', async () => {
    const wrapper = mount(LanguageSwitcher)

    await wrapper.find('[data-testid="language-pl"]').trigger('click')

    expect(localStorage.getItem('bd-beads:locale')).toBe('pl')
    expect(wrapper.find('[data-testid="language-pl"]').attributes('aria-current')).toBe('true')
  })

  it('names the current language and what pressing it does', () => {
    expect(mount(LanguageSwitcher).find('button').attributes('aria-label')).toBe('Language: English. Switch to Russian')
  })

  it('names them in the current language', () => {
    localStorage.setItem('bd-beads:locale', 'ru')
    expect(mount(LanguageSwitcher).find('button').attributes('aria-label')).toBe('Язык: русский. Переключить на: китайский')
  })
})
