import { afterEach, describe, expect, it } from 'vitest'
import { mountAt } from '../../testUtils/browserFit'
import AppMessage from './AppMessage.vue'

// A Message is one tone, its edge and its icon alike (Message card, ticket 0855): the danger tone is red in light and
// high contrast and gold (`accent-strong`) in dark, where the theme's own border once drew every edge yellow.
const THEMES = ['light', 'dark', 'contrast'] as const
const TONES = ['success', 'info', 'warning', 'danger'] as const
const DANGER = { light: 'rgb(185, 28, 28)', dark: 'rgb(250, 255, 105)', contrast: 'rgb(168, 44, 0)' }

afterEach(() => {
  delete document.documentElement.dataset.theme
})

async function toneColors(theme: (typeof THEMES)[number], tone: (typeof TONES)[number]) {
  document.documentElement.dataset.theme = theme
  const mounted = await mountAt(AppMessage, { tone }, { locale: 'en', width: 768, text: false })
  const message = mounted.root.querySelector<HTMLElement>('.app-message')!
  const icon = mounted.root.querySelector<SVGElement>('.app-message__icon')!
  return { edge: getComputedStyle(message).borderLeftColor, icon: getComputedStyle(icon).color }
}

describe.each(THEMES)('a Message in %s', (theme) => {
  it.each(TONES)('draws its %s edge and icon in one color', async (tone) => {
    const { edge, icon } = await toneColors(theme, tone)
    expect(edge).toBe(icon)
  })

  it('draws the danger tone in its theme’s color', async () => {
    expect((await toneColors(theme, 'danger')).edge).toBe(DANGER[theme])
  })
})
