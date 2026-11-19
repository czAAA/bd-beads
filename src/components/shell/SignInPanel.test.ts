import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SignInRefusal } from '../../domain/account'
import { en } from '../../i18n/en'
import SignInPanel from './SignInPanel.vue'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

function panel(props: { refusal?: SignInRefusal; asks?: boolean; leaving?: boolean } = {}) {
  const stop = vi.fn()
  const verify = vi.fn((_container: HTMLElement) => stop)
  const wrapper = mount(SignInPanel, { props: { asks: false, leaving: false, verify, ...props } })
  return { wrapper, verify, stop }
}

describe('SignInPanel (ticket 0078)', () => {
  it('says what signing in is for and what openbeads keeps, above the Google button', () => {
    const { wrapper } = panel()
    const text = wrapper.text()
    expect(text).toContain(en.account.purpose)
    expect(wrapper.get('h3').text()).toBe(en.account.keepsHeading)
    expect(wrapper.findAll('[data-testid="sign-in-keeps"] li').map((row) => row.text())).toEqual([en.account.keepsEmail, en.account.keepsSettings])
    expect(text).toContain(en.account.keepsNothingElse)
    expect(text).toContain(en.account.firstTime)
    // In plain sight: the list comes before the button in the page.
    const button = wrapper.get('[data-testid="sign-in-google"]')
    const list = wrapper.get('[data-testid="sign-in-keeps"]')
    expect(list.element.compareDocumentPosition(button.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('names the list by its heading', () => {
    const { wrapper } = panel()
    const section = wrapper.get('section')
    expect(section.attributes('aria-labelledby')).toBe(wrapper.get('h3').attributes('id'))
  })

  it('offers Continue with Google, with Google’s mark hidden from screen readers', async () => {
    const { wrapper } = panel()
    const button = wrapper.get('[data-testid="sign-in-google"]')
    expect(button.text()).toBe(en.account.continueWithGoogle)
    expect(button.attributes('aria-disabled')).toBeUndefined()
    expect(button.get('svg').attributes('aria-hidden')).toBe('true')
    await button.trigger('click')
    expect(wrapper.emitted('continue')).toHaveLength(1)
  })

  it('is busy from the press until the page leaves: "Opening Google…", and a press does nothing', async () => {
    const { wrapper } = panel({ leaving: true })
    const button = wrapper.get('[data-testid="sign-in-google"]')
    expect(button.text()).toBe(en.account.openingGoogle)
    expect(button.attributes('aria-disabled')).toBe('true')
    expect(button.find('svg').exists()).toBe(true)
    await button.trigger('click')
    expect(wrapper.emitted('continue')).toBeUndefined()
  })

  it('starts Cloudflare’s check in its own element as it opens, and stops it as it closes', () => {
    const { wrapper, verify, stop } = panel()
    expect(verify).toHaveBeenCalledTimes(1)
    expect(verify.mock.calls[0]![0]).toBe(wrapper.get('.sign-in__verify').element)
    wrapper.unmount()
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('says "One more check" only while Cloudflare asks the person something', async () => {
    const { wrapper } = panel()
    expect(wrapper.find('[data-testid="sign-in-check-note"]').exists()).toBe(false)
    await wrapper.setProps({ asks: true })
    expect(wrapper.get('[data-testid="sign-in-check-note"]').text()).toBe(en.account.oneMoreCheck)
  })

  it.each([
    ['cancelled', 'info', en.account.cancelled],
    ['failed', 'danger', en.account.failed],
    ['paused', 'warning', en.account.paused],
  ] as const)('says why the person is not signed in (%s) at the top, as an alert with no close, and keeps the button', (refusal, tone, text) => {
    const { wrapper } = panel({ refusal })
    const message = wrapper.get('[data-testid="sign-in-refusal"]')
    expect(message.text()).toBe(text)
    expect(message.attributes('role')).toBe('alert')
    expect(message.classes()).toContain(`app-message--${tone}`)
    expect(message.classes()).toContain('app-message--notice')
    expect(message.find('[data-testid="message-close"]').exists()).toBe(false)
    expect(wrapper.get('.sign-in').element.firstElementChild).toBe(message.element)
    expect(wrapper.get('[data-testid="sign-in-google"]').attributes('aria-disabled')).toBeUndefined()
  })

  it('shows no refusal on a first visit', () => {
    expect(panel().wrapper.find('[data-testid="sign-in-refusal"]').exists()).toBe(false)
  })

  it('links to the privacy policy under what is kept, in a new tab (ticket 0082)', () => {
    const link = panel().wrapper.get('[data-testid="sign-in-privacy"]')
    expect(link.text()).toBe(en.account.privacy)
    expect(link.attributes('href')).toBe('/privacy/')
    expect(link.attributes('target')).toBe('_blank')
  })
})
