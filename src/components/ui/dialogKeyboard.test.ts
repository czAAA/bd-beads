import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DuplicateProjectModal from '../project/DuplicateProjectModal.vue'
import NamePieceModal from '../project/NamePieceModal.vue'
import { fakeMatchMedia } from '../../testUtils/fakeMatchMedia'

beforeEach(() => localStorage.setItem('openbeads:locale', 'en'))
afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

const dialogs = {
  'Duplicate project': () => mount(DuplicateProjectModal, { props: { suggested: 'Copy' }, attachTo: document.body }),
  'Name piece': () => mount(NamePieceModal, { props: { name: 'Leaf' }, attachTo: document.body }),
}

describe.each(Object.entries(dialogs))('%s dialog focus (ticket 516)', (_name, open) => {
  it('focuses the first field on a mouse device', () => {
    const wrapper = open()
    expect(document.activeElement).toBe(wrapper.find('[data-autofocus]').element)
  })

  it('starts on the dialog on a touch device, so the keyboard stays down', () => {
    vi.stubGlobal('matchMedia', fakeMatchMedia({ '(pointer: coarse)': true }).matchMedia)
    const wrapper = open()
    expect(document.activeElement).toBe(wrapper.find('[role="dialog"]').element)
  })

  // The panel that opened the dialog hands focus back to its strip button as it closes (ticket 0688).
  it('brings focus that strays outside back to the dialog, not the field, on a touch device', () => {
    vi.stubGlobal('matchMedia', fakeMatchMedia({ '(pointer: coarse)': true }).matchMedia)
    const outside = document.body.appendChild(document.createElement('button'))
    const wrapper = open()
    outside.focus()
    expect(document.activeElement).toBe(wrapper.find('[role="dialog"]').element)
  })
})
