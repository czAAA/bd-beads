import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, provide, ref, type Ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Account } from '../../domain/account'
import { en } from '../../i18n/en'
import AccountSection from './AccountSection.vue'
import { PANEL_CONTEXT } from './panelContext'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

/** The section inside a panel shell's context, with what it asks and pushes written down. */
function mountIn(options: { account?: Ref<Account | undefined>; leave?: () => Promise<boolean>; mayOpenSignIn?: () => Promise<boolean> } = {}) {
  const openSub = vi.fn()
  const account = options.account ?? ref<Account>()
  const mayOpenSignIn = vi.fn(options.mayOpenSignIn ?? (async () => true))
  const leave = vi.fn(options.leave ?? (async () => true))
  const onSignIn = vi.fn()
  const onSignOut = vi.fn()
  const onDeleteAccount = vi.fn()
  const Host = defineComponent({
    setup() {
      provide(PANEL_CONTEXT, { close: () => {}, openSub })
      return () => h(AccountSection, { account: account.value, leave, mayOpenSignIn, onSignIn, onSignOut, onDeleteAccount })
    },
  })
  return { wrapper: mount(Host, { attachTo: document.body }), openSub, mayOpenSignIn, leave, onSignIn, onSignOut, onDeleteAccount, account }
}

describe('AccountSection (ticket 0078)', () => {
  it('gives a Guest Sign in, which opens a subpanel, and the line that everything works without an account', () => {
    const { wrapper } = mountIn()
    const row = wrapper.get('[data-testid="menu-sign-in"]')
    expect(row.text()).toBe(en.account.signIn)
    expect(row.get('svg').attributes('data-icon')).toBe('account')
    expect(row.find('.panel-item__mark--sub').exists()).toBe(true)
    expect(row.attributes('aria-disabled')).toBeUndefined()
    expect(wrapper.get('[data-testid="menu-account-note"]').text()).toBe(en.account.guestNote)
    expect(wrapper.find('[data-testid="menu-sign-out"]').exists()).toBe(false)
  })

  it('pushes the Sign in Subpanel under its own title once a sign-in can be started', async () => {
    const { wrapper, openSub, onSignIn, mayOpenSignIn } = mountIn()
    await wrapper.get('[data-testid="menu-sign-in"]').trigger('click')
    await flushPromises()
    expect(mayOpenSignIn).toHaveBeenCalledTimes(1)
    expect(onSignIn).toHaveBeenCalledTimes(1)
    expect(openSub).toHaveBeenCalledWith(en.account.signIn, { opener: 'menu-sign-in' })
  })

  it('opens nothing when signing in can’t be done now, and the row stays as it is', async () => {
    const { wrapper, openSub, onSignIn } = mountIn({ mayOpenSignIn: async () => false })
    const row = wrapper.get('[data-testid="menu-sign-in"]')
    await row.trigger('click')
    await flushPromises()
    expect(openSub).not.toHaveBeenCalled()
    expect(onSignIn).not.toHaveBeenCalled()
    expect(row.attributes('aria-disabled')).toBeUndefined()
  })

  it('asks the page first, as New Project does: a person who stays on the page signs in nowhere', async () => {
    const { wrapper, openSub, mayOpenSignIn } = mountIn({ leave: async () => false })
    await wrapper.get('[data-testid="menu-sign-in"]').trigger('click')
    await flushPromises()
    expect(mayOpenSignIn).not.toHaveBeenCalled()
    expect(openSub).not.toHaveBeenCalled()
  })

  it('shows a signed-in person their email and plan as a fact, with no name or picture, and Sign out', () => {
    const { wrapper } = mountIn({ account: ref<Account | undefined>({ email: 'ann@example.com', plan: 'free' }) })
    const who = wrapper.get('[data-testid="menu-account"]')
    expect(who.element.tagName).toBe('DIV')
    expect(who.get('svg').attributes('data-icon')).toBe('account')
    expect(wrapper.get('[data-testid="menu-account-email"]').text()).toBe('ann@example.com')
    expect(wrapper.get('[data-testid="menu-account-plan"]').text()).toBe(en.account.planFree)
    expect(who.find('img').exists()).toBe(false)
    const out = wrapper.get('[data-testid="menu-sign-out"]')
    expect(out.text()).toBe(en.account.signOut)
    expect(out.get('svg').attributes('data-icon')).toBe('sign-out')
    expect(wrapper.find('[data-testid="menu-sign-in"]').exists()).toBe(false)
  })

  it('tells a signed-in person their settings are the same on all their devices, with which ones behind an Info button, between the email and Sign out', () => {
    const { wrapper } = mountIn({ account: ref<Account | undefined>({ email: 'ann@example.com', plan: 'free' }) })
    const line = wrapper.get('[data-testid="menu-account-settings"]')
    expect(line.text().startsWith(en.account.settingsLine)).toBe(true)
    expect(line.get('[data-testid="menu-account-settings-info"]').attributes('aria-label')).toBe(en.account.settingsInfoLabel)
    expect(line.get('.app-tooltip__body').text()).toBe(en.account.settingsInfo)
    const order = wrapper.findAll('[data-testid]').map((part) => part.attributes('data-testid'))
    expect(order.indexOf('menu-account')).toBeLessThan(order.indexOf('menu-account-settings'))
    expect(order.indexOf('menu-account-settings')).toBeLessThan(order.indexOf('menu-sign-out'))
  })

  it('says nothing of settings to a Guest: theirs stay on the device', () => {
    const { wrapper } = mountIn()
    expect(wrapper.find('[data-testid="menu-account-settings"]').exists()).toBe(false)
  })

  it('names the Pro plan', () => {
    const { wrapper } = mountIn({ account: ref<Account | undefined>({ email: 'ann@example.com', plan: 'pro' }) })
    expect(wrapper.get('[data-testid="menu-account-plan"]').text()).toBe(en.account.planPro)
  })

  it('signs out on one press, with no confirm, and moves focus to Sign in once the row is gone', async () => {
    const account = ref<Account | undefined>({ email: 'ann@example.com', plan: 'free' })
    const { wrapper, onSignOut } = mountIn({ account })
    onSignOut.mockImplementation(() => (account.value = undefined))
    await wrapper.get('[data-testid="menu-sign-out"]').trigger('click')
    await flushPromises()
    expect(onSignOut).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(wrapper.get('[data-testid="menu-sign-in"]').element)
  })

  it('gives a signed-in person Delete account after Sign out, in the danger color, which asks the shell to confirm (ticket 0082)', async () => {
    const { wrapper, onDeleteAccount } = mountIn({ account: ref<Account | undefined>({ email: 'ann@example.com', plan: 'free' }) })
    const row = wrapper.get('[data-testid="menu-delete-account"]')
    expect(row.text()).toBe(en.account.deleteAccount)
    expect(row.classes()).toContain('panel-item--danger')
    const rows = wrapper.findAll('.panel-item').map((item) => item.attributes('data-testid'))
    expect(rows.indexOf('menu-delete-account')).toBe(rows.indexOf('menu-sign-out') + 1)
    await row.trigger('click')
    expect(onDeleteAccount).toHaveBeenCalledTimes(1)
  })

  it('gives a Guest no Delete account', () => {
    expect(mountIn().wrapper.find('[data-testid="menu-delete-account"]').exists()).toBe(false)
  })
})
