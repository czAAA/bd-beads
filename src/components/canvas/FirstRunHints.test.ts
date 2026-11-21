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

  it('leads with how to place a bead, then what a Frame is for, where Projects are kept and how to save, with tool chips after the words (ticket 0920)', () => {
    const wrapper = mountHints()
    const welcome = wrapper.get('[data-testid="first-run-welcome"]')
    // The chips hold no words, only the spaces round them.
    const words = (id: string) => welcome.get(`[data-testid="${id}"]`).text().replace(/\s+/g, ' ').replace(/ ([.,])/g, '$1')
    const line = (id: string) => welcome.get(`[data-testid="${id}"]`)
    const icons = (id: string) => line(id).findAll('[data-icon]').map((icon) => icon.attributes('data-icon'))

    expect(welcome.findAll('p').map((p) => p.attributes('data-testid'))).toEqual(['first-run-next-step', 'first-run-set-frame', 'first-run-storage', 'first-run-save'])
    expect(words('first-run-next-step')).toBe('Click or drag to place beads in the chosen color.')
    expect(icons('first-run-next-step')).toEqual(['paint', 'palette'])
    expect(words('first-run-set-frame')).toBe('Select, then set a Frame to export or start progress.')
    expect(icons('first-run-set-frame')).toEqual(['select', 'frame'])
    expect(line('first-run-storage').text()).toBe('Your Projects are saved only in this browser.')
    expect(words('first-run-save')).toMatch(/^(Ctrl\+S|⌘S) or Save to save the file on this device\.$/)
    expect(icons('first-run-save')).toEqual(['save'])
  })

  it('says it in the Paint tool Tooltip’s own touch words on a finger-led device', () => {
    vi.stubGlobal('matchMedia', fakeMatchMedia({ '(pointer: coarse)': true }).matchMedia)
    resetKeyHintsDevice()

    const wrapper = mountHints()

    expect(wrapper.get('[data-testid="first-run-next-step"]').text()).toBe('Tap or drag to place beads in the chosen color.')
    expect(wrapper.get('[data-testid="first-run-save"]').text().replace(/\s+/g, ' ')).toBe('Save to save the file on this device.')
  })
})
