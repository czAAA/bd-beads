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
    expect(wrapper.get('[data-testid="first-run-welcome"]').text()).toContain('draw → select → frame → export')
  })

  it('says where Projects are kept and how to keep a file of one: Project › Export › Project file', () => {
    const wrapper = mountHints()

    expect(wrapper.get('[data-testid="first-run-storage"]').text()).toContain('Your Projects are kept in this browser')
    expect(wrapper.findAll('[data-testid="first-run-path"] .hint-chip').map((chip) => chip.text())).toEqual(['Project', 'Export', 'Project file'])
  })

  it('keeps only the welcome on a phone, with no captions', () => {
    media.set(PHONE, true)
    const wrapper = mountHints()

    expect(notes(wrapper)).toEqual([])
    expect(wrapper.find('[data-testid="first-run-welcome"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="first-run-path"]').exists()).toBe(true)
  })
})
