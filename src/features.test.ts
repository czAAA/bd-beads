import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import OverviewPage from './overview/OverviewPage.vue'
import { TOUR_ENABLED } from './features'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
})

describe('the Tour is switched off (ticket 247)', () => {
  it('ships off', () => {
    expect(TOUR_ENABLED).toBe(false)
  })

  it('does not resume a running Tour or offer one in the editor menu', async () => {
    localStorage.setItem('bd-beads:tour', 'running')
    const wrapper = mount(App, { attachTo: document.body })
    await flushPromises()
    expect(wrapper.find('[data-testid="tour-card"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="menu-item-tour"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('leaves the Tour out of the Overview', () => {
    const wrapper = mount(OverviewPage, { props: { projectCount: 0, overviewHref: '/bd-beads/overview/' } })
    expect(wrapper.find('[data-testid="menu-item-tour"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="tour-band"]').exists()).toBe(false)
  })
})
