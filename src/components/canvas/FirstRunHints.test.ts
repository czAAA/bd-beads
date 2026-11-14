import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import FirstRunHints from './FirstRunHints.vue'
import { fakeMatchMedia } from '../../testUtils/fakeMatchMedia'
import { resetKeyHintsDevice } from '../../composables/ui/useKeyHints'

beforeEach(() => {
  localStorage.setItem('openbeads:locale', 'en')
})

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
  resetKeyHintsDevice()
})

function mountHints() {
  return mount(FirstRunHints)
}

describe('FirstRunHints (FirstRunHints card)', () => {
  it('is hidden from screen readers', () => {
    const wrapper = mountHints()

    expect(wrapper.attributes('aria-hidden')).toBe('true')
  })

  it('leads with how to place a bead in mouse words, and only says under it where Projects are kept (ticket 0920)', () => {
    const wrapper = mountHints()
    const welcome = wrapper.get('[data-testid="first-run-welcome"]')

    expect(welcome.findAll('p').map((line) => line.attributes('data-testid'))).toEqual(['first-run-next-step', 'first-run-storage'])
    expect(welcome.find('svg').exists()).toBe(false)
    expect(welcome.get('[data-testid="first-run-next-step"]').text()).toBe('Click or drag to place beads in the chosen color.')
    expect(welcome.get('[data-testid="first-run-storage"]').text()).toBe('Your Projects are saved only in this browser, on this device.')
    expect(welcome.text()).not.toContain('Save Project file')
  })

  it('says it in the Paint tool Tooltip’s own touch words on a finger-led device', () => {
    vi.stubGlobal('matchMedia', fakeMatchMedia({ '(pointer: coarse)': true }).matchMedia)
    resetKeyHintsDevice()

    expect(mountHints().get('[data-testid="first-run-next-step"]').text()).toBe('Tap or drag to place beads in the chosen color.')
  })
})
