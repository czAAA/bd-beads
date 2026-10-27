import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import StarterGallery from './StarterGallery.vue'
import { PANEL_CONTEXT } from '../shell/panelContext'
import { en } from '../../i18n/en'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

function mountGallery(props: { category?: 'shapes' } = {}) {
  const openSub = vi.fn()
  const wrapper = mount(StarterGallery, {
    props,
    attachTo: document.body,
    global: { provide: { [PANEL_CONTEXT as symbol]: { itemRole: ref(undefined), close: vi.fn(), openSub } } },
  })
  return { wrapper, openSub }
}

describe('the Starter gallery, step 1', () => {
  it('leads with what a Starter is, then a card per category with its picture and its count of options', () => {
    const { wrapper } = mountGallery()
    expect(wrapper.get('[data-testid="starter-lead"]').text()).toBe(en.starters.lead)
    const card = wrapper.get('[data-testid="starter-category-shapes"]')
    expect(card.attributes('tabindex')).toBe('0')
    expect(card.text()).toContain('Shapes')
    expect(card.text()).toContain('5 shapes')
    expect(card.find('canvas.starter-picture').attributes('aria-hidden')).toBe('true')
  })

  it('opens a category one level deeper, under its name and the crumb, focus to come back to its card', async () => {
    const { wrapper, openSub } = mountGallery()
    await wrapper.get('[data-testid="starter-category-shapes"]').trigger('click')
    expect(wrapper.emitted('choose-category')).toEqual([['shapes']])
    expect(openSub).toHaveBeenCalledWith('Shapes', { meta: 'starter', opener: 'starter-category-shapes' })
  })
})

describe('the Starter gallery, step 2', () => {
  it('shows a card per option with its design, the size it is made for and its bead count', () => {
    const { wrapper } = mountGallery({ category: 'shapes' })
    expect(wrapper.get('[data-testid="starter-lead"]').text()).toBe(en.starters.categories.shapes.lead)
    const cards = wrapper.findAll('.starter-card')
    expect(cards.map((card) => card.attributes('data-testid'))).toEqual([
      'starter-card-triangle',
      'starter-card-warpedSquare',
      'starter-card-kite',
      'starter-card-star',
      'starter-card-kaleidocycle',
    ])
    expect(cards.map((card) => card.attributes('tabindex'))).toEqual(['0', '-1', '-1', '-1', '-1'])
    const triangle = wrapper.get('[data-testid="starter-card-triangle"]')
    expect(triangle.text()).toContain('Triangle')
    expect(triangle.text()).toContain('10 rounds')
    expect(triangle.text()).toContain('165 beads')
    expect(wrapper.get('[data-testid="starter-card-star"]').text()).toContain('part size 5')
  })

  it('names each card by its option, and describes it by its caption', () => {
    const { wrapper } = mountGallery({ category: 'shapes' })
    const card = wrapper.get('[data-testid="starter-card-triangle"]')
    const description = document.getElementById(card.attributes('aria-describedby')!)
    expect(description?.textContent).toContain('165 beads')
  })

  it('opens an option\'s setup under its name, the crumb naming its category', async () => {
    const { wrapper, openSub } = mountGallery({ category: 'shapes' })
    await wrapper.get('[data-testid="starter-card-kite"]').trigger('click')
    expect(wrapper.emitted('choose')).toEqual([['kite']])
    expect(openSub).toHaveBeenCalledWith('Kite', { meta: 'starter · shapes', opener: 'starter-card-kite' })
  })

  it('moves focus along a row and between rows of two with the arrows, and to the ends with Home and End', async () => {
    const { wrapper } = mountGallery({ category: 'shapes' })
    const card = (id: string) => wrapper.get(`[data-testid="starter-card-${id}"]`)
    ;(card('triangle').element as HTMLElement).focus()

    await card('triangle').trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(card('warpedSquare').element)
    await card('warpedSquare').trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(card('star').element)
    expect(card('star').attributes('tabindex')).toBe('0')
    expect(card('triangle').attributes('tabindex')).toBe('-1')
    await card('star').trigger('keydown', { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(card('kite').element)
    await card('kite').trigger('keydown', { key: 'End' })
    expect(document.activeElement).toBe(card('kaleidocycle').element)
    await card('kaleidocycle').trigger('keydown', { key: 'Home' })
    expect(document.activeElement).toBe(card('triangle').element)
  })
})
