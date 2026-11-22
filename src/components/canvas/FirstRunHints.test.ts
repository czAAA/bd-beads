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

  it('leads with how to place a bead, then what a Frame is for, where Projects are kept and how to save, with tool names as words, no chips or icons (tickets 0920, 1200)', () => {
    const wrapper = mountHints()
    const welcome = wrapper.get('[data-testid="first-run-welcome"]')
    const line = (id: string) => welcome.get(`[data-testid="${id}"]`)
    const words = (id: string) => line(id).text().replace(/\s+/g, ' ')
    const names = (id: string) => line(id).findAll('.first-run-hints__name').map((name) => name.text())

    expect(welcome.findAll('p').map((p) => p.attributes('data-testid'))).toEqual(['first-run-next-step', 'first-run-set-frame', 'first-run-storage', 'first-run-save'])
    expect(words('first-run-next-step')).toBe('Click Paint or drag to place beads in the chosen color.')
    expect(names('first-run-next-step')).toEqual(['Paint'])
    expect(words('first-run-set-frame')).toBe('Choose Select, then set a Frame to export or start progress.')
    expect(names('first-run-set-frame')).toEqual(['Select', 'Frame'])
    expect(line('first-run-storage').text()).toBe('Your Projects are saved only in this browser.')
    expect(words('first-run-save')).toMatch(/^(Ctrl\+S|⌘S) or Save to save the file on this device\.$/)
    expect(names('first-run-save')).toEqual([expect.stringMatching(/^(Ctrl\+S|⌘S)$/), 'Save'])
  })

  it('says it in the Paint tool Tooltip’s own touch words on a finger-led device', () => {
    vi.stubGlobal('matchMedia', fakeMatchMedia({ '(pointer: coarse)': true }).matchMedia)
    resetKeyHintsDevice()

    const wrapper = mountHints()

    expect(wrapper.get('[data-testid="first-run-next-step"]').text()).toBe('Tap or drag to place beads in the chosen color.')
    expect(wrapper.get('[data-testid="first-run-save"]').text().replace(/\s+/g, ' ')).toBe('Save to save the file on this device.')
  })
})
