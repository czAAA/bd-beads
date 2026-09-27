import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { en } from '../i18n/en'
import { THEME_STORAGE_KEY } from '../theme/theme'
import { useThemePick } from '../theme/useThemePick'
import ThemeToggle from './ThemeToggle.vue'

const root = document.documentElement

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
})

afterEach(() => {
  useThemePick().setPick('device')
})

const mountToggle = () => mount(ThemeToggle, { attachTo: document.body })
const option = (wrapper: ReturnType<typeof mountToggle>, name: string) => wrapper.get(`[data-testid="theme-${name}"]`)

describe('ThemeToggle', () => {
  it('is a radio group of four named options, Match device first and chosen by default', () => {
    const wrapper = mountToggle()

    expect(wrapper.get('[data-testid="theme-toggle"]').attributes('role')).toBe('radiogroup')
    const radios = wrapper.findAll('[role="radio"]')
    expect(radios.map((radio) => radio.attributes('aria-label'))).toEqual([
      en.theme.matchDevice,
      en.theme.light,
      en.theme.dark,
      en.theme.contrast,
    ])
    expect(radios.map((radio) => radio.find('svg').attributes('data-icon'))).toEqual(['device', 'sun', 'moon', 'contrast'])
    expect(option(wrapper, 'device').attributes('aria-checked')).toBe('true')
  })

  it('has one Tab stop: the chosen option', () => {
    const wrapper = mountToggle()

    expect(wrapper.findAll('[role="radio"]').map((radio) => radio.attributes('tabindex'))).toEqual(['0', '-1', '-1', '-1'])
  })

  it('switches the whole app at once and remembers the pick on this device', async () => {
    const wrapper = mountToggle()

    await option(wrapper, 'dark').trigger('click')

    expect(root.dataset.theme).toBe('dark')
    expect(root.style.colorScheme).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(option(wrapper, 'dark').attributes('aria-checked')).toBe('true')
  })

  it('forgets the pick when set back to Match device', async () => {
    const wrapper = mountToggle()
    await option(wrapper, 'contrast').trigger('click')
    expect(root.dataset.theme).toBe('contrast')

    await option(wrapper, 'device').trigger('click')

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
    expect(root.dataset.theme).toBe('light') // the test DOM's device is light
  })

  it('moves the pick with the arrow keys, wrapping round, and Home and End', async () => {
    const wrapper = mountToggle()
    const group = wrapper.get('[data-testid="theme-toggle"]')

    await group.trigger('keydown', { key: 'ArrowRight' })
    expect(option(wrapper, 'light').attributes('aria-checked')).toBe('true')
    await group.trigger('keydown', { key: 'ArrowLeft' })
    await group.trigger('keydown', { key: 'ArrowLeft' })
    expect(option(wrapper, 'contrast').attributes('aria-checked')).toBe('true')
    await group.trigger('keydown', { key: 'Home' })
    expect(option(wrapper, 'device').attributes('aria-checked')).toBe('true')
    await group.trigger('keydown', { key: 'End' })
    await nextTick()
    expect(option(wrapper, 'contrast').attributes('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(option(wrapper, 'contrast').element)
  })
})
