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
  it('is a radiogroup with Blank canvas first and chosen, then a card per Starter with its name, description and spec line', () => {
    const wrapper = mountGallery()
    const cards = wrapper.findAll('[role="radio"]')

    expect(wrapper.get('[role="radiogroup"]').attributes('aria-label')).toBe(en.starters.galleryLabel)
    expect(cards.map((card) => card.attributes('data-testid'))).toEqual([
      'starter-card-blank',
      'starter-card-gerdan',
      'starter-card-bracelet',
      'starter-card-earrings',
      'starter-card-bag',
      'starter-card-custom',
    ])
    expect(cards.map((card) => card.attributes('aria-checked'))).toEqual(['true', 'false', 'false', 'false', 'false', 'false'])
    expect(cards.map((card) => card.attributes('tabindex'))).toEqual(['0', '-1', '-1', '-1', '-1', '-1'])

    const gerdan = wrapper.get('[data-testid="starter-card-gerdan"]')
    expect(gerdan.text()).toContain(en.starters.gerdan.name)
    expect(gerdan.text()).toContain(en.starters.gerdan.description)
    expect(gerdan.get('[data-testid="starter-spec"]').text()).toBe('24 × 80 · Loom')
    expect(wrapper.get('[data-testid="starter-card-earrings"] [data-testid="starter-spec"]').text()).toBe('10 × 48 · Peyote')
    expect(wrapper.find('[data-testid="starter-card-blank"] [data-testid="starter-spec"]').exists()).toBe(false)
  })

  it('shows a picture on each Starter card with a generated sample', () => {
    const wrapper = mountGallery()
    expect(wrapper.findAll('canvas.starter-picture')).toHaveLength(5)
  })

  it('tells when Blank canvas was picked, leaving the focus to the form (ticket 515)', async () => {
    const wrapper = mountGallery()
    await wrapper.get('[data-testid="starter-card-blank"]').trigger('click')

    expect(wrapper.emitted('choose-blank')).toHaveLength(1)
    expect(wrapper.emitted('choose')).toBeUndefined()
  })

  it('tells which Starter a tap chose', async () => {
    const wrapper = mountGallery()
    await wrapper.get('[data-testid="starter-card-bracelet"]').trigger('click')

    expect(wrapper.emitted('choose')).toEqual([['bracelet']])
  })

  it('moves focus between cards with the arrows, Home and End', async () => {
    const wrapper = mountGallery()
    const card = (id: string) => wrapper.get(`[data-testid="starter-card-${id}"]`)
    ;(card('blank').element as HTMLElement).focus()

    await card('blank').trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(card('gerdan').element)
    await card('gerdan').trigger('keydown', { key: 'End' })
    expect(document.activeElement).toBe(card('custom').element)
    await card('custom').trigger('keydown', { key: 'Home' })
    expect(document.activeElement).toBe(card('blank').element)
  })
})
