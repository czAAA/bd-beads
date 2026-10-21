import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TemplateGallery from './TemplateGallery.vue'
import { en } from '../../i18n/en'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

const mountGallery = () => mount(TemplateGallery, { attachTo: document.body })

describe('the Template gallery', () => {
  it('is a radiogroup with Blank canvas first and chosen, then a card per Template with its name, description and spec line', () => {
    const wrapper = mountGallery()
    const cards = wrapper.findAll('[role="radio"]')

    expect(wrapper.get('[role="radiogroup"]').attributes('aria-label')).toBe(en.templates.galleryLabel)
    expect(cards.map((card) => card.attributes('data-testid'))).toEqual([
      'template-card-blank',
      'template-card-gerdan',
      'template-card-bracelet',
      'template-card-earrings',
      'template-card-bag',
      'template-card-custom',
    ])
    expect(cards.map((card) => card.attributes('aria-checked'))).toEqual(['true', 'false', 'false', 'false', 'false', 'false'])
    expect(cards.map((card) => card.attributes('tabindex'))).toEqual(['0', '-1', '-1', '-1', '-1', '-1'])

    const gerdan = wrapper.get('[data-testid="template-card-gerdan"]')
    expect(gerdan.text()).toContain(en.templates.gerdan.name)
    expect(gerdan.text()).toContain(en.templates.gerdan.description)
    expect(gerdan.get('[data-testid="template-spec"]').text()).toBe('24 × 80 · Loom')
    expect(wrapper.get('[data-testid="template-card-earrings"] [data-testid="template-spec"]').text()).toBe('10 × 48 · Peyote')
    expect(wrapper.find('[data-testid="template-card-blank"] [data-testid="template-spec"]').exists()).toBe(false)
  })

  it('shows a picture on each Template card with a generated sample', () => {
    const wrapper = mountGallery()
    expect(wrapper.findAll('canvas.template-picture')).toHaveLength(5)
  })

  it('tells when Blank canvas was picked, leaving the focus to the form (ticket 515)', async () => {
    const wrapper = mountGallery()
    await wrapper.get('[data-testid="template-card-blank"]').trigger('click')

    expect(wrapper.emitted('choose-blank')).toHaveLength(1)
    expect(wrapper.emitted('choose')).toBeUndefined()
  })

  it('tells which Template a tap chose', async () => {
    const wrapper = mountGallery()
    await wrapper.get('[data-testid="template-card-bracelet"]').trigger('click')

    expect(wrapper.emitted('choose')).toEqual([['bracelet']])
  })

  it('moves focus between cards with the arrows, Home and End', async () => {
    const wrapper = mountGallery()
    const card = (id: string) => wrapper.get(`[data-testid="template-card-${id}"]`)
    ;(card('blank').element as HTMLElement).focus()

    await card('blank').trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(card('gerdan').element)
    await card('gerdan').trigger('keydown', { key: 'End' })
    expect(document.activeElement).toBe(card('custom').element)
    await card('custom').trigger('keydown', { key: 'Home' })
    expect(document.activeElement).toBe(card('blank').element)
  })
})
