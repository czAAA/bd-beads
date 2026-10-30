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
  it('teaches the four steps, notes the controls met next and welcomes, all hidden from screen readers', () => {
    const wrapper = mountHints()

    expect(wrapper.attributes('aria-hidden')).toBe('true')
    expect(notes(wrapper)).toEqual([
      '1 · pick Paint and draw anywhere',
      '2 · pick Select and drag a box round your drawing',
      '3 · make a Frame round your drawing,\nthen set its name, size and Bead here',
      '4 · export a picture\nor a printable chart',
      'colors and your Palette',
      'Mirror: paint both sides of an axis at once',
      'open, save,\npreferences,\nlanguage…',
      'your Project: its name, maker,\nTechnique, Bead and background',
    ])
    expect(wrapper.get('[data-testid="first-run-welcome"]').text()).toContain('draw → select → frame → export')
  })

  it('keeps only the four shorter steps and the welcome on a phone, step 4 pointing at the strip\'s end', () => {
    media.set(PHONE, true)
    const wrapper = mountHints()

    expect(notes(wrapper)).toEqual([
      '1 · pick Paint and draw',
      '2 · pick Select, drag a box',
      '3 · make a Frame round it,\nthen set it up here',
      '4 · export, at the end\nof this strip',
    ])
    expect(wrapper.find('[data-testid="first-run-welcome"]').exists()).toBe(true)
  })
})
