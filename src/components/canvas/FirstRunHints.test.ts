import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import FirstRunHints from './FirstRunHints.vue'
import { fakeMatchMedia } from '../../testUtils/fakeMatchMedia'

const PHONE = '(max-width: 30rem)'
let media: ReturnType<typeof fakeMatchMedia>

beforeEach(() => {
  localStorage.setItem('openbeads:locale', 'en')
  media = fakeMatchMedia()
  vi.spyOn(window, 'matchMedia').mockImplementation(media.matchMedia)
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

function mountHints() {
  return mount(FirstRunHints, { props: { scope: document.body, pillPosition: 'bottom', pillRect: undefined, background: undefined } })
}

const notes = (wrapper: ReturnType<typeof mountHints>) =>
  wrapper.findAll('[data-testid^="first-run-hint-"]').map((note) => note.text())

describe('FirstRunHints (FirstRunHints card)', () => {
  it('captions each control it names, and welcomes, all hidden from screen readers', () => {
    const wrapper = mountHints()

    expect(wrapper.attributes('aria-hidden')).toBe('true')
    expect(notes(wrapper)).toEqual([
      'select to measure, fill, set a Frame,\ncopy, paste, rotate or mirror',
      'frame your drawing: name, size and Bead',
      'export a picture\nor a printable chart',
      'colors and your Palette',
      'Mirror: left–right, top–bottom or radial',
      'new Project, Projects library, language, theme and preferences',
      'set up this Project: its name, maker, Technique, Bead and background',
    ])
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
      "If the browser's data is cleared, they go with it. Keep a file of each one you don't want to lose:",
    )
    expect(wrapper.findAll('[data-testid="first-run-path"] .hint-chip').map((chip) => chip.text())).toEqual(['Project', 'Export', 'Save Project file'])
  })

  it('keeps only the welcome on a phone, with no captions', () => {
    media.set(PHONE, true)
    const wrapper = mountHints()

    expect(notes(wrapper)).toEqual([])
    expect(wrapper.find('[data-testid="first-run-welcome"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="first-run-path"]').exists()).toBe(true)
  })
})
