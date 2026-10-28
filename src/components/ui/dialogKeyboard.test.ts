import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DuplicateProjectModal from '../project/DuplicateProjectModal.vue'
import NamePieceModal from '../project/NamePieceModal.vue'
import ConvertImageSizeDialog from '../import/ConvertImageSizeDialog.vue'
import { findBead } from '../../domain/beads'
import { fakeMatchMedia } from '../../testUtils/fakeMatchMedia'

beforeEach(() => localStorage.setItem('openbeads:locale', 'en'))
afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

const dialogs = {
  'Duplicate project': () => mount(DuplicateProjectModal, { props: { suggested: 'Copy' }, attachTo: document.body }),
  'Name piece': () => mount(NamePieceModal, { props: { name: 'Leaf' }, attachTo: document.body }),
  'Convert image size': () =>
    mount(ConvertImageSizeDialog, {
      props: { bead: findBead('toho-cube-1.5mm')!, technique: 'loom' },
      attachTo: document.body,
    }),
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
})
