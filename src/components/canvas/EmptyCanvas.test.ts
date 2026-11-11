import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import EmptyCanvas from './EmptyCanvas.vue'
import { fakeMatchMedia } from '../../testUtils/fakeMatchMedia'
import { resetKeyHintsDevice } from '../../composables/ui/useKeyHints'

beforeEach(() => {
  localStorage.setItem('openbeads:locale', 'en')
})

afterEach(() => {
  localStorage.clear()
})

const mountEmpty = (props: { deleted?: string; quiet?: boolean } = {}) => mount(EmptyCanvas, { props, slots: { default: '<button data-testid="slotted">New Project</button>' } })

describe('EmptyCanvas (EmptyCanvas card)', () => {
  it('says no Project is open yet, what to do and how to move the Canvas, over the slot', () => {
    const wrapper = mountEmpty()
    const message = wrapper.get('[data-testid="empty-canvas-message"]')

    expect(message.get('.empty-canvas__title').text()).toBe('No Project open yet')
    expect(message.get('.empty-canvas__hint').text()).toBe(
      'Make one with New Project, open one from the Projects library, or open a Project file. Drag the Canvas around with the right mouse button or Space.',
    )
    expect(message.find('[data-testid="empty-canvas-library"]').exists()).toBe(false)
    expect(message.find('[data-testid="slotted"]').exists()).toBe(true)
  })

  it('says how to move the Canvas with fingers on touch, naming no button or key (ticket 0846)', () => {
    const realMatchMedia = window.matchMedia
    window.matchMedia = fakeMatchMedia({ '(pointer: coarse)': true }).matchMedia
    resetKeyHintsDevice()
    try {
      expect(mountEmpty().get('.empty-canvas__hint').text()).toBe(
        'Make one with New Project, open one from the Projects library, or open a Project file. Drag the Canvas around with two fingers.',
      )
    } finally {
      window.matchMedia = realMatchMedia
      resetKeyHintsDevice()
    }
  })

  it('names the deleted Project and links to the Projects library after a delete', async () => {
    const wrapper = mountEmpty({ deleted: 'Sunflower' })

    expect(wrapper.get('.empty-canvas__title').text()).toBe('“Sunflower” was deleted.')
    expect(wrapper.get('.empty-canvas__hint').text()).toBe('Open another from the Projects library, or make a new one.')
    const link = wrapper.get('[data-testid="empty-canvas-library"]')
    expect(link.text()).toBe('Projects library')
    await link.trigger('click')
    expect(wrapper.emitted('library')).toHaveLength(1)
  })

  it('shows no message, nor its buttons, while a panel is over the Canvas', () => {
    const wrapper = mountEmpty({ deleted: 'Sunflower', quiet: true })

    expect(wrapper.find('[data-testid="empty-canvas-message"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="slotted"]').exists()).toBe(false)
    expect(wrapper.find('.empty-canvas__board').exists()).toBe(true)
  })
})
