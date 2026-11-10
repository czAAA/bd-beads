import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FirstRunHints from './FirstRunHints.vue'

beforeEach(() => {
  localStorage.setItem('openbeads:locale', 'en')
})

afterEach(() => {
  localStorage.clear()
})

function mountHints() {
  return mount(FirstRunHints)
}

describe('FirstRunHints (FirstRunHints card)', () => {
  it('is hidden from screen readers', () => {
    const wrapper = mountHints()

    expect(wrapper.attributes('aria-hidden')).toBe('true')
  })

  it('welcomes with only where Projects are kept and how to keep a file of one: Project › Export › Save Project file', () => {
    const wrapper = mountHints()
    const welcome = wrapper.get('[data-testid="first-run-welcome"]')

    expect(welcome.findAll('p').map((line) => line.attributes('data-testid'))).toEqual([
      'first-run-storage-lead',
      'first-run-storage',
      'first-run-path',
    ])
    expect(welcome.find('svg').exists()).toBe(false)
    expect(welcome.get('[data-testid="first-run-storage-lead"]').text()).toBe('Your Projects are saved only in this browser, on this device.')
    expect(welcome.get('[data-testid="first-run-storage"]').text()).toBe(
      "If the browser's data is cleared, they go with it.\nKeep a file of each one you don't want to lose:",
    )
    expect(wrapper.findAll('[data-testid="first-run-path"] .hint-chip').map((chip) => chip.text())).toEqual(['Project', 'Export', 'Save Project file'])
  })
})
