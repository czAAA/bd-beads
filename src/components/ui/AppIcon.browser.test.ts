import { afterEach, describe, expect, it } from 'vitest'
import { mountAt } from '../../testUtils/browserFit'
import AppIcon from './AppIcon.vue'

// The AI mark is the one part of an icon drawn in `ai`, the theme's own, while the rest follows the text color
// (ticket 0764; README, Iconography).
const AI = { light: 'rgb(110, 68, 255)', dark: 'rgb(185, 166, 255)', contrast: 'rgb(74, 31, 209)' } as const

afterEach(() => document.documentElement.removeAttribute('data-theme'))

describe('AppIcon, an AI form', () => {
  it.each(Object.entries(AI))('draws its mark in the %s theme’s ai and the rest in the text color', async (theme, ai) => {
    document.documentElement.dataset.theme = theme
    const { root } = await mountAt(AppIcon, { name: 'cut-out-ai', style: 'color: rgb(1, 2, 3)' }, { locale: 'en', width: 390, text: false })
    const svg = root.querySelector('svg')!
    expect(getComputedStyle(svg.querySelector('.ai-mark')!).stroke).toBe(ai)
    expect(getComputedStyle(svg.querySelector('circle')!).stroke).toBe('rgb(1, 2, 3)')
  })
})
