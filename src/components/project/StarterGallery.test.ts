import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StarterGallery from './StarterGallery.vue'
import { en } from '../../i18n/en'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

const mountGallery = () => mount(StarterGallery, { attachTo: document.body })

describe('the Starter gallery', () => {
  it('is a radiogroup of one card per Starter, none chosen, with its name, description and spec line', () => {
    const wrapper = mountGallery()
    const cards = wrapper.findAll('[role="radio"]')

    expect(wrapper.get('[role="radiogroup"]').attributes('aria-label')).toBe(en.starters.galleryLabel)
    expect(cards.map((card) => card.attributes('data-testid'))).toEqual([
      'starter-card-gerdan',
      'starter-card-bracelet',
      'starter-card-earrings',
      'starter-card-bag',
      'starter-card-custom',
    ])
    expect(cards.map((card) => card.attributes('aria-checked'))).toEqual(['false', 'false', 'false', 'false', 'false'])
    expect(cards.map((card) => card.attributes('tabindex'))).toEqual(['0', '-1', '-1', '-1', '-1'])

    const gerdan = wrapper.get('[data-testid="starter-card-gerdan"]')
    expect(gerdan.text()).toContain(en.starters.gerdan.name)
    expect(gerdan.text()).toContain(en.starters.gerdan.description)
    expect(gerdan.get('[data-testid="starter-spec"]').text()).toBe('24 × 80 · Loom')
    expect(wrapper.get('[data-testid="starter-card-earrings"] [data-testid="starter-spec"]').text()).toBe('10 × 48 · Peyote')
    expect(wrapper.find('[data-testid="starter-card-blank"]').exists()).toBe(false)
  })

  it('shows a picture on each Starter card with a generated sample', () => {
    const wrapper = mountGallery()
    expect(wrapper.findAll('canvas.starter-picture')).toHaveLength(5)
  })

  it('tells which Starter a tap chose', async () => {
    const wrapper = mountGallery()
    await wrapper.get('[data-testid="starter-card-bracelet"]').trigger('click')

    expect(wrapper.emitted('choose')).toEqual([['bracelet']])
  })

  it('moves focus between cards with the arrows, Home and End', async () => {
    const wrapper = mountGallery()
    const card = (id: string) => wrapper.get(`[data-testid="starter-card-${id}"]`)
    ;(card('gerdan').element as HTMLElement).focus()

    await card('gerdan').trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(card('bracelet').element)
    await card('bracelet').trigger('keydown', { key: 'End' })
    expect(document.activeElement).toBe(card('custom').element)
    await card('custom').trigger('keydown', { key: 'Home' })
    expect(document.activeElement).toBe(card('gerdan').element)
  })
})
