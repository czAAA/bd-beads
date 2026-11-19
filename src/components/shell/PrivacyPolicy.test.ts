import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { en } from '../../i18n/en'
import { ru } from '../../i18n/ru'
import { loadLocale, useI18n } from '../../i18n/useI18n'
import PrivacyPolicy from './PrivacyPolicy.vue'

beforeEach(() => localStorage.clear())
afterEach(() => useI18n().setLocale('en'))

describe('PrivacyPolicy (ticket 0082)', () => {
  it('is in English, gives the contact address, and leads back to the Homepage', () => {
    const wrapper = mount(PrivacyPolicy, { props: { homepage: '/' } })
    expect(wrapper.get('[data-testid="privacy-policy"]').attributes('lang')).toBe('en')
    expect(wrapper.find('[data-testid="privacy-english-only"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="privacy-contact"]').attributes('href')).toBe('mailto:privacy@openbeads.com')
    expect(wrapper.get('[data-testid="privacy-homepage"]').attributes('href')).toBe('/')
    expect(wrapper.get('[data-testid="privacy-homepage"]').text()).toBe(en.homepage.notFoundHomepage)
  })

  it('says in the device’s language, above the policy, that it is in English', async () => {
    await loadLocale('ru')
    useI18n().setLocale('ru')
    const line = mount(PrivacyPolicy, { props: { homepage: '/' } }).get('[data-testid="privacy-english-only"]')
    expect(line.attributes('lang')).toBe('ru')
    expect(line.text()).toBe(ru.privacy.englishOnly)
  })
})
