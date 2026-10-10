import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LanguageSwitcher from './LanguageSwitcher.vue'

beforeEach(() => {
  localStorage.clear()
})

const items = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('[role="menuitem"]')

describe('LanguageSwitcher', () => {
  it('is one button showing the current language, with the list closed', () => {
    const wrapper = mount(LanguageSwitcher)

    expect(wrapper.findAll('button')).toHaveLength(1)
    expect(wrapper.find('button').text()).toBe('EN')
    expect(wrapper.find('button').attributes('aria-expanded')).toBe('false')
    expect(items(wrapper)).toHaveLength(0)
  })

  it('lists every language, each in its own name, with the current one marked', async () => {
    const wrapper = mount(LanguageSwitcher)
    await wrapper.find('button').trigger('click')

    expect(items(wrapper).map((item) => item.text())).toEqual(['English', 'Русский', 'Українська', 'Беларуская', '中文', 'Español', 'Polski'])
    expect(wrapper.find('[data-testid="language-en"]').attributes('aria-current')).toBe('true')
    expect(wrapper.find('[data-testid="language-ru"]').attributes('aria-current')).toBeUndefined()
    expect(wrapper.find('[data-testid="language-zh"]').attributes('lang')).toBe('zh')
  })

  it('switches to the language chosen, closes the list and remembers it', async () => {
    const wrapper = mount(LanguageSwitcher)
    await wrapper.find('button').trigger('click')
    await wrapper.find('[data-testid="language-pl"]').trigger('click')

    expect(localStorage.getItem('bd-beads:locale')).toBe('pl')
    expect(wrapper.find('button').text()).toBe('PL')
    expect(items(wrapper)).toHaveLength(0)
  })

  it('names the button for the current language', () => {
    expect(mount(LanguageSwitcher).find('button').attributes('aria-label')).toBe('Language: English')
  })

  it('names the button in the current language', () => {
    localStorage.setItem('bd-beads:locale', 'ru')
    expect(mount(LanguageSwitcher).find('button').attributes('aria-label')).toBe('Язык интерфейса: Русский')
  })
})
