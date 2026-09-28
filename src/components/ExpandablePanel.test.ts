import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ExpandablePanel from './ExpandablePanel.vue'

beforeEach(() => localStorage.setItem('bd-beads:locale', 'en'))

function mountPanel(props: Record<string, unknown> = {}) {
  return mount(ExpandablePanel, {
    props: { title: 'Beads needed', expandable: true, ...props },
    slots: {
      suffix: '· 1 200',
      meta: '<span data-testid="meta">5 of 12</span>',
      default: '<p data-testid="body">rows</p>',
      footer: '<button data-testid="footer">Export all</button>',
    },
    attachTo: document.body,
  })
}

const expandButton = (wrapper: ReturnType<typeof mountPanel>) => wrapper.find('[data-testid="panel-expand"]')

describe('ExpandablePanel', () => {
  it('has a header with the title, its muted suffix and the meta, and the body under it', () => {
    const wrapper = mountPanel()

    expect(wrapper.find('h2').text()).toBe('Beads needed · 1 200')
    expect(wrapper.find('.expandable-panel__suffix').text()).toBe('· 1 200')
    expect(wrapper.find('[data-testid="meta"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="body"]').exists()).toBe(true)
  })

  it('starts collapsed, with a named expand button that reports its state', () => {
    const wrapper = mountPanel()

    expect(wrapper.classes()).not.toContain('expandable-panel--expanded')
    expect(expandButton(wrapper).attributes('aria-expanded')).toBe('false')
    expect(expandButton(wrapper).attributes('aria-label')).toBe('Show all')
    expect(wrapper.find('[data-testid="footer"]').exists()).toBe(false)
  })

  it('grows on the expand button, showing the footer, and ↑ collapses it again', async () => {
    const wrapper = mountPanel()

    await expandButton(wrapper).trigger('click')
    expect(wrapper.classes()).toContain('expandable-panel--expanded')
    expect(expandButton(wrapper).attributes('aria-expanded')).toBe('true')
    expect(expandButton(wrapper).attributes('aria-label')).toBe('Show fewer')
    expect(wrapper.find('[data-testid="footer"]').exists()).toBe(true)

    await expandButton(wrapper).trigger('click')
    expect(wrapper.classes()).not.toContain('expandable-panel--expanded')
  })

  it('collapses on Escape from inside it, keeping the key from the app, with focus on the expand button', async () => {
    const wrapper = mountPanel({ expanded: true })
    const footer = wrapper.find('[data-testid="footer"]')
    ;(footer.element as HTMLElement).focus()

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    let reachedWindow = false
    const listener = () => (reachedWindow = true)
    window.addEventListener('keydown', listener)
    footer.element.dispatchEvent(event)
    window.removeEventListener('keydown', listener)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:expanded')?.at(-1)).toEqual([false])
    expect(reachedWindow).toBe(false)
    expect(document.activeElement).toBe(expandButton(wrapper).element)
  })

  it('leaves Escape alone while collapsed', () => {
    const wrapper = mountPanel()
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    wrapper.find('[data-testid="body"]').element.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
  })

  it('has no expand button, and a body of its natural height, while there is nothing to expand', () => {
    const wrapper = mountPanel({ expandable: false })

    expect(expandButton(wrapper).exists()).toBe(false)
    expect(wrapper.classes()).not.toContain('expandable-panel--expanded')
  })

  it('keeps its fixed summary height while collapsed, unless empty', () => {
    expect(mountPanel().find('.expandable-panel__body').classes()).toContain('expandable-panel__body--fixed')
    expect(mountPanel({ empty: true }).find('.expandable-panel__body').classes()).not.toContain('expandable-panel__body--fixed')
  })

  it('clips the collapsed body by default, letting a caller with its own summary count (Saved Patterns, ticket 175) turn it off so a hover tooltip below a row is never cut off', () => {
    expect(mountPanel().find('.expandable-panel__body').classes()).not.toContain('expandable-panel__body--no-clip')
    expect(mountPanel({ clipOverflow: false }).find('.expandable-panel__body').classes()).toContain(
      'expandable-panel__body--no-clip',
    )
  })
})
